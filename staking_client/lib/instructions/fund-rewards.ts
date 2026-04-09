import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import { getProgram, PROGRAM_ID, TOKEN_PROGRAM_ID } from '../anchor'
import type { Staking } from '../../../target/types/staking'

// ============================================================================
// PDA derivation
// ============================================================================

export interface PoolPdas {
    globalConfig: PublicKey
    pool: PublicKey
    stakeVault: PublicKey
    rewardVault: PublicKey
}

/**
 * Encode a u64 pool_id as an 8-byte little-endian buffer (matches Rust's to_le_bytes()).
 * Uses BN to avoid BigInt literals so this works with any TS target >= ES2015.
 */
function poolIdToBuffer(poolId: number): Buffer {
    const bn = new BN(poolId)
    // BN.toArrayLike returns a Buffer in the requested byte-order
    return bn.toArrayLike(Buffer, 'le', 8)
}

/**
 * Derive all PDAs required by the fund_rewards instruction.
 * Returns live public keys as soon as a valid numeric poolId is provided.
 */
export function derivePoolPdas(poolId: number): PoolPdas {
    // seeds: ["global_v2"]
    const [globalConfig, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_v2')],
        PROGRAM_ID,
    )

    console.log("GlobalConfig PDA:", globalConfig.toBase58(), "Bump:", bump)
    // seeds: ["pool", pool_id.to_le_bytes()]  (u64 little-endian)
    const [pool] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool'), poolIdToBuffer(poolId)],
        PROGRAM_ID,
    )

    // seeds: ["stake_vault", pool]
    const [stakeVault] = PublicKey.findProgramAddressSync(
        [Buffer.from('stake_vault'), pool.toBuffer()],
        PROGRAM_ID,
    )

    // seeds: ["reward_vault", pool]
    const [rewardVault] = PublicKey.findProgramAddressSync(
        [Buffer.from('reward_vault'), pool.toBuffer()],
        PROGRAM_ID,
    )

    return { globalConfig, pool, stakeVault, rewardVault }
}

// ============================================================================
// fund_rewards instruction
// ============================================================================

export interface FundRewardsArgs {
    poolId: number            // u64 in Rust — safe as JS number up to 2^53
    amount: number            // u64, amount of reward tokens to fund
    durationSeconds: number   // u64, duration over which to emit rewards
}

/**
 * Build and send the fund_rewards instruction on-chain via Anchor.
 * The connected wallet (provider.wallet) must be the admin_authority in GlobalConfig.
 *
 * @returns confirmed transaction signature
 */
export async function fundRewards(
    provider: AnchorProvider,
    args: FundRewardsArgs,
): Promise<string> {
    const program: Program<Staking> = getProgram(provider)

    const { globalConfig, pool: poolPda } = derivePoolPdas(args.poolId)

    // Fetch pool data to get reward_mint
    const poolAccount = await program.account.pool.fetch(poolPda)
    const rewardMint = poolAccount.rewardMint

    // Derive admin's associated token account for the reward mint
    const adminRewardAta = await getAssociatedTokenAddress(
        rewardMint,
        provider.wallet.publicKey
    )

    const sig = await program.methods
        .fundRewards(
            new BN(args.amount),
            new BN(args.durationSeconds),
        )
        .accountsPartial({
            authority: provider.wallet.publicKey,
            globalConfig,
            pool: poolPda,
            adminRewardAta,
            rewardVault: poolAccount.rewardVault,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()

    return sig
}