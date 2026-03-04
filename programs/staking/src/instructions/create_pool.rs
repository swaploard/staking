use crate::errors::ErrorCode;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [b"global"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + Pool::INIT_SPACE,
        seeds = [
        b"pool",
        authority.key().as_ref(),
        stake_mint.key().as_ref(),
        reward_mint.key().as_ref()
    ],
        bump
    )]
    pub pool: Account<'info, Pool>,

    pub stake_mint: Account<'info, token::Mint>,
    pub reward_mint: Account<'info, token::Mint>,

    #[account(
        init,
        seeds = [
            b"stake_vault".as_ref(),
            pool.key().as_ref(),
        ],
        bump,
        payer = authority,
        token::mint = stake_mint,
        token::authority = pool
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        seeds = [
            b"reward_vault".as_ref(),
            pool.key().as_ref(),
        ],
        bump,
        payer = authority,
        token::mint = reward_mint,
        token::authority = pool
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_pool(
    ctx: Context<CreatePool>,
    apr_bps: u16,
    lock_duration: i64,
    cooldown_duration: i64,
    deposit_cap: u64,
) -> Result<()> {
    // -------- Safety Checks --------

    require!(apr_bps <= 10_000, ErrorCode::InvalidApr);
    require!(cooldown_duration > 0, ErrorCode::InvalidCooldown);
    require!(lock_duration >= 0, ErrorCode::InvalidLock);

    let pool = &mut ctx.accounts.pool;

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
    pool.reward_rate_per_second = 0; // set later via FundRewards
    pool.total_rewards_funded = 0;

    // -------- Metadata --------

    pool.bump = ctx.bumps.pool;
    pool.version = 1;

    Ok(())
}
