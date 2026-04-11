use crate::errors::ErrorCode;
use crate::events::PoolPauseToggled;
use crate::state::*;
use anchor_lang::prelude::*;

// ============================================================================
// PausePool / UnpausePool — emergency pause mechanism
//
// Either admin_authority or pause_authority can pause/unpause.
// ============================================================================

#[derive(Accounts)]
pub struct PausePool<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"global_v2"],
        bump = global_config.bump,
        constraint = (
            global_config.admin_authority == authority.key() ||
            global_config.pause_authority == authority.key()
        ) @ ErrorCode::Unauthorized,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"pool", pool.pool_id.to_le_bytes().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,
}

pub fn pause_pool(ctx: Context<PausePool>) -> Result<()> {
    ctx.accounts.pool.paused = true;

    emit!(PoolPauseToggled {
        pool: ctx.accounts.pool.key(),
        pool_id: ctx.accounts.pool.pool_id,
        authority: ctx.accounts.authority.key(),
        is_paused: true,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Pool {} paused", ctx.accounts.pool.pool_id);
    Ok(())
}

pub fn unpause_pool(ctx: Context<PausePool>) -> Result<()> {
    ctx.accounts.pool.paused = false;

    emit!(PoolPauseToggled {
        pool: ctx.accounts.pool.key(),
        pool_id: ctx.accounts.pool.pool_id,
        authority: ctx.accounts.authority.key(),
        is_paused: false,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Pool {} unpaused", ctx.accounts.pool.pool_id);
    Ok(())
}
