use crate::errors::ErrorCode;
use crate::state::*;
use anchor_lang::prelude::*;

/// Precision multiplier for accumulator math (1e12).
/// All acc_reward_per_share values are scaled by this factor to avoid
/// truncation in integer division.
pub const PRECISION: u128 = 1_000_000_000_000;

// ============================================================================
// update_pool — MUST be called before any state mutation
// ============================================================================
/// Updates the pool's accumulated reward per share based on elapsed time.
///
/// This is the heart of the accumulator model. Every instruction that reads
/// or writes user rewards MUST call this first to ensure the accumulator
/// is current.
///
/// Edge cases handled:
/// - total_staked == 0: just advance the timestamp, no div-by-zero
/// - reward_rate_per_second == 0: no rewards to distribute (unfunded pool)
/// - now <= last_update_timestamp: no-op (prevents backward clock)
pub fn update_pool(pool: &mut Pool, now: i64) -> Result<()> {
    // Guard: clock should never go backwards
    require!(now >= pool.last_update_timestamp, ErrorCode::InvalidTimestamp);

    // If no time has elapsed, nothing to do
    if now <= pool.last_update_timestamp {
        return Ok(());
    }

    // If nobody is staked, just advance the timestamp.
    // Rewards during this period are effectively lost (not distributed).
    if pool.total_staked == 0 {
        pool.last_update_timestamp = now;
        return Ok(());
    }

    let elapsed = (now - pool.last_update_timestamp) as u128;
    let reward_rate = pool.reward_rate_per_second as u128;

    // Total new rewards accrued since last update
    let new_rewards = elapsed
        .checked_mul(reward_rate)
        .ok_or(ErrorCode::MathOverflow)?;

    // Scale by PRECISION, then divide by total_staked to get per-share increment
    let reward_per_share_delta = new_rewards
        .checked_mul(PRECISION)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(pool.total_staked as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    pool.acc_reward_per_share = pool
        .acc_reward_per_share
        .checked_add(reward_per_share_delta)
        .ok_or(ErrorCode::MathOverflow)?;

    pool.last_update_timestamp = now;

    Ok(())
}

// ============================================================================
// calculate_pending — compute unclaimed rewards for a user
// ============================================================================
/// Returns the pending reward amount for a user position given the current
/// accumulated reward per share.
///
/// Formula: (user.amount * acc_reward_per_share / PRECISION) - reward_debt
///
/// This returns the raw token amount (not scaled by PRECISION).
pub fn calculate_pending(user: &UserPosition, acc_reward_per_share: u128) -> Result<u64> {
    let accumulated = (user.amount as u128)
        .checked_mul(acc_reward_per_share)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(PRECISION)
        .ok_or(ErrorCode::MathOverflow)?;

    // accumulated >= reward_debt should always hold if accounting is correct,
    // but use saturating_sub for safety against precision rounding.
    let pending = accumulated.saturating_sub(user.reward_debt);

    // Safe downcast: pending rewards should never exceed u64 range in practice
    Ok(pending as u64)
}

// ============================================================================
// assert_not_paused — reusable pause check
// ============================================================================
/// Validates that a pool is not paused. Call this at the top of every
/// user-facing instruction (stake, claim, request_unstake).
pub fn assert_not_paused(pool: &Pool) -> Result<()> {
    require!(!pool.paused, ErrorCode::PoolPaused);
    Ok(())
}
