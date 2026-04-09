use crate::errors::ErrorCode;
use crate::state::*;
use crate::utils;
use anchor_lang::prelude::*;

// ============================================================================
// UpdatePoolParams — admin updates pool configuration
//
// Always checkpoints the accumulator before changing parameters.
// ============================================================================

#[derive(Accounts)]
pub struct UpdatePoolParams<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"global_v2"],
        bump = global_config.bump,
        constraint = global_config.admin_authority == authority.key() @ ErrorCode::Unauthorized,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"pool", pool.pool_id.to_le_bytes().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,
}

pub fn update_pool_params(
    ctx: Context<UpdatePoolParams>,
    apr_bps: Option<u64>,
    lock_duration: Option<i64>,
    cooldown_duration: Option<i64>,
    deposit_cap: Option<u64>,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Checkpoint accumulator before changing any parameters
    let now = Clock::get()?.unix_timestamp;
    utils::update_pool(pool, now)?;

    // Apply updates (only modify provided fields)
    if let Some(apr) = apr_bps {
        require!(apr <= 10_000, ErrorCode::InvalidApr);
        pool.apr_bps = apr;
    }

    if let Some(lock) = lock_duration {
        require!(lock >= 0, ErrorCode::InvalidLock);
        pool.lock_duration = lock;
    }

    if let Some(cooldown) = cooldown_duration {
        require!(cooldown > 0, ErrorCode::InvalidCooldown);
        pool.cooldown_duration = cooldown;
    }

    if let Some(cap) = deposit_cap {
        pool.deposit_cap = cap;
    }

    msg!("Pool {} params updated", pool.pool_id);
    Ok(())
}
