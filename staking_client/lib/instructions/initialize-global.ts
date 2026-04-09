import { PublicKey } from '@solana/web3.js'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { getProgram, PROGRAM_ID, SYSTEM_PROGRAM_ID } from '../anchor'
import type { Staking } from '../../../target/types/staking'

// ============================================================================
// PDA derivation for global config
// ============================================================================

/**
 * Derive the GlobalConfig PDA.
 */
export function deriveGlobalConfig(): PublicKey {
    const [globalConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from('global')],
        PROGRAM_ID,
    )
    return globalConfig
}

// ============================================================================
// initialize_global instruction
// ============================================================================

export interface InitializeGlobalArgs {
    pauseAuthority: PublicKey
    treasury: PublicKey
}

/**
 * Build and send the initialize_global instruction on-chain via Anchor.
 * This must be called once before creating any pools.
 *
 * @returns confirmed transaction signature
 */
export async function initializeGlobal(
    provider: AnchorProvider,
    args: InitializeGlobalArgs,
): Promise<string> {
    const program: Program<Staking> = getProgram(provider)

    const globalConfig = deriveGlobalConfig()

    const sig = await program.methods
        .initializeGlobal(args.pauseAuthority, args.treasury)
        .accountsPartial({
            authority: provider.wallet.publicKey,
            globalConfig,
            systemProgram: SYSTEM_PROGRAM_ID,
        })
        .rpc()

    return sig
}