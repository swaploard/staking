use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // ---- Validation ----
    #[msg("Invalid APR: must be <= 10_000 bps")]
    InvalidApr,

    #[msg("Invalid cooldown duration: must be > 0")]
    InvalidCooldown,

    #[msg("Invalid lock duration: must be >= 0")]
    InvalidLock,

    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    // ---- Access Control ----
    #[msg("Unauthorized: signer is not the required authority")]
    Unauthorized,

    #[msg("Account already initialized")]
    AlreadyInitialized,

    // ---- Pool State ----
    #[msg("Pool is paused")]
    PoolPaused,

    #[msg("Deposit cap exceeded")]
    DepositCapExceeded,

    // ---- Staking / Unstaking ----
    #[msg("Insufficient staked balance")]
    InsufficientStake,

    #[msg("Lock period has not expired")]
    LockNotExpired,

    #[msg("Cooldown period has not completed")]
    CooldownNotComplete,

    #[msg("No active cooldown to withdraw")]
    NoCooldownActive,

    #[msg("No pending withdrawal")]
    NoPendingWithdrawal,

    // ---- Rewards ----
    #[msg("Insufficient rewards in vault")]
    InsufficientRewards,

    #[msg("No pending rewards to claim")]
    NoPendingRewards,

    // ---- Math Safety ----
    #[msg("Math overflow")]
    MathOverflow,

    #[msg("Invalid timestamp: clock moved backwards")]
    InvalidTimestamp,
}
