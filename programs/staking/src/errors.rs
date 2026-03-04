use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid APR")]
    InvalidApr,

    #[msg("Invalid cooldown duration")]
    InvalidCooldown,

    #[msg("Invalid lock duration")]
    InvalidLock,
}
