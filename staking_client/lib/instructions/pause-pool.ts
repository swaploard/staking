import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { getProgram } from '../anchor'
import { derivePoolPdas } from './fund-rewards'
import type { Staking } from '../../../target/types/staking'

export interface PausePoolArgs {
    poolId: number
}

export async function pausePool(
    provider: AnchorProvider,
    args: PausePoolArgs,
): Promise<string> {
    const program: Program<Staking> = getProgram(provider)

    const { globalConfig, pool: poolPda } = derivePoolPdas(args.poolId)

    const sig = await program.methods
        .pausePool()
        .accountsPartial({
            authority: provider.wallet.publicKey,
            globalConfig,
            pool: poolPda,
        })
        .rpc()

    return sig
}

export async function unpausePool(
    provider: AnchorProvider,
    args: PausePoolArgs,
): Promise<string> {
    const program: Program<Staking> = getProgram(provider)

    const { globalConfig, pool: poolPda } = derivePoolPdas(args.poolId)

    const sig = await program.methods
        .unpausePool()
        .accountsPartial({
            authority: provider.wallet.publicKey,
            globalConfig,
            pool: poolPda,
        })
        .rpc()

    return sig
}
