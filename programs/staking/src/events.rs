//! These events are intended for off-chain consumers (indexers, dashboards, analytics) to reconstruct
//! state transitions without re-simulating every instruction.
//!
//! ## Naming conventions
//! - **Deltas**: amounts such as `amount`, `funding_amount`, `withdrawn_amount`, `returned_amount`
//!   describe the *change applied by the current instruction*.
//! - **Post-state snapshots**: fields ending in `_after` are the relevant account totals *after* the
//!   instruction executes.
//! - **Cumulative counters**: `total_*_after` fields are monotonic totals tracked on the pool.

use anchor_lang::prelude::*;

#[event]
/// Emitted once when the global program state is initialized.
pub struct GlobalInitialized {
    /// Program admin authority after initialization.
    pub admin_authority: Pubkey,
    /// Authority allowed to pause/unpause pools after initialization.
    pub pause_authority: Pubkey,
    /// Treasury account that receives protocol fees (if applicable).
    pub treasury: Pubkey,
    /// Unix timestamp recorded by the instruction.
    pub timestamp: i64,
}

#[event]
/// Emitted when a new pool is created.
///
/// `pool` is the pool PDA address; `pool_id` is the human-readable id (also used in seeds).
pub struct PoolCreated {
    /// Pool PDA address.
    pub pool: Pubkey,
    /// Pool identifier used in PDA seeds / UI routing.
    pub pool_id: u64,
    /// Pool authority after creation.
    pub authority: Pubkey,
    /// Mint of the token users stake.
    pub stake_mint: Pubkey,
    /// Mint of the token distributed as rewards.
    pub reward_mint: Pubkey,
    /// Vault that custody staked tokens.
    pub stake_vault: Pubkey,
    /// Vault that custody reward tokens.
    pub reward_vault: Pubkey,
    /// Annual percentage rate expressed in basis points.
    pub apr_bps: u64,
    /// Minimum lock duration (seconds) applied to new stakes.
    pub lock_duration: i64,
    /// Cooldown duration (seconds) between unstake request and withdrawal.
    pub cooldown_duration: i64,
    /// Maximum total stake allowed in the pool (0 may mean "no cap", depending on program logic).
    pub deposit_cap: u64,
    /// Unix timestamp recorded by the instruction.
    pub timestamp: i64,
}

#[event]
/// Emitted when reward tokens are deposited into the reward vault and the emission schedule is set.
pub struct RewardsFunded {
    /// Pool PDA address.
    pub pool: Pubkey,
    /// Pool identifier used in PDA seeds / UI routing.
    pub pool_id: u64,
    /// Funding authority (typically the pool authority / admin).
    pub authority: Pubkey,
    /// Tokens moved admin → vault in this instruction (delta).
    pub funding_amount: u64,
    /// Emission duration configured for this funding action.
    pub duration_seconds: u64,
    /// Reward emission rate derived from funding and duration.
    pub reward_rate_per_second: u64,
    /// Cumulative `total_rewards_funded` on the pool after this instruction.
    pub total_rewards_funded_after: u64,
    /// Unix timestamp recorded by the instruction.
    pub timestamp: i64,
}

#[event]
/// Emitted when pool parameters are updated.
///
/// Only `Some` fields were updated in this transaction; `None` means unchanged.
pub struct PoolParamsUpdated {
    /// Pool PDA address.
    pub pool: Pubkey,
    /// Pool identifier used in PDA seeds / UI routing.
    pub pool_id: u64,
    /// Authority that performed the update.
    pub authority: Pubkey,
    /// New APR in basis points, if updated.
    pub apr_bps: Option<u64>,
    /// New lock duration (seconds), if updated.
    pub lock_duration: Option<i64>,
    /// New cooldown duration (seconds), if updated.
    pub cooldown_duration: Option<i64>,
    /// New deposit cap, if updated.
    pub deposit_cap: Option<u64>,
    /// Unix timestamp recorded by the instruction.
    pub timestamp: i64,
}

#[event]
/// Emitted when a pool's paused state is toggled.
pub struct PoolPauseToggled {
    /// Pool PDA address.
    pub pool: Pubkey,
    /// Pool identifier used in PDA seeds / UI routing.
    pub pool_id: u64,
    /// Authority that toggled the state (pause authority / admin).
    pub authority: Pubkey,
    /// Whether the pool is paused after the toggle.
    pub is_paused: bool,
    /// Unix timestamp recorded by the instruction.
    pub timestamp: i64,
}

#[event]
/// Emitted when a user stakes tokens into a pool.
pub struct Staked {
    /// Pool PDA address.
    pub pool: Pubkey,
    /// Pool identifier used in PDA seeds / UI routing.
    pub pool_id: u64,
    /// User wallet that staked.
    pub user: Pubkey,
    /// Stake deposited in this instruction (delta).
    pub amount: u64,
    /// User active stake balance after staking.
    pub user_amount_after: u64,
    /// Pool total staked after staking.
    pub pool_total_staked_after: u64,
    /// Unix timestamp recorded by the instruction.
    pub timestamp: i64,
}

#[event]
/// Emitted when a user requests to unstake (moves stake into pending withdrawal).
pub struct UnstakeRequested {
    /// Pool PDA address.
    pub pool: Pubkey,
    /// Pool identifier used in PDA seeds / UI routing.
    pub pool_id: u64,
    /// User wallet that requested the unstake.
    pub user: Pubkey,
    /// Amount moved from active stake into pending withdrawal (delta).
    pub amount: u64,
    /// User active stake balance after the request.
    pub user_amount_after: u64,
    /// User pending withdrawal balance after the request.
    pub pending_withdrawal_after: u64,
    /// Timestamp at which withdrawal becomes available.
    pub unlock_timestamp: i64,
    /// Pool total staked after moving the user's stake out of active stake.
    pub pool_total_staked_after: u64,
    /// Unix timestamp recorded by the instruction.
    pub timestamp: i64,
}

#[event]
/// Emitted when a user withdraws previously-requested unstaked tokens.
pub struct Withdrawn {
    /// Pool PDA address.
    pub pool: Pubkey,
    /// Pool identifier used in PDA seeds / UI routing.
    pub pool_id: u64,
    /// User wallet that withdrew.
    pub user: Pubkey,
    /// Tokens withdrawn to the user in this instruction (delta).
    pub withdrawn_amount: u64,
    /// User active stake balance after withdrawal.
    pub user_amount_after: u64,
    /// User pending withdrawal balance after withdrawal.
    pub pending_withdrawal_after: u64,
    /// Unix timestamp recorded by the instruction.
    pub timestamp: i64,
}

#[event]
/// Emitted when a user claims accumulated rewards from a pool.
pub struct RewardsClaimed {
    /// Pool PDA address.
    pub pool: Pubkey,
    /// Pool identifier used in PDA seeds / UI routing.
    pub pool_id: u64,
    /// User wallet that claimed rewards.
    pub user: Pubkey,
    /// Reward tokens transferred to the user in this instruction (delta).
    pub claimed_amount: u64,
    /// Pool cumulative `rewards_distributed` after this claim.
    pub total_rewards_distributed_after: u64,
    /// Unix timestamp recorded by the instruction.
    pub timestamp: i64,
}

#[event]
/// Emitted when a user performs an emergency withdrawal.
///
/// This typically returns stake and any pending withdrawal immediately, bypassing normal cooldowns
/// (subject to program rules).
pub struct EmergencyWithdrawn {
    /// Pool PDA address.
    pub pool: Pubkey,
    /// Pool identifier used in PDA seeds / UI routing.
    pub pool_id: u64,
    /// User wallet that emergency-withdrew.
    pub user: Pubkey,
    /// Total stake + pending withdrawal returned to the user (delta).
    pub returned_amount: u64,
    /// User active stake balance after the emergency withdrawal.
    pub user_amount_after: u64,
    /// User pending withdrawal balance after the emergency withdrawal.
    pub pending_withdrawal_after: u64,
    /// Pool total staked after the emergency withdrawal.
    pub pool_total_staked_after: u64,
    /// Unix timestamp recorded by the instruction.
    pub timestamp: i64,
}
