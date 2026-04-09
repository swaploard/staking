import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { getProgram, PROGRAM_ID, TOKEN_PROGRAM_ID, SYSTEM_PROGRAM_ID, RENT_SYSVAR_ID } from '../anchor'
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
 * Derive all PDAs required by the create_pool instruction.
 * Returns live public keys as soon as a valid numeric poolId is provided.
 */
export function derivePoolPdas(poolId: number): PoolPdas {
  // seeds: ["global_v2"]
  const [globalConfig, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_v2')],
    PROGRAM_ID,
  )

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
// create_pool instruction
// ============================================================================

export interface CreatePoolArgs {
  poolId: number            // u64 in Rust — safe as JS number up to 2^53
  stakeMint: PublicKey
  rewardMint: PublicKey
  aprBps: number            // u64, max 10_000
  lockDuration: number      // i64, seconds >= 0
  cooldownDuration: number  // i64, seconds > 0
  depositCap: number        // u64, 0 = no cap
}

/**
 * Build and send the create_pool instruction on-chain via Anchor.
 * The connected wallet (provider.wallet) must be the admin_authority in GlobalConfig.
 *
 * @returns confirmed transaction signature
 */
export async function createPool(
  provider: AnchorProvider,
  args: CreatePoolArgs,
): Promise<string> {
  const program: Program<Staking> = getProgram(provider)

  const { globalConfig, pool, stakeVault, rewardVault } = derivePoolPdas(args.poolId)

  const sig = await program.methods
    .createPool(
      new BN(args.poolId),
      new BN(args.aprBps),
      new BN(args.lockDuration),
      new BN(args.cooldownDuration),
      new BN(args.depositCap),
    )
    .accountsPartial({
      authority: provider.wallet.publicKey,
      globalConfig,
      pool,
      stakeMint: args.stakeMint,
      rewardMint: args.rewardMint,
      stakeVault,
      rewardVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SYSTEM_PROGRAM_ID,
      rent: RENT_SYSVAR_ID,
    })
    .rpc()

  return sig
}
