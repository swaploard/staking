use crate::errors::ErrorCode;
use crate::state::*;
use anchor_lang::prelude::*;

// ============================================================================
// InitializeGlobal — create the singleton GlobalConfig PDA
// ============================================================================

#[derive(Accounts)]
pub struct InitializeGlobal<'info> {
    /// The deployer / initial admin who pays for account creation
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

    pub system_program: Program<'info, System>,
}

pub fn initialize_global(
    ctx: Context<InitializeGlobal>,
    pause_authority: Pubkey,
    treasury: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.global_config;

    // Version check: since we use `init` (not init_if_needed), Anchor already
    // prevents re-initialization. We set version as an extra safety layer.
    require!(config.version == 0, ErrorCode::AlreadyInitialized);

    config.admin_authority = ctx.accounts.authority.key();
    config.pause_authority = pause_authority;
    config.treasury = treasury;
    config.bump = ctx.bumps.global_config;
    config.version = 1;

    msg!("GlobalConfig initialized. Admin: {}", config.admin_authority);
    Ok(())
}
