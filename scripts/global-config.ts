/**
 * One-off devnet script: initialize the global config PDA.
 * Run from repo root: yarn ts-node --esm scripts/global-config.ts
 * (Do not place under tests/ — Mocha would execute it during `anchor test`.)
 */
import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import path from "path";
import { Keypair, PublicKey } from "@solana/web3.js";

async function main() {
  const walletPath = path.join(os.homedir(), ".config/solana/id.json");
  const secretKey = Uint8Array.from(
    JSON.parse(fs.readFileSync(walletPath, "utf8"))
  );
  const keypair = Keypair.fromSecretKey(secretKey);

  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  anchor.setProvider(provider);

  const idl = JSON.parse(
    fs.readFileSync("target/idl/staking.json", "utf8")
  );

  const program = new anchor.Program(idl, provider);

  const [globalConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_v2")],
    program.programId
  );

  const tx = await program.methods
    .initializeGlobal(wallet.publicKey, wallet.publicKey)
    .accounts({
      authority: wallet.publicKey,
      globalConfig,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("Transaction signature:", tx);
}

main().catch(console.error);
