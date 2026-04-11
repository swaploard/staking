use crate::errors::ErrorCode;
use crate::events::RewardsClaimed;
use crate::state::*;
use crate::utils::{self, PRECISION};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

// ============================================================================
// ClaimRewards — user claims accumulated rewards
//
// Mutation order:
// 1. update_pool()
// 2. calculate pending from accumulator
// 3. add to pending_rewards
// 4. validate total distributed won't exceed funded
// 5. transfer from reward_vault → user
// 6. reset pending_rewards, update reward_debt
// ============================================================================

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool.pool_id.to_le_bytes().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [b"position", pool.key().as_ref(), user.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.owner == user.key() @ ErrorCode::Unauthorized,
        constraint = user_position.pool == pool.key() @ ErrorCode::Unauthorized,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// User's reward token account (destination)
    #[account(
        mut,
        constraint = user_reward_ata.mint == pool.reward_mint,
        constraint = user_reward_ata.owner == user.key(),
    )]
    pub user_reward_ata: Account<'info, TokenAccount>,

    /// Pool's reward vault (source, authority = pool PDA)
    #[account(
        mut,
        constraint = reward_vault.key() == pool.reward_vault,
        constraint = reward_vault.mint == pool.reward_mint,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
    // Extract AccountInfo and constants BEFORE taking mutable borrows,
    // to satisfy the borrow checker for CPI calls.
    let pool_account_info = ctx.accounts.pool.to_account_info();
    let reward_vault_info = ctx.accounts.reward_vault.to_account_info();
    let user_reward_ata_info = ctx.accounts.user_reward_ata.to_account_info();
    let token_program_info = ctx.accounts.token_program.to_account_info();

    let pool = &mut ctx.accounts.pool;
    let user_position = &mut ctx.accounts.user_position;

    // 0. Safety
    utils::assert_not_paused(pool)?;

    // 1. Update pool accumulator
    let now = Clock::get()?.unix_timestamp;
    utils::update_pool(pool, now)?;

    // 2. Calculate new pending from accumulator
    let new_pending = utils::calculate_pending(user_position, pool.acc_reward_per_share)?;

    // 3. Total claimable = previously accumulated + new
    let total_claimable = user_position
        .pending_rewards
        .checked_add(new_pending)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(total_claimable > 0, ErrorCode::NoPendingRewards);

    // 4. Reward cap protection: don't exceed funded amount
    let new_distributed = pool
        .rewards_distributed
        .checked_add(total_claimable)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(
        new_distributed <= pool.total_rewards_funded,
        ErrorCode::InsufficientRewards
    );

    // 5. Transfer from reward vault → user via PDA signer
    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let seeds: &[&[u8]] = &[b"pool", pool_id_bytes.as_ref(), &[pool.bump]];
    let signer_seeds = &[seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        token_program_info,
        Transfer {
            from: reward_vault_info,
            to: user_reward_ata_info,
            authority: pool_account_info,
        },
        signer_seeds,
    );
    token::transfer(cpi_ctx, total_claimable)?;

    // 6. Update accounting
    pool.rewards_distributed = new_distributed;
    user_position.pending_rewards = 0;

    // Recalculate reward_debt for current accumulator state
    user_position.reward_debt = (user_position.amount as u128)
        .checked_mul(pool.acc_reward_per_share)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(PRECISION)
        .ok_or(ErrorCode::MathOverflow)?;

    emit!(RewardsClaimed {
        pool: pool.key(),
        pool_id: pool.pool_id,
        user: user_position.owner,
        claimed_amount: total_claimable,
        total_rewards_distributed_after: pool.rewards_distributed,
        timestamp: now,
    });

    msg!(
        "User {} claimed {} reward tokens from pool {}",
        user_position.owner, total_claimable, pool.pool_id
    );
    Ok(())
}
