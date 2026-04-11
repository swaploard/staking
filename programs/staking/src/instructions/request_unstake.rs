use crate::errors::ErrorCode;
use crate::events::UnstakeRequested;
use crate::state::*;
use crate::utils::{self, PRECISION};
use anchor_lang::prelude::*;

// ============================================================================
// RequestUnstake — step 1 of 2-step unstaking
//
// Requirements:
// - Lock duration must have passed since deposit
// - Reduces user.amount, increases user.pending_withdrawal
// - Sets cooldown_start and unlock_timestamp
//
// Mutation order:
// 1. update_pool()
// 2. harvest pending rewards
// 3. reduce amount, set pending_withdrawal
// 4. update reward_debt
// 5. reduce pool.total_staked
// ============================================================================

#[derive(Accounts)]
pub struct RequestUnstake<'info> {
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
}

pub fn request_unstake(ctx: Context<RequestUnstake>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::ZeroAmount);

    let pool = &mut ctx.accounts.pool;
    let user_position = &mut ctx.accounts.user_position;

    // 0. Safety checks
    utils::assert_not_paused(pool)?;
    require!(
        user_position.amount >= amount,
        ErrorCode::InsufficientStake
    );

    let now = Clock::get()?.unix_timestamp;

    // Enforce lock duration
    require!(
        now >= user_position
            .deposit_timestamp
            .checked_add(pool.lock_duration)
            .ok_or(ErrorCode::MathOverflow)?,
        ErrorCode::LockNotExpired
    );

    // 1. Update pool accumulator
    utils::update_pool(pool, now)?;

    // 2. Harvest pending rewards before modifying amount
    let pending = utils::calculate_pending(user_position, pool.acc_reward_per_share)?;
    if pending > 0 {
        user_position.pending_rewards = user_position
            .pending_rewards
            .checked_add(pending)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    // 3. Reduce staked amount, track withdrawal
    user_position.amount = user_position
        .amount
        .checked_sub(amount)
        .ok_or(ErrorCode::InsufficientStake)?;

    user_position.pending_withdrawal = user_position
        .pending_withdrawal
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    // Set cooldown timestamps
    user_position.cooldown_start = now;
    user_position.unlock_timestamp = now
        .checked_add(pool.cooldown_duration)
        .ok_or(ErrorCode::MathOverflow)?;

    // 4. Update reward_debt for remaining amount
    user_position.reward_debt = (user_position.amount as u128)
        .checked_mul(pool.acc_reward_per_share)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(PRECISION)
        .ok_or(ErrorCode::MathOverflow)?;

    // 5. Reduce pool total
    pool.total_staked = pool
        .total_staked
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    emit!(UnstakeRequested {
        pool: pool.key(),
        pool_id: pool.pool_id,
        user: user_position.owner,
        amount,
        user_amount_after: user_position.amount,
        pending_withdrawal_after: user_position.pending_withdrawal,
        unlock_timestamp: user_position.unlock_timestamp,
        pool_total_staked_after: pool.total_staked,
        timestamp: now,
    });

    msg!(
        "User {} requested unstake of {} from pool {}. Cooldown until: {}",
        user_position.owner, amount, pool.pool_id, user_position.unlock_timestamp
    );
    Ok(())
}
