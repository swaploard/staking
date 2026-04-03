use crate::errors::ErrorCode;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

// ============================================================================
// EmergencyWithdraw — user pulls all staked tokens, forfeiting rewards
//
// This is a safety hatch. It does NOT call update_pool() or compute rewards.
// The user loses all pending and accumulated rewards.
// ============================================================================

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool.pool_id.to_le_bytes().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [b"position", pool.key().as_ref(), user.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.owner == user.key() @ ErrorCode::Unauthorized,
        constraint = user_position.pool == pool.key() @ ErrorCode::Unauthorized,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// User's stake token account (destination)
    #[account(
        mut,
        constraint = user_stake_ata.mint == pool.stake_mint,
        constraint = user_stake_ata.owner == user.key(),
    )]
    pub user_stake_ata: Account<'info, TokenAccount>,

    /// Pool's stake vault (source, authority = pool PDA)
    #[account(
        mut,
        constraint = stake_vault.key() == pool.stake_vault,
        constraint = stake_vault.mint == pool.stake_mint,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
    // Extract AccountInfo BEFORE taking mutable borrows
    let pool_account_info = ctx.accounts.pool.to_account_info();
    let stake_vault_info = ctx.accounts.stake_vault.to_account_info();
    let user_stake_ata_info = ctx.accounts.user_stake_ata.to_account_info();
    let token_program_info = ctx.accounts.token_program.to_account_info();

    let pool = &mut ctx.accounts.pool;
    let user_position = &mut ctx.accounts.user_position;

    // Total tokens to return = currently staked + any in cooldown
    let total_return = user_position
        .amount
        .checked_add(user_position.pending_withdrawal)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(total_return > 0, ErrorCode::ZeroAmount);

    // Transfer all tokens back via PDA signer
    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let seeds: &[&[u8]] = &[b"pool", pool_id_bytes.as_ref(), &[pool.bump]];
    let signer_seeds = &[seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        token_program_info,
        Transfer {
            from: stake_vault_info,
            to: user_stake_ata_info,
            authority: pool_account_info,
        },
        signer_seeds,
    );
    token::transfer(cpi_ctx, total_return)?;

    // Reduce pool total by the STAKED amount only (pending_withdrawal
    // was already subtracted from total_staked during request_unstake)
    pool.total_staked = pool
        .total_staked
        .saturating_sub(user_position.amount);

    // Wipe the user position completely — forfeits all rewards
    user_position.amount = 0;
    user_position.reward_debt = 0;
    user_position.pending_rewards = 0;
    user_position.pending_withdrawal = 0;
    user_position.cooldown_start = 0;
    user_position.unlock_timestamp = 0;

    msg!(
        "User {} emergency withdrew {} tokens from pool {}. Rewards forfeited.",
        user_position.owner, total_return, pool.pool_id
    );
    Ok(())
}
