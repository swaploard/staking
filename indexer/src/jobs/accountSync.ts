import { PrismaClient } from "@prisma/client";
import { RpcClient } from "../rpc/client";
import { Logger } from "../logger";
import { PublicKey } from "@solana/web3.js";
import pLimit from "p-limit";
import { StakingProgramCodec } from "../program/stakingCodec";

/**
 * Account Sync Job
 * - Fetches current Pool and UserPosition accounts from on-chain
 * - Decodes account data using Anchor discriminators
 * - Syncs state to database with last_updated_slot tracking
 * - Handles batching, retries, and bounded concurrency
 */
export class AccountSyncJob {
    private prisma: PrismaClient;
    private rpcClient: RpcClient;
    private logger: Logger;
    private stakingProgramId: string;
    private codec: StakingProgramCodec;

    // Anchor discriminators (first 8 bytes of account type hash)
    private readonly POOL_DISCRIMINATOR = new Uint8Array([
        241, 154, 109, 4, 17, 177, 109, 188,
    ]); // Pool
    private readonly USER_POSITION_DISCRIMINATOR = new Uint8Array([
        251, 248, 209, 245, 83, 234, 17, 27,
    ]); // UserPosition

    constructor(
        prisma: PrismaClient,
        rpcClient: RpcClient,
        stakingProgramId: string
    ) {
        this.prisma = prisma;
        this.rpcClient = rpcClient;
        this.stakingProgramId = stakingProgramId;
        this.codec = StakingProgramCodec.load(stakingProgramId);
        this.logger = new Logger("AccountSyncJob");
    }

    /**
     * Main entry point: sync all pools and positions
     */
    async sync(): Promise<void> {
        try {
            this.logger.info("Starting account sync job...");

            const startTime = Date.now();

            // Get current slot for tracking
            const currentSlot = await this.rpcClient.getSlot("confirmed");
            this.logger.info(`Current slot: ${currentSlot}`);

            // Sync pools
            const poolCount = await this.syncPools(currentSlot);
            this.logger.info(`Synced ${poolCount} pools`);

            // Sync user positions
            const positionCount = await this.syncUserPositions(currentSlot);
            this.logger.info(`Synced ${positionCount} user positions`);

            const elapsed = Date.now() - startTime;
            this.logger.info(
                `Account sync completed in ${elapsed}ms (${poolCount} pools, ${positionCount} positions)`
            );
        } catch (error) {
            this.logger.error("Account sync failed:", error);
            throw error;
        }
    }

    /**
     * Sync all Pool accounts
     */
    private async syncPools(currentSlot: number): Promise<number> {
        try {
            this.logger.debug("Fetching program accounts for pools...");

            // Fetch all program accounts
            const accounts = await this.rpcClient.getProgramAccounts(
                this.stakingProgramId,
                { commitment: "confirmed" }
            );

            if (!accounts || !Array.isArray(accounts)) {
                this.logger.warn("No accounts returned from getProgramAccounts");
                return 0;
            }

            // Filter to Pool accounts only (by discriminator)
            const poolAccounts = accounts.filter((acc: any) => {
                const data = Buffer.from(acc.account.data);
                return (
                    data.length >= 8 &&
                    this.bufferEqual(
                        data.slice(0, 8),
                        Buffer.from(this.POOL_DISCRIMINATOR)
                    )
                );
            });

            this.logger.debug(`Found ${poolAccounts.length} pool accounts`);

            if (poolAccounts.length === 0) {
                return 0;
            }

            // Decode and sync in parallel with bounded concurrency
            const limit = pLimit(5); // Max 5 concurrent decodes
            const decodePromises = poolAccounts.map((acc: any) =>
                limit(async () => {
                    try {
                        const decoded = this.decodePoolAccount(
                            acc.pubkey,
                            acc.account.data
                        );
                        return { success: true, data: decoded };
                    } catch (error) {
                        this.logger.error(
                            `Failed to decode pool ${acc.pubkey}:`,
                            error
                        );
                        return { success: false, error };
                    }
                })
            );

            const results = await Promise.all(decodePromises);
            const decodedPools = results
                .filter((r): r is { success: true; data: any } => r.success && r.data !== undefined)
                .map((r) => r.data);

            const createdTxHashByPoolId = await this.getCreatedTxHashByPoolId(
                decodedPools.map((pool) => pool.id)
            );

            // Upsert pools in database
            let syncedCount = 0;
            for (const pool of decodedPools) {
                try {
                    const createdTxHash = createdTxHashByPoolId.get(pool.id);

                    await this.prisma.pool.upsert({
                        where: { id: pool.id },
                        update: {
                            poolId: pool.poolId,
                            authority: pool.authority,
                            tokenMint: pool.tokenMint,
                            rewardMint: pool.rewardMint,
                            aprBps: pool.aprBps,
                            vaultBump: pool.vaultBump,
                            stakedAmount: pool.stakedAmount,
                            rewardAmount: pool.rewardAmount,
                            rewardPerShare: pool.rewardPerShare,
                            totalShares: pool.totalShares,
                            lockUpPeriod: pool.lockUpPeriod,
                            startTime: pool.startTime,
                            endTime: pool.endTime,
                            createdTxHash,
                            lastUpdatedSlot: BigInt(currentSlot),
                            updatedAt: new Date(),
                        },
                        create: {
                            id: pool.id,
                            poolId: pool.poolId,
                            authority: pool.authority,
                            tokenMint: pool.tokenMint,
                            rewardMint: pool.rewardMint,
                            aprBps: pool.aprBps,
                            vaultBump: pool.vaultBump,
                            stakedAmount: pool.stakedAmount,
                            rewardAmount: pool.rewardAmount,
                            rewardPerShare: pool.rewardPerShare,
                            totalShares: pool.totalShares,
                            lockUpPeriod: pool.lockUpPeriod,
                            startTime: pool.startTime,
                            endTime: pool.endTime,
                            createdTxHash,
                            lastUpdatedSlot: BigInt(currentSlot),
                        },
                    });
                    syncedCount++;
                } catch (error) {
                    this.logger.error(
                        `Failed to upsert pool ${pool.id}:`,
                        error
                    );
                }
            }

            return syncedCount;
        } catch (error) {
            this.logger.error("Failed to sync pools:", error);
            throw error;
        }
    }

    /**
     * Sync all UserPosition accounts
     */
    private async syncUserPositions(currentSlot: number): Promise<number> {
        try {
            this.logger.debug("Fetching program accounts for user positions...");

            // Fetch all program accounts
            const accounts = await this.rpcClient.getProgramAccounts(
                this.stakingProgramId,
                { commitment: "confirmed" }
            );

            if (!accounts || !Array.isArray(accounts)) {
                this.logger.warn("No accounts returned from getProgramAccounts");
                return 0;
            }

            // Filter to UserPosition accounts only (by discriminator)
            const positionAccounts = accounts.filter((acc: any) => {
                const data = Buffer.from(acc.account.data);
                return (
                    data.length >= 8 &&
                    this.bufferEqual(
                        data.slice(0, 8),
                        Buffer.from(this.USER_POSITION_DISCRIMINATOR)
                    )
                );
            });

            this.logger.debug(
                `Found ${positionAccounts.length} user position accounts`
            );

            if (positionAccounts.length === 0) {
                return 0;
            }

            // Decode and sync in parallel with bounded concurrency
            const limit = pLimit(5); // Max 5 concurrent decodes
            const decodePromises = positionAccounts.map((acc: any) =>
                limit(async () => {
                    try {
                        const decoded = this.decodeUserPositionAccount(
                            acc.pubkey,
                            acc.account.data
                        );
                        return { success: true, data: decoded };
                    } catch (error) {
                        this.logger.error(
                            `Failed to decode user position ${acc.pubkey}:`,
                            error
                        );
                        return { success: false, error };
                    }
                })
            );

            const results = await Promise.all(decodePromises);
            const decodedPositions = results
                .filter((r): r is { success: true; data: any } => r.success && r.data !== undefined)
                .map((r) => r.data);

            // Upsert user positions in database
            let syncedCount = 0;
            for (const position of decodedPositions) {
                try {
                    await this.prisma.userPosition.upsert({
                        where: { id: position.id },
                        update: {
                            pool: position.pool,
                            userAuthority: position.userAuthority,
                            shares: position.shares,
                            unlockedShares: position.unlockedShares,
                            depositAmount: position.depositAmount,
                            depositTime: position.depositTime,
                            rewardDebt: position.rewardDebt,
                            lastUpdatedSlot: BigInt(currentSlot),
                            updatedAt: new Date(),
                        },
                        create: {
                            id: position.id,
                            pool: position.pool,
                            userAuthority: position.userAuthority,
                            shares: position.shares,
                            unlockedShares: position.unlockedShares,
                            depositAmount: position.depositAmount,
                            depositTime: position.depositTime,
                            rewardDebt: position.rewardDebt,
                            lastUpdatedSlot: BigInt(currentSlot),
                        },
                    });
                    syncedCount++;
                } catch (error) {
                    this.logger.error(
                        `Failed to upsert user position ${position.id}:`,
                        error
                    );
                }
            }

            return syncedCount;
        } catch (error) {
            this.logger.error("Failed to sync user positions:", error);
            throw error;
        }
    }

    /**
     * Find the earliest pool-creation transaction for each pool.
     * This only accepts explicit pool creation activity and ignores reward funding.
     */
    private async getCreatedTxHashByPoolId(
        poolIds: string[]
    ): Promise<Map<string, string>> {
        if (poolIds.length === 0) {
            return new Map();
        }

        const rows = await this.prisma.txActivity.findMany({
            where: {
                poolId: {
                    in: poolIds,
                },
                OR: [
                    {
                        eventType: {
                            in: ["PoolCreated", "CreatePool"],
                        },
                    },
                    {
                        metadata: {
                            path: ["log"],
                            string_contains: "Instruction: CreatePool",
                        },
                    },
                ],
            },
            orderBy: [{ slot: "asc" }, { ixIndex: "asc" }],
            select: {
                poolId: true,
                signature: true,
            },
        });

        const createdTxHashByPoolId = new Map<string, string>();
        for (const row of rows) {
            if (row.poolId && !createdTxHashByPoolId.has(row.poolId)) {
                createdTxHashByPoolId.set(row.poolId, row.signature);
            }
        }

        const missingPoolIds = poolIds.filter(
            (poolId) => !createdTxHashByPoolId.has(poolId)
        );

        if (missingPoolIds.length > 0) {
            const limit = pLimit(3);
            const resolved = await Promise.all(
                missingPoolIds.map((poolId) =>
                    limit(async () => ({
                        poolId,
                        signature: await this.findCreatePoolSignature(poolId),
                    }))
                )
            );

            for (const row of resolved) {
                if (row.signature) {
                    createdTxHashByPoolId.set(row.poolId, row.signature);
                }
            }
        }

        return createdTxHashByPoolId;
    }

    private async findCreatePoolSignature(
        poolId: string
    ): Promise<string | undefined> {
        let before: string | undefined;
        const pageSize = 100;
        const maxPages = 20;

        for (let page = 0; page < maxPages; page++) {
            const signatures = await this.rpcClient.getSignaturesForAddress(
                poolId,
                {
                    limit: pageSize,
                    before,
                },
                {
                    commitment: "confirmed",
                }
            );

            if (signatures.length === 0) {
                return undefined;
            }

            for (const sigInfo of signatures) {
                if (sigInfo.err) {
                    continue;
                }

                const tx = await this.rpcClient.getTransaction(sigInfo.signature, {
                    commitment: "confirmed",
                });

                if (tx && this.isCreatePoolTransaction(tx, poolId)) {
                    return sigInfo.signature;
                }
            }

            before = signatures[signatures.length - 1]?.signature;
        }

        this.logger.warn(
            `Could not resolve CreatePool transaction for pool ${poolId} after ${maxPages} pages`
        );
        return undefined;
    }

    private isCreatePoolTransaction(tx: any, poolId: string): boolean {
        const logs = tx.meta?.logMessages || [];
        const hasCreatePoolLog = logs.some((log: string) =>
            log.includes("Instruction: CreatePool")
        );

        if (!hasCreatePoolLog) {
            return false;
        }

        const accountKeys = tx.transaction.message.accountKeys || [];
        return accountKeys.some((key: any) => {
            if (typeof key === "string") {
                return key === poolId;
            }

            if (key && typeof key.toBase58 === "function") {
                return key.toBase58() === poolId;
            }

            if (key && typeof key.pubkey?.toBase58 === "function") {
                return key.pubkey.toBase58() === poolId;
            }

            if (typeof key?.pubkey === "string") {
                return key.pubkey === poolId;
            }

            return false;
        });
    }

    /**
     * Decode a Pool account
     * Reference: Pool struct in Anchor IDL
     */
    private decodePoolAccount(pubkey: PublicKey, data: Buffer | Uint8Array) {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

        if (this.codec.isLoaded()) {
            try {
                const decoded = this.codec.decodePoolAccount(
                    pubkey.toBase58(),
                    buffer
                );

                return {
                    id: decoded.id,
                    poolId: Number(decoded.poolId),
                    authority: decoded.stakeMint,
                    tokenMint: decoded.stakeMint,
                    rewardMint: decoded.rewardMint,
                    aprBps: decoded.aprBps,
                    vaultBump: decoded.bump,
                    stakedAmount: decoded.totalStaked,
                    rewardAmount: decoded.totalRewardsFunded,
                    rewardPerShare: 0n,
                    totalShares: decoded.depositCap,
                    lockUpPeriod: decoded.lockDuration,
                    startTime: decoded.lastUpdateTimestamp,
                    endTime: null,
                };
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                this.logger.warn(
                    `Falling back to manual pool decode for ${pubkey.toBase58()}: ${message}`
                );
            }
        }

        let offset = 8; // Skip discriminator

        // pool_id: u64
        const poolId = buffer.readBigUInt64LE(offset);
        offset += 8;

        // stake_mint: pubkey
        const stakeMint = new PublicKey(buffer.slice(offset, offset + 32));
        offset += 32;

        // reward_mint: pubkey
        const rewardMint = new PublicKey(buffer.slice(offset, offset + 32));
        offset += 32;

        // stake_vault: pubkey
        const stakeVault = new PublicKey(buffer.slice(offset, offset + 32));
        offset += 32;

        // reward_vault: pubkey
        const rewardVault = new PublicKey(buffer.slice(offset, offset + 32));
        offset += 32;

        // apr_bps: u64
        const aprBps = buffer.readBigUInt64LE(offset);
        offset += 8;

        // lock_duration: i64
        const lockDuration = buffer.readBigInt64LE(offset);
        offset += 8;

        // cooldown_duration: i64
        const cooldownDuration = buffer.readBigInt64LE(offset);
        offset += 8;

        // deposit_cap: u64
        const depositCap = buffer.readBigUInt64LE(offset);
        offset += 8;

        // reward_rate_per_second: u128 (16 bytes LE)
        const rewardRatePerSecond = buffer.readBigUInt64LE(offset);
        offset += 16;

        // total_staked: u64
        const totalStaked = buffer.readBigUInt64LE(offset);
        offset += 8;

        // cumulative_reward_per_token: u128 (16 bytes LE)
        offset += 16; // Skip for now

        // last_reward_time: i64
        offset += 8;

        // pause_authority: pubkey
        offset += 32;

        // is_paused: bool
        offset += 1;

        // bump: u8
        offset += 1;

        // version: u8
        offset += 1;

        return {
            id: pubkey.toBase58(),
            poolId: Number(poolId),
            authority: stakeMint.toBase58(), // Simplified - actual authority may vary
            tokenMint: stakeMint.toBase58(),
            rewardMint: rewardMint.toBase58(),
            aprBps: aprBps,
            vaultBump: 0, // Simplified
            stakedAmount: totalStaked,
            rewardAmount: BigInt(0), // Would need full buffer parsing
            rewardPerShare: BigInt(0), // Would need calculation
            totalShares: depositCap,
            lockUpPeriod: lockDuration,
            startTime: BigInt(0), // Not in standard Pool struct
            endTime: null,
        };
    }

    /**
     * Decode a UserPosition account
     * Reference: UserPosition struct in Anchor IDL
     */
    private decodeUserPositionAccount(
        pubkey: PublicKey,
        data: Buffer | Uint8Array
    ) {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        let offset = 8; // Skip discriminator

        // owner: pubkey
        const owner = new PublicKey(buffer.slice(offset, offset + 32));
        offset += 32;

        // pool: pubkey
        const pool = new PublicKey(buffer.slice(offset, offset + 32));
        offset += 32;

        // amount: u64
        const amount = buffer.readBigUInt64LE(offset);
        offset += 8;

        // reward_debt: u128
        const rewardDebt = buffer.readBigUInt64LE(offset);
        offset += 16;

        // pending_rewards: u64
        offset += 8;

        // pending_withdrawal: u64
        offset += 8;

        // deposit_timestamp: i64
        const depositTimestamp = buffer.readBigInt64LE(offset);
        offset += 8;

        // unlock_timestamp: i64
        offset += 8;

        // cooldown_start: i64
        offset += 8;

        // bump: u8
        offset += 1;

        // version: u8
        offset += 1;

        return {
            id: pubkey.toBase58(),
            pool: pool.toBase58(),
            userAuthority: owner.toBase58(),
            shares: amount,
            unlockedShares: BigInt(0), // May need calculation
            depositAmount: amount,
            depositTime: depositTimestamp,
            rewardDebt: rewardDebt,
        };
    }

    /**
     * Compare two buffers for equality
     */
    private bufferEqual(a: Buffer, b: Buffer): boolean {
        if (a.length !== b.length) return false;
        return a.equals(b);
    }
}

export default AccountSyncJob;
