use crate::errors::ErrorCode;
use crate::state::*;
use crate::utils;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

// ============================================================================
// FundRewards — admin deposits reward tokens and sets emission rate
//
// reward_rate_per_second = amount / duration_seconds
// This is the only way to set the emission rate. APR is UI-only metadata.
// ============================================================================

#[derive(Accounts)]
pub struct FundRewards<'info> {
    /// Admin authority
    #[account(mut)]
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

    /// Admin's reward token account (source)
    #[account(
        mut,
        constraint = admin_reward_ata.mint == pool.reward_mint,
        constraint = admin_reward_ata.owner == authority.key(),
    )]
    pub admin_reward_ata: Account<'info, TokenAccount>,

    /// Pool's reward vault (destination, authority = pool PDA)
    #[account(
        mut,
        constraint = reward_vault.key() == pool.reward_vault,
        constraint = reward_vault.mint == pool.reward_mint,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn fund_rewards(
    ctx: Context<FundRewards>,
    amount: u64,
    duration_seconds: u64,
) -> Result<()> {
    require!(amount > 0, ErrorCode::ZeroAmount);
    require!(duration_seconds > 0, ErrorCode::InvalidCooldown);

    let pool = &mut ctx.accounts.pool;

    // Update pool accumulator before changing reward rate
    let now = Clock::get()?.unix_timestamp;
    utils::update_pool(pool, now)?;

    // Transfer reward tokens from admin to vault
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.admin_reward_ata.to_account_info(),
            to: ctx.accounts.reward_vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, amount)?;

    // Update pool accounting
    pool.total_rewards_funded = pool
        .total_rewards_funded
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    // Set new emission rate
    pool.reward_rate_per_second = amount
        .checked_div(duration_seconds)
        .ok_or(ErrorCode::MathOverflow)?;

    msg!(
        "Pool {} funded with {} tokens over {} seconds. Rate: {}/s",
        pool.pool_id, amount, duration_seconds, pool.reward_rate_per_second
    );
    Ok(())
}
