use fuzz_accounts::*;
use trident_fuzz::fuzzing::*;
mod fuzz_accounts;
mod types;
use types::*;

use staking::CreatePoolInstruction;
use staking::CreatePoolInstructionAccounts;
use staking::CreatePoolInstructionData;

#[derive(FuzzTestMethods)]
struct FuzzTest {
    trident: Trident,
    fuzz_accounts: AccountAddresses,
}

#[flow_executor]
impl FuzzTest {
    fn new() -> Self {
        Self {
            trident: Trident::default(),
            fuzz_accounts: AccountAddresses::default(),
        }
    }

    #[init]
    fn start(&mut self) {
        // Fund the payer so it can pay for account creation
        let payer = self.fuzz_accounts.payer.insert(&mut self.trident, None);
        self.trident.airdrop(&payer, 100 * LAMPORTS_PER_SOL);
    }

    // -----------------------------------------------------------------------
    // Helper: set up mints and derive all PDAs needed for CreatePool
    // -----------------------------------------------------------------------
    fn setup_create_pool(
        &mut self,
    ) -> (
        Pubkey, // authority (= payer)
        Pubkey, // stake_mint
        Pubkey, // reward_mint
        Pubkey, // global_config PDA
        Pubkey, // pool PDA
        Pubkey, // stake_vault PDA
        Pubkey, // reward_vault PDA
    ) {
        let program_id = staking::program_id();

        let authority = self
            .fuzz_accounts
            .payer
            .get(&mut self.trident)
            .expect("payer not initialised");

        // Create fresh mints for each flow invocation
        let stake_mint = self.fuzz_accounts.stake_mint.insert(&mut self.trident, None);
        let reward_mint = self.fuzz_accounts.reward_mint.insert(&mut self.trident, None);

        let mint_ixs = self.trident.initialize_mint(
            &authority,
            &stake_mint,
            9,
            &authority,
            None,
        );
        let res = self
            .trident
            .process_transaction(&mint_ixs, Some("init stake_mint"));
        assert!(res.is_success(), "stake_mint init failed: {:#?}", res.get_result());

        let mint_ixs = self.trident.initialize_mint(
            &authority,
            &reward_mint,
            9,
            &authority,
            None,
        );
        let res = self
            .trident
            .process_transaction(&mint_ixs, Some("init reward_mint"));
        assert!(res.is_success(), "reward_mint init failed: {:#?}", res.get_result());

        // Derive PDAs
        let (global_config, _) =
            self.trident.find_program_address(&[b"global"], &program_id);

        let (pool, _) = self.trident.find_program_address(
            &[
                b"pool",
                authority.as_ref(),
                stake_mint.as_ref(),
                reward_mint.as_ref(),
            ],
            &program_id,
        );

        let (stake_vault, _) = self.trident.find_program_address(
            &[b"stake_vault", pool.as_ref()],
            &program_id,
        );

        let (reward_vault, _) = self.trident.find_program_address(
            &[b"reward_vault", pool.as_ref()],
            &program_id,
        );

        (
            authority,
            stake_mint,
            reward_mint,
            global_config,
            pool,
            stake_vault,
            reward_vault,
        )
    }

    /// Build the CreatePool instruction from accounts + data
    fn build_create_pool_ix(
        &self,
        authority: Pubkey,
        global_config: Pubkey,
        pool: Pubkey,
        stake_mint: Pubkey,
        reward_mint: Pubkey,
        stake_vault: Pubkey,
        reward_vault: Pubkey,
        data: CreatePoolInstructionData,
    ) -> Instruction {
        CreatePoolInstruction::data(data)
            .accounts(CreatePoolInstructionAccounts::new(
                authority,
                global_config,
                pool,
                stake_mint,
                reward_mint,
                stake_vault,
                reward_vault,
            ))
            .instruction()
    }

    // =======================================================================
    //  FUZZ FLOWS
    // =======================================================================

    /// Happy-path: create a pool with random but valid parameters and verify
    /// the on-chain Pool account stores the correct values.
    #[flow]
    fn create_pool_valid(&mut self) {
        let (authority, stake_mint, reward_mint, global_config, pool, stake_vault, reward_vault) =
            self.setup_create_pool();

        // Generate valid fuzzed parameters
        let apr_bps: u16 = self.trident.random_from_range(0..=10_000u16);
        let lock_duration: i64 = self.trident.random_from_range(0..=365 * 86400i64);
        let cooldown_duration: i64 = self.trident.random_from_range(1..=30 * 86400i64);
        let deposit_cap: u64 = self.trident.random_from_range(1..=u64::MAX);

        let data = CreatePoolInstructionData::new(
            apr_bps,
            lock_duration,
            cooldown_duration,
            deposit_cap,
        );

        let ix = self.build_create_pool_ix(
            authority,
            global_config,
            pool,
            stake_mint,
            reward_mint,
            stake_vault,
            reward_vault,
            data,
        );

        let res = self
            .trident
            .process_transaction(&[ix], Some("create_pool_valid"));
        assert!(
            res.is_success(),
            "create_pool_valid failed: {:#?}",
            res.get_result()
        );

        // ---- Verify on-chain state ----
        if let Some(pool_data) = self
            .trident
            .get_account_with_type::<Pool>(&pool, 8)
        {
            assert_eq!(pool_data.apr_bps, apr_bps, "apr_bps mismatch");
            assert_eq!(pool_data.lock_duration, lock_duration, "lock_duration mismatch");
            assert_eq!(
                pool_data.cooldown_duration, cooldown_duration,
                "cooldown_duration mismatch"
            );
            assert_eq!(pool_data.deposit_cap, deposit_cap, "deposit_cap mismatch");
            assert_eq!(pool_data.stake_mint, stake_mint, "stake_mint mismatch");
            assert_eq!(pool_data.reward_mint, reward_mint, "reward_mint mismatch");
            assert_eq!(pool_data.total_staked, 0, "total_staked should be 0");
            assert!(!pool_data.paused, "pool should not be paused");
            assert_eq!(pool_data.version, 1, "version should be 1");
        }
    }

    /// Test boundary / edge-case parameter values that should still succeed.
    #[flow]
    fn create_pool_boundary_values(&mut self) {
        let (authority, stake_mint, reward_mint, global_config, pool, stake_vault, reward_vault) =
            self.setup_create_pool();

        // Extreme but valid values
        let apr_bps: u16 = if self.trident.random_bool() { 0 } else { 10_000 };
        let lock_duration: i64 = 0; // minimum valid
        let cooldown_duration: i64 = 1; // minimum valid
        let deposit_cap: u64 = u64::MAX; // maximum possible

        let data = CreatePoolInstructionData::new(
            apr_bps,
            lock_duration,
            cooldown_duration,
            deposit_cap,
        );

        let ix = self.build_create_pool_ix(
            authority,
            global_config,
            pool,
            stake_mint,
            reward_mint,
            stake_vault,
            reward_vault,
            data,
        );

        let res = self
            .trident
            .process_transaction(&[ix], Some("create_pool_boundary"));
        assert!(
            res.is_success(),
            "create_pool_boundary failed: {:#?}",
            res.get_result()
        );
    }

    /// Negative test: apr_bps > 10_000 must be rejected by the program.
    #[flow]
    fn create_pool_invalid_apr(&mut self) {
        let (authority, stake_mint, reward_mint, global_config, pool, stake_vault, reward_vault) =
            self.setup_create_pool();

        let apr_bps: u16 = self.trident.random_from_range(10_001..=u16::MAX);
        let lock_duration: i64 = self.trident.random_from_range(0..=86400i64);
        let cooldown_duration: i64 = self.trident.random_from_range(1..=86400i64);
        let deposit_cap: u64 = self.trident.random_from_range(1..=1_000_000u64);

        let data = CreatePoolInstructionData::new(
            apr_bps,
            lock_duration,
            cooldown_duration,
            deposit_cap,
        );

        let ix = self.build_create_pool_ix(
            authority,
            global_config,
            pool,
            stake_mint,
            reward_mint,
            stake_vault,
            reward_vault,
            data,
        );

        let res = self
            .trident
            .process_transaction(&[ix], Some("create_pool_invalid_apr"));
        assert!(
            !res.is_success(),
            "create_pool should reject apr_bps={} (> 10_000)",
            apr_bps
        );
    }

    /// Negative test: cooldown_duration == 0 must be rejected.
    #[flow]
    fn create_pool_invalid_cooldown(&mut self) {
        let (authority, stake_mint, reward_mint, global_config, pool, stake_vault, reward_vault) =
            self.setup_create_pool();

        let apr_bps: u16 = self.trident.random_from_range(0..=10_000u16);
        let lock_duration: i64 = self.trident.random_from_range(0..=86400i64);
        let cooldown_duration: i64 = 0; // invalid — must be > 0
        let deposit_cap: u64 = self.trident.random_from_range(1..=1_000_000u64);

        let data = CreatePoolInstructionData::new(
            apr_bps,
            lock_duration,
            cooldown_duration,
            deposit_cap,
        );

        let ix = self.build_create_pool_ix(
            authority,
            global_config,
            pool,
            stake_mint,
            reward_mint,
            stake_vault,
            reward_vault,
            data,
        );

        let res = self
            .trident
            .process_transaction(&[ix], Some("create_pool_invalid_cooldown"));
        assert!(
            !res.is_success(),
            "create_pool should reject cooldown_duration=0"
        );
    }

    /// Negative test: negative lock_duration must be rejected.
    #[flow]
    fn create_pool_invalid_lock(&mut self) {
        let (authority, stake_mint, reward_mint, global_config, pool, stake_vault, reward_vault) =
            self.setup_create_pool();

        let apr_bps: u16 = self.trident.random_from_range(0..=10_000u16);
        let lock_duration: i64 = self.trident.random_from_range(i64::MIN..=-1i64); // negative
        let cooldown_duration: i64 = self.trident.random_from_range(1..=86400i64);
        let deposit_cap: u64 = self.trident.random_from_range(1..=1_000_000u64);

        let data = CreatePoolInstructionData::new(
            apr_bps,
            lock_duration,
            cooldown_duration,
            deposit_cap,
        );

        let ix = self.build_create_pool_ix(
            authority,
            global_config,
            pool,
            stake_mint,
            reward_mint,
            stake_vault,
            reward_vault,
            data,
        );

        let res = self
            .trident
            .process_transaction(&[ix], Some("create_pool_invalid_lock"));
        assert!(
            !res.is_success(),
            "create_pool should reject negative lock_duration={}",
            lock_duration
        );
    }

    #[end]
    fn end(&mut self) {
        // cleanup at end of each iteration
    }
}

fn main() {
    // iterations, max flows per iteration
    FuzzTest::fuzz(1000, 100);
}
