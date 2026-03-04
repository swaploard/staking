use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

pub use instructions::*;
pub use state::*;

declare_id!("8zcJ4P4TrFNuL3p3BUNXtWP22rfPaVj5CJzMW4exgXen");

#[program]
pub mod staking {
    use super::*;

    pub fn create_pool(
        ctx: Context<CreatePool>,
        apr_bps: u16,
        lock_duration: i64,
        cooldown_duration: i64,
        deposit_cap: u64,
    ) -> Result<()> {
        instructions::create_pool(ctx, apr_bps, lock_duration, cooldown_duration, deposit_cap)?;
        Ok(())
    }
}
