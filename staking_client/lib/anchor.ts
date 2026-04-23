import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
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

export interface AdapterWallet {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
}

class WalletAdapterWallet implements Wallet {
  constructor(
    public publicKey: PublicKey,
    private signFn: (tx: Transaction) => Promise<Transaction>,
    private signAllFn: (txs: Transaction[]) => Promise<Transaction[]>,
  ) {}

  async signTransaction(tx: Transaction): Promise<Transaction> {
    return this.signFn(tx);
  }

  async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    return this.signAllFn(txs);
  }

  async signMessage(msg: Uint8Array): Promise<Uint8Array> {
    throw new Error("signMessage not implemented");
  }
}

export function getProvider(connection: Connection, wallet: AdapterWallet): AnchorProvider {
  const adapterWallet = new WalletAdapterWallet(
    wallet.publicKey,
    wallet.signTransaction.bind(wallet),
    wallet.signAllTransactions.bind(wallet),
  );

  return new AnchorProvider(connection, adapterWallet as Wallet, {
    commitment: 'confirmed',
    skipPreflight: false,
  });
}

export function getProgram(provider: AnchorProvider): Program<Staking> {
  return new Program(
    IDL as Staking,
    provider
  )
}
