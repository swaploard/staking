import {
  PublicKey,
  Connection,
  Transaction,
  TransactionInstruction,
  Signer,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import BN from "bn.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAccount,
  getAssociatedTokenAddress,
  NATIVE_MINT,
} from "@solana/spl-token";
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

export interface StakeConnection {
  sendTransaction: (tx: Transaction, ...signers: Signer[]) => Promise<string>;
  confirmTransaction: (
    tx: Transaction,
    ...signers: Signer[]
  ) => Promise<{ value: { err: null } }>;
}

class WalletAdapterWallet {
  constructor(
    public publicKey: PublicKey,
    private signFn: (tx: Transaction) => Promise<Transaction>,
    private signAllFn: (txs: Transaction[]) => Promise<Transaction[]>
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
  wallet: StakeWallet
): AnchorProvider {
  const adapterWallet = new WalletAdapterWallet(
    wallet.publicKey,
    wallet.signTransaction.bind(wallet),
    wallet.signAllTransactions.bind(wallet)
  );

  const provider = new AnchorProvider(
    connection,
    adapterWallet as unknown as Wallet,
    {
      commitment: "confirmed",
      skipPreflight: false,
    }
  );

  return provider;
}

function poolIdToBuffer(poolId: number): Buffer {
  const bn = new BN(poolId);
  return bn.toArrayLike(Buffer, "le", 8);
}

export interface StakePdas {
  pool: PublicKey;
  userPosition: PublicKey;
  userStakeAta: PublicKey;
  stakeVault: PublicKey;
}

export function deriveStakePdas(poolId: number, user: PublicKey): StakePdas {
  const [pool] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), poolIdToBuffer(poolId)],
    PROGRAM_ID
  );

  const [userPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );

  return { pool, userPosition, userStakeAta: user, stakeVault: user };
}

export interface StakeArgs {
  poolId: number;
  /** Amount in base units. For native SOL pools, this is lamports. */
  amount: number;
  stakeMint: PublicKey;
}

function formatStakeAmount(amount: BN, stakeMint: PublicKey): string {
  if (!stakeMint.equals(NATIVE_MINT)) {
    return `${amount.toString()} base units`;
  }

  const lamports = BigInt(amount.toString());
  const whole = lamports / BigInt(LAMPORTS_PER_SOL);
  const fraction = (lamports % BigInt(LAMPORTS_PER_SOL))
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");

  return `${whole.toString()}${fraction ? `.${fraction}` : ""} SOL`;
}

function depositCapMessage(
  remaining: BN,
  stakeMint: PublicKey,
  poolId: number,
  pool: PublicKey,
  depositCap: BN,
  totalStaked: BN
): string {
  if (remaining.isZero()) {
    return `Pool ${poolId} has reached its deposit cap. On-chain pool: ${pool.toBase58()}.`;
  }

  return `Deposit cap exceeded for pool ${poolId}. You can stake up to ${formatStakeAmount(
    remaining,
    stakeMint
  )} more in this pool. Cap: ${formatStakeAmount(
    depositCap,
    stakeMint
  )}; currently staked: ${formatStakeAmount(
    totalStaked,
    stakeMint
  )}. On-chain pool: ${pool.toBase58()}.`;
}

function isDepositCapError(message?: string, logs?: unknown): boolean {
  const logText = Array.isArray(logs) ? logs.join("\n") : "";
  return (
    message?.includes("DepositCapExceeded") ||
    message?.includes("Deposit cap exceeded") ||
    message?.includes('"Custom":6007') ||
    logText.includes("DepositCapExceeded") ||
    logText.includes("Deposit cap exceeded")
  );
}

function isInsufficientFundsError(message?: string, logs?: unknown): boolean {
  const logText = Array.isArray(logs) ? logs.join("\n") : "";
  return (
    message?.includes("insufficient funds") ||
    message?.includes('"Custom":1') ||
    logText.includes("insufficient funds")
  );
}

function transactionErrorMessage(err: any): string {
  const logs =
    err?.logs ??
    err?.error?.logs ??
    err?.error?.error?.logs ??
    err?.error?.data?.logs ??
    err?.cause?.logs ??
    err?.cause?.error?.logs ??
    err?.cause?.error?.data?.logs;

  const logText = Array.isArray(logs) ? `\n${logs.join("\n")}` : "";
  const message =
    err?.message ??
    err?.error?.message ??
    err?.error?.error?.message ??
    err?.cause?.message ??
    err?.cause?.error?.message ??
    err?.toString?.();

  if (isDepositCapError(message, logs)) {
    return "Deposit cap exceeded. Try a smaller amount or choose another pool.";
  }

  if (isInsufficientFundsError(message, logs)) {
    return "Insufficient stake token balance. Check the selected pool's stake mint and your token account balance.";
  }

  if (message && message !== "[object Object]") {
    return `${message}${logText}`;
  }

  try {
    return `Transaction failed: ${JSON.stringify(err)}${logText}`;
  } catch {
    return `Transaction failed with an unknown wallet error${logText}`;
  }
}

async function assertSimulationPasses(
  provider: AnchorProvider,
  tx: Transaction
): Promise<void> {
  const simulation = await provider.connection.simulateTransaction(
    tx.compileMessage()
  );

  if (!simulation.value.err) {
    return;
  }

  const logs = simulation.value.logs?.join("\n");
  const serializedError = JSON.stringify(simulation.value.err);
  if (isDepositCapError(serializedError, simulation.value.logs)) {
    throw new Error(
      "Deposit cap exceeded. Try a smaller amount or choose another pool."
    );
  }

  if (isInsufficientFundsError(serializedError, simulation.value.logs)) {
    throw new Error(
      "Insufficient stake token balance. Check the selected pool's stake mint and your token account balance."
    );
  }

  const details = logs ? `\n${logs}` : "";
  throw new Error(
    `Stake transaction simulation failed: ${serializedError}${details}`
  );
}

function assertDepositCapAvailable(
  poolAccount: { depositCap?: BN; totalStaked?: BN },
  amount: number,
  stakeMint: PublicKey,
  poolId: number,
  pool: PublicKey
): void {
  if (!poolAccount.depositCap || !poolAccount.totalStaked) {
    return;
  }

  const depositCap = new BN(poolAccount.depositCap.toString());
  if (depositCap.isZero()) {
    return;
  }

  const totalStaked = new BN(poolAccount.totalStaked.toString());
  const stakeAmount = new BN(amount);
  const remaining = BN.max(depositCap.sub(totalStaked), new BN(0));

  if (stakeAmount.gt(remaining)) {
    throw new Error(
      depositCapMessage(
        remaining,
        stakeMint,
        poolId,
        pool,
        depositCap,
        totalStaked
      )
    );
  }
}

function buildEnsureStakeAtaInstruction(
  provider: AnchorProvider,
  userStakeAta: PublicKey,
  stakeMint: PublicKey
): TransactionInstruction {
  const user = provider.wallet.publicKey;

  return createAssociatedTokenAccountIdempotentInstruction(
    user,
    userStakeAta,
    user,
    stakeMint
  );
}

async function buildWrapSolInstructions(
  provider: AnchorProvider,
  userStakeAta: PublicKey,
  amount: number
): Promise<TransactionInstruction[]> {
  const user = provider.wallet.publicKey;
  const instructions: TransactionInstruction[] = [
    buildEnsureStakeAtaInstruction(provider, userStakeAta, NATIVE_MINT),
  ];
  const accountInfo = await provider.connection.getAccountInfo(userStakeAta);
  let currentWrappedAmount = BigInt(0);

  if (accountInfo) {
    const nativeAccount = await getAccount(provider.connection, userStakeAta);
    currentWrappedAmount = nativeAccount.amount;
  }

  const requestedAmount = BigInt(amount);
  if (currentWrappedAmount >= requestedAmount) {
    return instructions;
  }

  const shortfall = requestedAmount - currentWrappedAmount;
  if (shortfall > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(
      "Stake amount is too large to wrap safely in a legacy transaction"
    );
  }

  instructions.push(
    SystemProgram.transfer({
      fromPubkey: user,
      toPubkey: userStakeAta,
      lamports: Number(shortfall),
    }),
    createSyncNativeInstruction(userStakeAta)
  );

  return instructions;
}

export async function stake(
  provider: AnchorProvider,
  args: StakeArgs
): Promise<string> {
  const program: Program<Staking> = getProgram(provider);

  const { pool, userPosition } = deriveStakePdas(
    args.poolId,
    provider.wallet.publicKey
  );

  const poolAccount = await program.account.pool.fetch(pool);
  const poolStakeMint = poolAccount.stakeMint;

  if (!args.stakeMint.equals(poolStakeMint)) {
    throw new Error(
      `Pool metadata is stale for pool ${
        args.poolId
      }. Refresh/sync pools and try again. Client mint: ${args.stakeMint.toBase58()}; on-chain mint: ${poolStakeMint.toBase58()}.`
    );
  }

  assertDepositCapAvailable(
    poolAccount,
    args.amount,
    poolStakeMint,
    args.poolId,
    pool
  );

  const userStakeAta = await getAssociatedTokenAddress(
    poolStakeMint,
    provider.wallet.publicKey
  );

  const stakeVault = poolAccount.stakeVault;
  const preInstructions = poolStakeMint.equals(NATIVE_MINT)
    ? await buildWrapSolInstructions(provider, userStakeAta, args.amount)
    : [buildEnsureStakeAtaInstruction(provider, userStakeAta, poolStakeMint)];

  const stakeInstruction = await program.methods
    .stake(new BN(args.amount))
    .accountsPartial({
      user: provider.wallet.publicKey,
      pool,
      userPosition,
      userStakeAta,
      stakeVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SYSTEM_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction().add(...preInstructions, stakeInstruction);

  const latestBlockhash = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.feePayer = provider.wallet.publicKey;

  const originalWallet = (provider as any).wallet;

  const hasFullSupport =
    originalWallet.sendTransaction && originalWallet.signTransaction;
  const hasSeparateSign =
    originalWallet.signTransaction && !originalWallet.sendTransaction;

  if (hasFullSupport) {
    try {
      await assertSimulationPasses(provider, tx);
      const signedTx = await originalWallet.signTransaction(tx);
      const signature = await provider.connection.sendRawTransaction(
        signedTx.serialize(),
        { preflightCommitment: "confirmed" }
      );
      await provider.connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );
      return signature;
    } catch (err: any) {
      if (
        err.message?.includes("disconnected port") ||
        err.message?.includes("Failed to send")
      ) {
        throw new Error(
          "Wallet connection interrupted. Please check if transaction was submitted and try again if it wasn't."
        );
      }
      throw new Error(transactionErrorMessage(err));
    }
  }

  if (hasSeparateSign) {
    try {
      await assertSimulationPasses(provider, tx);
      const signedTx = await originalWallet.signTransaction(tx);
      const signature = await provider.connection.sendRawTransaction(
        signedTx.serialize(),
        { preflightCommitment: "confirmed" }
      );
      await provider.connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );
      return signature;
    } catch (err: any) {
      throw new Error(transactionErrorMessage(err));
    }
  }

  throw new Error("Wallet does not support signTransaction");
}

export async function stakeWithConnection(
  connection: any,
  wallet: any,
  args: StakeArgs
): Promise<string> {
  const provider = createStakeProvider(connection, wallet);
  return stake(provider, args);
}
