use crate::errors::ErrorCode;
use crate::state::*;
use crate::utils::{self, PRECISION};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

// ============================================================================
// Stake — user deposits tokens into a pool
//
// Mutation order (CRITICAL):
// 1. update_pool()
// 2. calculate & accumulate pending rewards (existing stakers)
// 3. transfer tokens from user → vault
// 4. update user.amount
// 5. update user.reward_debt
// ============================================================================

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool.pool_id.to_le_bytes().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserPosition::INIT_SPACE,
        seeds = [b"position", pool.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// User's stake token account (source)
    #[account(
        mut,
        constraint = user_stake_ata.mint == pool.stake_mint,
        constraint = user_stake_ata.owner == user.key(),
    )]
    pub user_stake_ata: Account<'info, TokenAccount>,

    /// Pool's stake vault (destination, authority = pool PDA)
    #[account(
        mut,
        constraint = stake_vault.key() == pool.stake_vault,
        constraint = stake_vault.mint == pool.stake_mint,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::ZeroAmount);

    let pool = &mut ctx.accounts.pool;
    let user_position = &mut ctx.accounts.user_position;

    // 0. Safety checks
    utils::assert_not_paused(pool)?;

    // Enforce deposit cap (0 = no cap)
    if pool.deposit_cap > 0 {
        require!(
            pool.total_staked
                .checked_add(amount)
                .ok_or(ErrorCode::MathOverflow)?
                <= pool.deposit_cap,
            ErrorCode::DepositCapExceeded
        );
    }

    // 1. Update pool accumulator
    let now = Clock::get()?.unix_timestamp;
    utils::update_pool(pool, now)?;

    // 2. If user already has a position, harvest pending rewards
    if user_position.amount > 0 {
        let pending = utils::calculate_pending(user_position, pool.acc_reward_per_share)?;
        if pending > 0 {
            user_position.pending_rewards = user_position
                .pending_rewards
                .checked_add(pending)
                .ok_or(ErrorCode::MathOverflow)?;
        }
    } else {
        // First stake: initialize position fields
        user_position.owner = ctx.accounts.user.key();
        user_position.pool = pool.key();
        user_position.pending_rewards = 0;
        user_position.pending_withdrawal = 0;
        user_position.cooldown_start = 0;
        user_position.unlock_timestamp = 0;
        user_position.bump = ctx.bumps.user_position;
        user_position.version = 1;
    }

    // 3. Transfer tokens from user → vault
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_stake_ata.to_account_info(),
            to: ctx.accounts.stake_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, amount)?;

    // 4. Update user amount
    user_position.amount = user_position
        .amount
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    user_position.deposit_timestamp = now;

    // 5. Update reward_debt = amount * acc_reward_per_share / PRECISION
    user_position.reward_debt = (user_position.amount as u128)
        .checked_mul(pool.acc_reward_per_share)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(PRECISION)
        .ok_or(ErrorCode::MathOverflow)?;

    // 6. Update pool total
    pool.total_staked = pool
        .total_staked
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    msg!(
        "User {} staked {} tokens in pool {}. Total staked: {}",
        user_position.owner, amount, pool.pool_id, pool.total_staked
    );
    Ok(())
}
