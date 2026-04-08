use crate::errors::ErrorCode;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

// ============================================================================
// CreatePool — admin creates a new staking pool
//
// PDA seeds: ["pool", pool_id.to_le_bytes()]
// Vaults are PDAs owned by the pool PDA.
// ============================================================================

#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct CreatePool<'info> {
    /// Admin authority — must match global_config.admin_authority
    #[account(mut)]
    pub authority: Signer<'info>,

    /// GlobalConfig must already be initialized
    #[account(
        seeds = [b"global_v2"],
        bump = global_config.bump,
        constraint = global_config.version > 0,
        constraint = global_config.admin_authority == authority.key() @ ErrorCode::Unauthorized,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    /// The new pool account
    #[account(
        init,
        payer = authority,
        space = 8 + Pool::INIT_SPACE,
        seeds = [b"pool", pool_id.to_le_bytes().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,

    /// Mint of the token users will stake
    pub stake_mint: Account<'info, token::Mint>,
    /// Mint of the token distributed as rewards
    pub reward_mint: Account<'info, token::Mint>,

    /// Vault to hold staked tokens, authority = pool PDA
    #[account(
        init,
        seeds = [b"stake_vault", pool.key().as_ref()],
        bump,
        payer = authority,
        token::mint = stake_mint,
        token::authority = pool,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    /// Vault to hold reward tokens, authority = pool PDA
    #[account(
        init,
        seeds = [b"reward_vault", pool.key().as_ref()],
        bump,
        payer = authority,
        token::mint = reward_mint,
        token::authority = pool,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_pool(
    ctx: Context<CreatePool>,
    pool_id: u64,
    apr_bps: u64,
    lock_duration: i64,
    cooldown_duration: i64,
    deposit_cap: u64,
) -> Result<()> {
    // -------- Validation --------
    require!(apr_bps <= 10_000, ErrorCode::InvalidApr);
    require!(cooldown_duration > 0, ErrorCode::InvalidCooldown);
    require!(lock_duration >= 0, ErrorCode::InvalidLock);

    let pool = &mut ctx.accounts.pool;

    // -------- Identity --------
    pool.pool_id = pool_id;

    // -------- Config --------
    pool.stake_mint = ctx.accounts.stake_mint.key();
    pool.reward_mint = ctx.accounts.reward_mint.key();
    pool.stake_vault = ctx.accounts.stake_vault.key();
    pool.reward_vault = ctx.accounts.reward_vault.key();

    pool.apr_bps = apr_bps;
    pool.lock_duration = lock_duration;
    pool.cooldown_duration = cooldown_duration;
    pool.deposit_cap = deposit_cap;
    pool.paused = false;

    // -------- Accounting --------
    pool.total_staked = 0;
    pool.acc_reward_per_share = 0;
    pool.last_update_timestamp = Clock::get()?.unix_timestamp;
    pool.reward_rate_per_second = 0; // set by fund_rewards
    pool.total_rewards_funded = 0;
    pool.rewards_distributed = 0;

    // -------- Safety --------
    pool.bump = ctx.bumps.pool;
    pool.version = 1;

    msg!("Pool {} created. Stake: {}, Reward: {}", pool_id,
         pool.stake_mint, pool.reward_mint);
    Ok(())
}
