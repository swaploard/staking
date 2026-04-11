use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;
pub use events::*;
pub use state::*;

declare_id!("8iVfFoXD5THP7XJKwSDGEyK72Basc983p8fDpzUK9brN");

#[program]
pub mod staking {
    use super::*;

    // ========================================================================
    // Admin Instructions
    // ========================================================================

    /// Initialize the global config singleton. Must be called once before
    /// any pools can be created.
    pub fn initialize_global(
        ctx: Context<InitializeGlobal>,
        pause_authority: Pubkey,
        treasury: Pubkey,
    ) -> Result<()> {
        instructions::initialize_global::initialize_global(ctx, pause_authority, treasury)
    }

    /// Create a new staking pool. Only admin can call this.
    pub fn create_pool(
        ctx: Context<CreatePool>,
        pool_id: u64,
        apr_bps: u64,
        lock_duration: i64,
        cooldown_duration: i64,
        deposit_cap: u64,
    ) -> Result<()> {
        instructions::create_pool::create_pool(
            ctx,
            pool_id,
            apr_bps,
            lock_duration,
            cooldown_duration,
            deposit_cap,
        )
    }

    /// Fund a pool with reward tokens and set the emission rate.
    pub fn fund_rewards(
        ctx: Context<FundRewards>,
        amount: u64,
        duration_seconds: u64,
    ) -> Result<()> {
        instructions::fund_rewards::fund_rewards(ctx, amount, duration_seconds)
    }

    /// Update pool parameters. Only admin can call this.
    pub fn update_pool_params(
        ctx: Context<UpdatePoolParams>,
        apr_bps: Option<u64>,
        lock_duration: Option<i64>,
        cooldown_duration: Option<i64>,
        deposit_cap: Option<u64>,
    ) -> Result<()> {
        instructions::update_pool_params::update_pool_params(
            ctx,
            apr_bps,
            lock_duration,
            cooldown_duration,
            deposit_cap,
        )
    }

    /// Pause a pool. Admin or pause authority can call this.
    pub fn pause_pool(ctx: Context<PausePool>) -> Result<()> {
        instructions::pause_pool::pause_pool(ctx)
    }

    /// Unpause a pool. Admin or pause authority can call this.
    pub fn unpause_pool(ctx: Context<PausePool>) -> Result<()> {
        instructions::pause_pool::unpause_pool(ctx)
    }

    // ========================================================================
    // User Instructions
    // ========================================================================

    /// Stake tokens into a pool. Creates UserPosition on first stake.
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        instructions::stake::stake(ctx, amount)
    }

    /// Request to unstake tokens. Starts cooldown period.
    /// Lock duration must have passed since deposit.
    pub fn request_unstake(ctx: Context<RequestUnstake>, amount: u64) -> Result<()> {
        instructions::request_unstake::request_unstake(ctx, amount)
    }

    /// Withdraw unstaked tokens after cooldown has completed.
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        instructions::withdraw::withdraw(ctx)
    }

    /// Claim all accumulated rewards.
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        instructions::claim_rewards::claim_rewards(ctx)
    }

    /// Emergency withdraw: return all tokens, forfeit all rewards.
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        instructions::emergency_withdraw::emergency_withdraw(ctx)
    }
}
