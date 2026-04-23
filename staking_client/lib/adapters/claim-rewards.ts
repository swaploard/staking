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

export interface ClaimRewardsPdas {
  pool: PublicKey;
  userPosition: PublicKey;
  userRewardAta: PublicKey;
  rewardVault: PublicKey;
}

export function deriveClaimRewardsPdas(
  poolId: number,
  user: PublicKey,
  rewardMint: PublicKey,
): ClaimRewardsPdas {
  const [pool] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), poolIdToBuffer(poolId)],
    PROGRAM_ID,
  );

  const [userPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  );

  return { pool, userPosition, userRewardAta: user, rewardVault: user };
}

export interface ClaimRewardsArgs {
  poolId: number;
  rewardMint: PublicKey;
}

export async function claimRewards(
  provider: AnchorProvider,
  args: ClaimRewardsArgs,
): Promise<string> {
  const program: Program<Staking> = getProgram(provider);

  const { pool, userPosition } = deriveClaimRewardsPdas(
    args.poolId,
    provider.wallet.publicKey,
    args.rewardMint,
  );

  const userRewardAta = await getAssociatedTokenAddress(
    args.rewardMint,
    provider.wallet.publicKey,
  );

  const poolAccount = await program.account.pool.fetch(pool);
  const rewardVault = poolAccount.rewardVault;

  const tx = await program.methods
    .claimRewards()
    .accountsPartial({
      user: provider.wallet.publicKey,
      pool,
      userPosition,
      userRewardAta,
      rewardVault,
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

export async function claimRewardsWithConnection(
  connection: any,
  wallet: any,
  args: ClaimRewardsArgs,
): Promise<string> {
  const provider = createStakeProvider(connection, wallet);
  return claimRewards(provider, args);
}