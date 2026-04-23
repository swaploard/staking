import { PublicKey, Connection, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
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

export interface WithdrawPdas {
  pool: PublicKey;
  userPosition: PublicKey;
  userStakeAta: PublicKey;
  stakeVault: PublicKey;
}

export function deriveWithdrawPdas(
  poolId: number,
  user: PublicKey,
  stakeMint: PublicKey,
): WithdrawPdas {
  const [pool] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), poolIdToBuffer(poolId)],
    PROGRAM_ID,
  );

  const [userPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  );

  return { pool, userPosition, userStakeAta: user, stakeVault: user };
}

export interface WithdrawArgs {
  poolId: number;
  stakeMint: PublicKey;
}

export async function withdraw(
  provider: AnchorProvider,
  args: WithdrawArgs,
): Promise<string> {
  const program: Program<Staking> = getProgram(provider);

  const { pool, userPosition } = deriveWithdrawPdas(
    args.poolId,
    provider.wallet.publicKey,
    args.stakeMint,
  );

  const userStakeAta = await getAssociatedTokenAddress(
    args.stakeMint,
    provider.wallet.publicKey,
  );

  const poolAccount = await program.account.pool.fetch(pool);
  const stakeVault = poolAccount.stakeVault;

  const tx = await program.methods
    .withdraw()
    .accountsPartial({
      user: provider.wallet.publicKey,
      pool,
      userPosition,
      userStakeAta,
      stakeVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SYSTEM_PROGRAM_ID,
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

export async function withdrawWithConnection(
  connection: any,
  wallet: any,
  args: WithdrawArgs,
): Promise<string> {
  const provider = createStakeProvider(connection, wallet);
  return withdraw(provider, args);
}