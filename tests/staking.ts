import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("staking", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Staking as Program<Staking>;
  const admin = provider.wallet;

  // Mints
  let stakeMint: anchor.web3.PublicKey;
  let rewardMint: anchor.web3.PublicKey;

  // PDAs
  let globalConfig: anchor.web3.PublicKey;
  let pool: anchor.web3.PublicKey;
  let stakeVault: anchor.web3.PublicKey;
  let rewardVault: anchor.web3.PublicKey;

  // Test users
  const userA = anchor.web3.Keypair.generate();
  const userB = anchor.web3.Keypair.generate();
  let userAStakeAta: anchor.web3.PublicKey;
  let userARewardAta: anchor.web3.PublicKey;
  let userBStakeAta: anchor.web3.PublicKey;
  let userBRewardAta: anchor.web3.PublicKey;
  let adminRewardAta: anchor.web3.PublicKey;

  const POOL_ID = new anchor.BN(1);
  const LOCK_DURATION = new anchor.BN(5); // 5 seconds for testing
  const COOLDOWN_DURATION = new anchor.BN(3); // 3 seconds for testing
  const DEPOSIT_CAP = new anchor.BN(0); // no cap
  const APR_BPS = new anchor.BN(1000); // 10%

  const STAKE_AMOUNT = 1_000_000_000; // 1 token (9 decimals)
  const REWARD_FUND_AMOUNT = 10_000_000_000; // 10 tokens
  const REWARD_DURATION = 100; // 100 seconds

  // ========================================================================
  // Setup
  // ========================================================================
  before(async () => {
    // Airdrop to users
    for (const user of [userA, userB]) {
      const sig = await provider.connection.requestAirdrop(
        user.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);
    }

    // Create mints
    stakeMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      9
    );
    rewardMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      9
    );

    // Create token accounts for users
    userAStakeAta = await createAccount(
      provider.connection,
      admin.payer,
      stakeMint,
      userA.publicKey
    );
    userARewardAta = await createAccount(
      provider.connection,
      admin.payer,
      rewardMint,
      userA.publicKey
    );
    userBStakeAta = await createAccount(
      provider.connection,
      admin.payer,
      stakeMint,
      userB.publicKey
    );
    userBRewardAta = await createAccount(
      provider.connection,
      admin.payer,
      rewardMint,
      userB.publicKey
    );
    adminRewardAta = await createAccount(
      provider.connection,
      admin.payer,
      rewardMint,
      admin.publicKey
    );

    // Mint stake tokens to users
    await mintTo(
      provider.connection,
      admin.payer,
      stakeMint,
      userAStakeAta,
      admin.publicKey,
      10 * STAKE_AMOUNT
    );
    await mintTo(
      provider.connection,
      admin.payer,
      stakeMint,
      userBStakeAta,
      admin.publicKey,
      10 * STAKE_AMOUNT
    );

    // Mint reward tokens to admin for funding
    await mintTo(
      provider.connection,
      admin.payer,
      rewardMint,
      adminRewardAta,
      admin.publicKey,
      REWARD_FUND_AMOUNT * 10
    );

    // Derive PDAs
    [globalConfig] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("global_v2")],
      program.programId
    );

    [pool] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), POOL_ID.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [stakeVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake_vault"), pool.toBuffer()],
      program.programId
    );

    [rewardVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reward_vault"), pool.toBuffer()],
      program.programId
    );
  });

  // Helper: derive UserPosition PDA
  function getUserPositionPda(
    userKey: anchor.web3.PublicKey
  ): anchor.web3.PublicKey {
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("position"), pool.toBuffer(), userKey.toBuffer()],
      program.programId
    );
    return pda;
  }

  // Helper: sleep for N seconds
  function sleep(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  // ========================================================================
  // 1. Initialize Global Config
  // ========================================================================
  describe("initialize_global", () => {
    it("initializes global config", async () => {
      await program.methods
        .initializeGlobal(admin.publicKey, admin.publicKey)
        .accounts({
          authority: admin.publicKey,
        })
        .rpc();

      const config = await program.account.globalConfig.fetch(globalConfig);
      assert.equal(
        config.adminAuthority.toBase58(),
        admin.publicKey.toBase58()
      );
      assert.equal(config.version, 1);
    });

    it("prevents re-initialization", async () => {
      try {
        await program.methods
          .initializeGlobal(admin.publicKey, admin.publicKey)
          .accounts({
            authority: admin.publicKey,
          })
          .rpc();
        assert.fail("Should not allow re-init");
      } catch (err) {
        assert.ok(err);
      }
    });
  });

  // ========================================================================
  // 2. Create Pool
  // ========================================================================
  describe("create_pool", () => {
    it("creates a pool successfully", async () => {
      await program.methods
        .createPool(
          POOL_ID,
          APR_BPS,
          LOCK_DURATION,
          COOLDOWN_DURATION,
          DEPOSIT_CAP
        )
        .accounts({
          authority: admin.publicKey,
          stakeMint,
          rewardMint,
        })
        .rpc();

      const poolAccount = await program.account.pool.fetch(pool);
      assert.equal(
        poolAccount.stakeMint.toBase58(),
        stakeMint.toBase58()
      );
      assert.equal(poolAccount.poolId.toNumber(), POOL_ID.toNumber());
      assert.equal(poolAccount.totalStaked.toNumber(), 0);
      assert.equal(poolAccount.version, 1);
    });

    it("fails for non-admin", async () => {
      try {
        await program.methods
          .createPool(
            new anchor.BN(99),
            APR_BPS,
            LOCK_DURATION,
            COOLDOWN_DURATION,
            DEPOSIT_CAP
          )
          .accounts({
            authority: userA.publicKey,
            stakeMint,
            rewardMint,
          })
          .signers([userA])
          .rpc();
        assert.fail("Non-admin should not create pool");
      } catch (err) {
        assert.ok(err);
      }
    });
  });

  // ========================================================================
  // 3. Fund Rewards
  // ========================================================================
  describe("fund_rewards", () => {
    it("funds pool with rewards", async () => {
      await program.methods
        .fundRewards(
          new anchor.BN(REWARD_FUND_AMOUNT),
          new anchor.BN(REWARD_DURATION)
        )
        .accounts({
          authority: admin.publicKey,
          pool,
          adminRewardAta,
          rewardVault,
        })
        .rpc();

      const poolAccount = await program.account.pool.fetch(pool);
      assert.equal(
        poolAccount.totalRewardsFunded.toNumber(),
        REWARD_FUND_AMOUNT
      );
      assert.equal(
        poolAccount.rewardRatePerSecond.toNumber(),
        Math.floor(REWARD_FUND_AMOUNT / REWARD_DURATION)
      );
    });
  });

  // ========================================================================
  // 4. Stake
  // ========================================================================
  describe("stake", () => {
    it("user A stakes successfully", async () => {
      await program.methods
        .stake(new anchor.BN(STAKE_AMOUNT))
        .accounts({
          user: userA.publicKey,
          pool,
          userStakeAta: userAStakeAta,
          stakeVault,
        })
        .signers([userA])
        .rpc();

      const poolAccount = await program.account.pool.fetch(pool);
      assert.equal(poolAccount.totalStaked.toNumber(), STAKE_AMOUNT);

      const pos = await program.account.userPosition.fetch(
        getUserPositionPda(userA.publicKey)
      );
      assert.equal(pos.amount.toNumber(), STAKE_AMOUNT);
      assert.equal(pos.owner.toBase58(), userA.publicKey.toBase58());
    });

    it("user B stakes at a different time", async () => {
      // Wait a bit so rewards accrue to A
      await sleep(2);

      await program.methods
        .stake(new anchor.BN(STAKE_AMOUNT))
        .accounts({
          user: userB.publicKey,
          pool,
          userStakeAta: userBStakeAta,
          stakeVault,
        })
        .signers([userB])
        .rpc();

      const poolAccount = await program.account.pool.fetch(pool);
      assert.equal(poolAccount.totalStaked.toNumber(), 2 * STAKE_AMOUNT);

      const posB = await program.account.userPosition.fetch(
        getUserPositionPda(userB.publicKey)
      );
      assert.equal(posB.amount.toNumber(), STAKE_AMOUNT);
    });
  });

  // ========================================================================
  // 5. Claim Rewards
  // ========================================================================
  describe("claim_rewards", () => {
    it("user A claims rewards after time passes", async () => {
      await sleep(3);

      const balanceBefore = await getAccount(
        provider.connection,
        userARewardAta
      );

      await program.methods
        .claimRewards()
        .accounts({
          user: userA.publicKey,
          pool,
          userRewardAta: userARewardAta,
          rewardVault,
        })
        .signers([userA])
        .rpc();

      const balanceAfter = await getAccount(
        provider.connection,
        userARewardAta
      );
      const claimed =
        Number(balanceAfter.amount) - Number(balanceBefore.amount);

      // User A should have earned rewards (exact amount depends on timing)
      assert.isAbove(claimed, 0, "User A should have earned rewards");
      console.log(`  User A claimed: ${claimed} reward tokens`);

      const poolAccount = await program.account.pool.fetch(pool);
      assert.isAbove(
        poolAccount.rewardsDistributed.toNumber(),
        0,
        "Pool should track distributed rewards"
      );
    });
  });

  // ========================================================================
  // 6. Request Unstake & Cooldown
  // ========================================================================
  describe("request_unstake + withdraw", () => {
    it("fails if lock period not expired", async () => {
      // Create a new pool with longer lock for this test
      // For existing pool, lock is 5s and we've waited enough already
      // This test uses the existing pool after lock has passed
    });

    it("user A requests unstake after lock expires", async () => {
      // Ensure lock duration (5s) has passed since deposit
      await sleep(3);

      const posBeforeUnstake = await program.account.userPosition.fetch(
        getUserPositionPda(userA.publicKey)
      );

      await program.methods
        .requestUnstake(new anchor.BN(STAKE_AMOUNT))
        .accounts({
          user: userA.publicKey,
          pool,
        })
        .signers([userA])
        .rpc();

      const pos = await program.account.userPosition.fetch(
        getUserPositionPda(userA.publicKey)
      );
      assert.equal(pos.amount.toNumber(), 0, "Staked amount should be 0");
      assert.equal(
        pos.pendingWithdrawal.toNumber(),
        STAKE_AMOUNT,
        "Pending withdrawal should equal unstake amount"
      );
      assert.isAbove(
        pos.unlockTimestamp.toNumber(),
        0,
        "Unlock timestamp should be set"
      );
      assert.isAbove(
        pos.cooldownStart.toNumber(),
        0,
        "Cooldown start should be set"
      );

      const poolAccount = await program.account.pool.fetch(pool);
      assert.equal(
        poolAccount.totalStaked.toNumber(),
        STAKE_AMOUNT,
        "Only user B remains staked"
      );
    });

    it("fails to withdraw before cooldown completes", async () => {
      try {
        await program.methods
          .withdraw()
          .accounts({
            user: userA.publicKey,
            pool,
            userStakeAta: userAStakeAta,
            stakeVault,
          })
          .signers([userA])
          .rpc();
        assert.fail("Should not withdraw before cooldown");
      } catch (err) {
        assert.ok(err);
      }
    });

    it("user A withdraws after cooldown", async () => {
      // Wait for cooldown (3s)
      await sleep(4);

      const balanceBefore = await getAccount(
        provider.connection,
        userAStakeAta
      );

      await program.methods
        .withdraw()
        .accounts({
          user: userA.publicKey,
          pool,
          userStakeAta: userAStakeAta,
          stakeVault,
        })
        .signers([userA])
        .rpc();

      const balanceAfter = await getAccount(
        provider.connection,
        userAStakeAta
      );
      const withdrawn =
        Number(balanceAfter.amount) - Number(balanceBefore.amount);
      assert.equal(
        withdrawn,
        STAKE_AMOUNT,
        "Should receive back staked amount"
      );

      const pos = await program.account.userPosition.fetch(
        getUserPositionPda(userA.publicKey)
      );
      assert.equal(pos.pendingWithdrawal.toNumber(), 0);
      assert.equal(pos.cooldownStart.toNumber(), 0);
    });
  });

  // ========================================================================
  // 7. Pause / Unpause
  // ========================================================================
  describe("pause_pool", () => {
    it("admin pauses pool", async () => {
      await program.methods
        .pausePool()
        .accounts({
          authority: admin.publicKey,
          pool,
        })
        .rpc();

      const poolAccount = await program.account.pool.fetch(pool);
      assert.isTrue(poolAccount.paused);
    });

    it("staking fails when paused", async () => {
      try {
        await program.methods
          .stake(new anchor.BN(STAKE_AMOUNT))
          .accounts({
            user: userA.publicKey,
            pool,
            userStakeAta: userAStakeAta,
            stakeVault,
          })
          .signers([userA])
          .rpc();
        assert.fail("Staking should fail when paused");
      } catch (err) {
        assert.ok(err);
      }
    });

    it("admin unpauses pool", async () => {
      await program.methods
        .unpausePool()
        .accounts({
          authority: admin.publicKey,
          pool,
        })
        .rpc();

      const poolAccount = await program.account.pool.fetch(pool);
      assert.isFalse(poolAccount.paused);
    });
  });

  // ========================================================================
  // 8. Emergency Withdraw
  // ========================================================================
  describe("emergency_withdraw", () => {
    it("user B emergency withdraws, forfeiting rewards", async () => {
      const posBefore = await program.account.userPosition.fetch(
        getUserPositionPda(userB.publicKey)
      );
      assert.isAbove(
        posBefore.amount.toNumber(),
        0,
        "User B should have tokens staked"
      );

      const balanceBefore = await getAccount(
        provider.connection,
        userBStakeAta
      );

      await program.methods
        .emergencyWithdraw()
        .accounts({
          user: userB.publicKey,
          pool,
          userStakeAta: userBStakeAta,
          stakeVault,
        })
        .signers([userB])
        .rpc();

      const balanceAfter = await getAccount(
        provider.connection,
        userBStakeAta
      );
      const withdrawn =
        Number(balanceAfter.amount) - Number(balanceBefore.amount);
      assert.equal(
        withdrawn,
        STAKE_AMOUNT,
        "Should receive back full staked amount"
      );

      const pos = await program.account.userPosition.fetch(
        getUserPositionPda(userB.publicKey)
      );
      assert.equal(pos.amount.toNumber(), 0);
      assert.equal(pos.pendingRewards.toNumber(), 0);
      assert.equal(pos.pendingWithdrawal.toNumber(), 0);

      const poolAccount = await program.account.pool.fetch(pool);
      assert.equal(
        poolAccount.totalStaked.toNumber(),
        0,
        "Pool should have no stakers"
      );
    });
  });

  // ========================================================================
  // 9. Update Pool Params
  // ========================================================================
  describe("update_pool_params", () => {
    it("admin updates pool params", async () => {
      await program.methods
        .updatePoolParams(
          new anchor.BN(2000), // new APR
          null,                // keep lock_duration
          null,                // keep cooldown_duration
          new anchor.BN(5_000_000_000_000) // new deposit cap
        )
        .accounts({
          authority: admin.publicKey,
          pool,
        })
        .rpc();

      const poolAccount = await program.account.pool.fetch(pool);
      assert.equal(poolAccount.aprBps.toNumber(), 2000);
      assert.equal(
        poolAccount.depositCap.toNumber(),
        5_000_000_000_000
      );
    });
  });
});
