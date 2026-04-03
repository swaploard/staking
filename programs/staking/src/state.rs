use anchor_lang::prelude::*;

// ============================================================================
// GlobalConfig — singleton PDA (seeds: ["global"])
// ============================================================================
#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    /// The admin who can create pools, fund rewards, update params
    pub admin_authority: Pubkey,
    /// Authority that can pause/unpause pools (can be same as admin)
    pub pause_authority: Pubkey,
    /// Treasury wallet for protocol fees (reserved for future use)
    pub treasury: Pubkey,
    /// PDA bump seed
    pub bump: u8,
    /// Schema version for migration safety
    pub version: u8,
}

// ============================================================================
// Pool — PDA per pool (seeds: ["pool", pool_id.to_le_bytes()])
// ============================================================================
#[account]
#[derive(InitSpace)]
pub struct Pool {
    // ---- Identity ----
    /// Unique numeric identifier for this pool
    pub pool_id: u64,

    // ---- Config ----
    /// Mint of the token users stake
    pub stake_mint: Pubkey,
    /// Mint of the token distributed as rewards
    pub reward_mint: Pubkey,
    /// Vault holding staked tokens (authority = pool PDA)
    pub stake_vault: Pubkey,
    /// Vault holding reward tokens (authority = pool PDA)
    pub reward_vault: Pubkey,

    /// Annual percentage rate in basis points — UI metadata only,
    /// NOT used in core reward math. Core math uses reward_rate_per_second.
    pub apr_bps: u64,
    /// Minimum time (seconds) user must remain staked before requesting unstake
    pub lock_duration: i64,
    /// Time (seconds) user must wait after request_unstake before withdraw
    pub cooldown_duration: i64,
    /// Maximum total tokens that can be staked in this pool (0 = no cap)
    pub deposit_cap: u64,
    /// Whether the pool is paused (blocks stake/claim/unstake)
    pub paused: bool,

    // ---- Accounting (accumulator model) ----
    /// Total tokens currently staked in this pool
    pub total_staked: u64,
    /// Accumulated reward per share, scaled by PRECISION (1e12)
    pub acc_reward_per_share: u128,
    /// Last time the accumulator was updated
    pub last_update_timestamp: i64,
    /// Fixed emission rate: tokens of reward per second
    /// Set by fund_rewards: total_rewards_funded / emission_duration
    pub reward_rate_per_second: u64,
    /// Cumulative reward tokens deposited by admin
    pub total_rewards_funded: u64,
    /// Cumulative reward tokens actually distributed to users
    pub rewards_distributed: u64,

    // ---- Safety ----
    /// PDA bump seed
    pub bump: u8,
    /// Schema version for migration safety
    pub version: u8,
}

// ============================================================================
// UserPosition — PDA per user per pool (seeds: ["position", pool, user])
// ============================================================================
#[account]
#[derive(InitSpace)]
pub struct UserPosition {
    /// Owner of this position
    pub owner: Pubkey,
    /// Pool this position belongs to
    pub pool: Pubkey,

    /// Currently staked amount
    pub amount: u64,
    /// Reward debt for accumulator math (scaled by PRECISION)
    pub reward_debt: u128,
    /// Accumulated but unclaimed rewards
    pub pending_rewards: u64,
    /// Tokens in cooldown, awaiting withdrawal
    pub pending_withdrawal: u64,

    /// Timestamp of last deposit (used for lock_duration enforcement)
    pub deposit_timestamp: i64,
    /// Timestamp after which pending_withdrawal can be withdrawn
    pub unlock_timestamp: i64,
    /// Timestamp when cooldown started (0 if no active cooldown)
    pub cooldown_start: i64,

    /// PDA bump seed
    pub bump: u8,
    /// Schema version for migration safety
    pub version: u8,
}
