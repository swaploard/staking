use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Pool {
    // --- Config ---
    pub stake_mint: Pubkey,
    pub reward_mint: Pubkey,
    pub stake_vault: Pubkey,
    pub reward_vault: Pubkey,

    pub apr_bps: u16,
    pub lock_duration: i64,
    pub cooldown_duration: i64,
    pub deposit_cap: u64,

    pub paused: bool,

    // --- Accounting ---
    pub total_staked: u64,
    pub acc_reward_per_share: u128,
    pub last_update_timestamp: i64,
    pub reward_rate_per_second: u64,
    pub total_rewards_funded: u64,

    // --- Metadata ---
    pub bump: u8,
    pub version: u8,
}

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub admin_authority: Pubkey,
    pub pause_authority: Pubkey,
    pub treasury: Pubkey,
    pub bump: u8,
    pub version: u8,
}
