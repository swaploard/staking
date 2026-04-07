use crate::errors::ErrorCode;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

// ============================================================================
// Withdraw — step 2 of 2-step unstaking
//
// After cooldown_duration has passed, user can claim their unstaked tokens.
// Transfers pending_withdrawal from stake_vault → user.
// ============================================================================

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub user: Signer<'info>,

    #[account(
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

pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
    let user_position = &mut ctx.accounts.user_position;
    let pool = &ctx.accounts.pool;

    // Validate there is a pending withdrawal
    require!(
        user_position.pending_withdrawal > 0,
        ErrorCode::NoPendingWithdrawal
    );

    // Validate cooldown has completed
    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= user_position.unlock_timestamp,
        ErrorCode::CooldownNotComplete
    );

    let withdrawal_amount = user_position.pending_withdrawal;

    // Transfer from vault → user via PDA signer
    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let seeds: &[&[u8]] = &[b"pool", pool_id_bytes.as_ref(), &[pool.bump]];
    let signer_seeds = &[seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.stake_vault.to_account_info(),
            to: ctx.accounts.user_stake_ata.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(cpi_ctx, withdrawal_amount)?;

    // Reset cooldown state
    user_position.pending_withdrawal = 0;
    user_position.cooldown_start = 0;
    user_position.unlock_timestamp = 0;

    msg!(
        "User {} withdrew {} tokens from pool {}",
        user_position.owner, withdrawal_amount, pool.pool_id
    );
    Ok(())
}
