import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Connection, PublicKey } from '@solana/web3.js'
import { AnchorWallet } from '@solana/wallet-adapter-react'
import type { Staking } from '../../target/types/staking'
import IDL from '../../target/idl/staking.json'

// ============================================================================
// Program constants
// ============================================================================

export const PROGRAM_ID = new PublicKey('8iVfFoXD5THP7XJKwSDGEyK72Basc983p8fDpzUK9brN')

// Well-known Solana program IDs
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
export const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111')
export const RENT_SYSVAR_ID = new PublicKey('SysvarRent111111111111111111111111111111111')

// ============================================================================
// Provider / Program helpers
// ============================================================================

/**
 * Build an AnchorProvider from a web3.js Connection + wallet adapter wallet.
 * Call this inside a client component that has access to useConnection() and useAnchorWallet().
 */
export function getProvider(connection: Connection, wallet: AnchorWallet): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })
}

/**
 * Return a typed Anchor Program instance for the staking program.
 */
export function getProgram(provider: AnchorProvider): Program<Staking> {
  return new Program(
    IDL as Staking,
    provider
  )
}
