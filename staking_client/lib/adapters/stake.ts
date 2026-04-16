import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  getProgram,
  PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
} from "../anchor";
import type { Staking } from "../../../target/types/staking";

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
    PROGRAM_ID,
  );

  const [userPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  );

  return { pool, userPosition, userStakeAta: user, stakeVault: user };
}

export interface StakeArgs {
  poolId: number;
  amount: number;
  stakeMint: PublicKey;
}

export async function stake(
  provider: AnchorProvider,
  args: StakeArgs,
): Promise<string> {
  const program: Program<Staking> = getProgram(provider);

  const { pool, userPosition, stakeVault } = deriveStakePdas(
    args.poolId,
    provider.wallet.publicKey,
  );

  const userStakeAta = await getAssociatedTokenAddress(
    args.stakeMint,
    provider.wallet.publicKey,
  );

  const sig = await program.methods
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
    .rpc();

  return sig;
}

export async function stakeWithConnection(
  connection: any,
  wallet: any,
  args: StakeArgs,
): Promise<string> {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return stake(provider, args);
}
