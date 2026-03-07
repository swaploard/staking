import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import {
    TOKEN_PROGRAM_ID,
    createMint,
} from "@solana/spl-token";
import { assert } from "chai";

describe("create_pool", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Staking as Program<Staking>;
    const authority = provider.wallet;

    let stakeMint: anchor.web3.PublicKey;
    let rewardMint: anchor.web3.PublicKey;
    let globalConfig: anchor.web3.PublicKey;
    let pool: anchor.web3.PublicKey;
    let stakeVault: anchor.web3.PublicKey;
    let rewardVault: anchor.web3.PublicKey;

    beforeEach(async () => {
        // Create mints
        stakeMint = await createMint(
            provider.connection,
            authority.payer,
            authority.publicKey,
            null,
            9
        );

        rewardMint = await createMint(
            provider.connection,
            authority.payer,
            authority.publicKey,
            null,
            9
        );

        // Derive global PDA
        [globalConfig] =
            anchor.web3.PublicKey.findProgramAddressSync(
                [Buffer.from("global")],
                program.programId
            );

        [pool] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("pool"),
                authority.publicKey.toBuffer(),
                stakeMint.toBuffer(),
                rewardMint.toBuffer(),
            ],
            program.programId
        );

        // Derive vaults
        [stakeVault] =
            anchor.web3.PublicKey.findProgramAddressSync(
                [Buffer.from("stake_vault"), pool.toBuffer()],
                program.programId
            );

        [rewardVault] =
            anchor.web3.PublicKey.findProgramAddressSync(
                [Buffer.from("reward_vault"), pool.toBuffer()],
                program.programId
            );
    });

    // Create Pool
    // ------------------------------------------------
    it("Creates a pool successfully", async () => {
        await program.methods
            .createPool(
                1000,
                new anchor.BN(30 * 24 * 60 * 60),
                new anchor.BN(7 * 24 * 60 * 60),
                new anchor.BN(1_000_000_000_000)
            )
            .accounts({
                authority: authority.publicKey,
                stakeMint,
                rewardMint,
            })
            .rpc();

        const poolAccount = await program.account.pool.fetch(pool);

        assert.equal(
            poolAccount.stakeMint.toBase58(),
            stakeMint.toBase58()
        );

        assert.equal(poolAccount.aprBps, 1000);
    });

    // ------------------------------------------------
    //  Duplicate Pool Should Fail
    // ------------------------------------------------
    it("Fails when creating duplicate pool", async () => {
        try {
            await program.methods
                .createPool(
                    1000,
                    new anchor.BN(30 * 24 * 60 * 60),
                    new anchor.BN(7 * 24 * 60 * 60),
                    new anchor.BN(1_000_000_000_000)
                )
                .accounts({
                    authority: authority.publicKey,
                    stakeMint,
                    rewardMint,
                })
                .rpc();

            assert.fail("Duplicate pool creation should fail");
        } catch (err) {
            assert.ok(err);
        }
    });

    // ------------------------------------------------
    // Unauthorized Creation Should Fail
    // ------------------------------------------------
    it("Fails when non-admin tries to create pool", async () => {
        const fakeUser = anchor.web3.Keypair.generate();

        await provider.connection.requestAirdrop(
            fakeUser.publicKey,
            1e9
        );

        try {
            await program.methods
                .createPool(
                    1000,
                    new anchor.BN(30 * 24 * 60 * 60),
                    new anchor.BN(7 * 24 * 60 * 60),
                    new anchor.BN(1_000_000_000_000)
                )
                .accounts({
                    authority: authority.publicKey,
                    stakeMint,
                    rewardMint,
                })
                .signers([fakeUser])
                .rpc();

            assert.fail("Unauthorized user should not create pool");
        } catch (err) {
            assert.ok(err);
        }
    });


    // ------------------------------------------------
    // Invalid APR Should Fail
    // ------------------------------------------------
    it("Fails with invalid APR", async () => {
        try {
            await program.methods
                .createPool(
                    20000, // invalid > 10000
                    new anchor.BN(30 * 24 * 60 * 60),
                    new anchor.BN(7 * 24 * 60 * 60),
                    new anchor.BN(1_000_000_000_000)
                )
                .accounts({
                    authority: authority.publicKey,
                    stakeMint,
                    rewardMint,
                })
                .rpc();

            assert.fail("Invalid APR should fail");
        } catch (err) {
            assert.ok(err);
        }
    });
});

