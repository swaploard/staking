use trident_fuzz::fuzzing::*;

/// Storage for all account addresses used in fuzz testing.
///
/// This struct serves as a centralized repository for account addresses,
/// enabling their reuse across different instruction flows and test scenarios.
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-api-macro/trident-types/fuzz-accounts/
#[derive(Default)]
pub struct AccountAddresses {
    pub payer: AddressStorage,

    pub authority: AddressStorage,

    pub global_config: AddressStorage,

    pub pool: AddressStorage,

    pub stake_mint: AddressStorage,

    pub reward_mint: AddressStorage,

    pub stake_vault: AddressStorage,

    pub reward_vault: AddressStorage,

    pub token_program: AddressStorage,

    pub system_program: AddressStorage,

    pub rent: AddressStorage,
}
