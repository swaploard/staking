import { PublicKey, Connection, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import {
  getProgram,
  PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
} from "../anchor";
import type { Staking } from "../../../target/types/staking";

export interface StakeWallet {
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

function createStakeProvider(
  connection: Connection,
  wallet: StakeWallet,
): AnchorProvider {
  const adapterWallet = new WalletAdapterWallet(
    wallet.publicKey,
    wallet.signTransaction.bind(wallet),
    wallet.signAllTransactions.bind(wallet),
  );

  return new AnchorProvider(connection, adapterWallet as Wallet, {
    commitment: "confirmed",
    skipPreflight: false,
  });
}

function poolIdToBuffer(poolId: number): Buffer {
  const bn = new BN(poolId);
  return bn.toArrayLike(Buffer, "le", 8);
}

export interface UnstakePdas {
  pool: PublicKey;
  userPosition: PublicKey;
}

export function deriveUnstakePdas(
  poolId: number,
  user: PublicKey,
): UnstakePdas {
  const [pool] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), poolIdToBuffer(poolId)],
    PROGRAM_ID,
  );

  const [userPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  );

  return { pool, userPosition };
}

export interface UnstakeArgs {
  poolId: number;
  amount: number;
}

export async function unstake(
  provider: AnchorProvider,
  args: UnstakeArgs,
): Promise<string> {
  const program: Program<Staking> = getProgram(provider);

  const { pool, userPosition } = deriveUnstakePdas(
    args.poolId,
    provider.wallet.publicKey,
  );

  const tx = await program.methods
    .requestUnstake(new BN(args.amount))
    .accountsPartial({
      user: provider.wallet.publicKey,
      pool,
      userPosition,
    })
    .transaction();

  const { blockhash } = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = provider.wallet.publicKey;

  const originalWallet = (provider as any).wallet;

  const hasFullSupport = originalWallet.sendTransaction && originalWallet.signTransaction;
  const hasSeparateSign = originalWallet.signTransaction && !originalWallet.sendTransaction;

  if (hasFullSupport) {
    try {
      const signature = await originalWallet.sendTransaction(tx, provider.connection, {
        commitment: "confirmed",
      });
      await provider.connection.confirmTransaction(signature, "confirmed");
      return signature;
    } catch (err: any) {
      if (err.message?.includes("disconnected port") || err.message?.includes("Failed to send")) {
        throw new Error("Wallet connection interrupted. Please check if transaction was submitted and try again if it wasn't.");
      }
      throw err;
    }
  }

  if (hasSeparateSign) {
    try {
      const signedTx = await originalWallet.signTransaction(tx);
      const signature = await provider.connection.sendTransaction(signedTx, [], {
        commitment: "confirmed",
      });
      await provider.connection.confirmTransaction(signature, "confirmed");
      return signature;
    } catch (err: any) {
      throw new Error(`Transaction failed: ${err.message || err}`);
    }
  }

  throw new Error("Wallet does not support signTransaction");
}

export async function unstakeWithConnection(
  connection: any,
  wallet: any,
  args: UnstakeArgs,
): Promise<string> {
  const provider = createStakeProvider(connection, wallet);
  return unstake(provider, args);
}