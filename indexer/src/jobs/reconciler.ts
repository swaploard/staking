import { PrismaClient } from "@prisma/client";
import { Logger } from "../logger";
import { RpcClient } from "../rpc/client";
import { StakingProgramCodec } from "../program/stakingCodec";
import { AlertEngine } from "../alerts/engine";

type ConflictPolicy = "log_only" | "on_chain";

export class ReconcilerJob {
    private logger = new Logger("ReconcilerJob");
    private running = false;
    private readonly cursorId = 2;
    private codec: StakingProgramCodec;
    private alertEngine = new AlertEngine();
    private toleranceLamports: bigint;
    private conflictPolicy: ConflictPolicy;

    constructor(
        private prisma: PrismaClient,
        private rpcClient: RpcClient,
        stakingProgramId: string
    ) {
        this.codec = StakingProgramCodec.load(stakingProgramId);
        this.toleranceLamports = BigInt(
            process.env.RECONCILIATION_TOLERANCE_LAMPORTS || "1000"
        );
        this.conflictPolicy =
            (process.env.RECONCILIATION_CONFLICT_POLICY as ConflictPolicy) ||
            "log_only";
    }

    async start(intervalMs: number = 300000): Promise<void> {
        if (this.running) {
            this.logger.warn("Reconciler already running");
            return;
        }

        this.running = true;
        while (this.running) {
            try {
                await this.runOnce();
            } catch (error) {
                this.logger.error("Reconciliation loop failed", error);
            }

            if (this.running) {
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }
        }
    }

    stop(): void {
        this.running = false;
    }

    async runOnce(): Promise<{
        checkedPools: number;
        checkedPositions: number;
        diffCount: number;
    }> {
        if (!this.codec.isLoaded()) {
            throw new Error("Cannot reconcile without the staking IDL");
        }

        const cursor = await this.ensureCursor();
        const currentSlot = await this.rpcClient.getSlot("confirmed");

        const pools = await this.prisma.pool.findMany({
            where: {
                lastUpdatedSlot: {
                    gt: cursor.lastProcessedSlot,
                },
            },
            orderBy: { lastUpdatedSlot: "asc" },
            take: 500,
        });

        const positions = await this.prisma.userPosition.findMany({
            where: {
                lastUpdatedSlot: {
                    gt: cursor.lastProcessedSlot,
                },
            },
            orderBy: { lastUpdatedSlot: "asc" },
            take: 1000,
        });

        let diffCount = 0;
        diffCount += await this.reconcilePools(pools, BigInt(currentSlot));
        diffCount += await this.reconcilePositions(positions, BigInt(currentSlot));

        await this.prisma.indexerCursor.update({
            where: { id: this.cursorId },
            data: {
                lastProcessedSlot: BigInt(currentSlot),
            },
        });

        this.logger.info(
            `Reconciler checked ${pools.length} pools and ${positions.length} positions; diffCount=${diffCount}`
        );

        return {
            checkedPools: pools.length,
            checkedPositions: positions.length,
            diffCount,
        };
    }

    private async ensureCursor() {
        const existing = await this.prisma.indexerCursor.findUnique({
            where: { id: this.cursorId },
        });

        if (existing) {
            return existing;
        }

        return this.prisma.indexerCursor.create({
            data: {
                id: this.cursorId,
                lastProcessedSlot: 0n,
            },
        });
    }

    private async reconcilePools(
        pools: Array<{
            id: string;
            tokenMint: string;
            stakedAmount: bigint;
            rewardAmount: bigint;
            lockUpPeriod: bigint;
            totalShares: bigint;
        }>,
        currentSlot: bigint
    ): Promise<number> {
        if (pools.length === 0) {
            return 0;
        }

        const accounts = await this.rpcClient.getMultipleAccountsInfo(
            pools.map((pool) => pool.id),
            { commitment: "confirmed" }
        );

        let diffCount = 0;

        for (let index = 0; index < pools.length; index++) {
            const dbPool = pools[index];
            const account = accounts[index];
            if (!account) {
                diffCount += await this.recordDiff(
                    "reconciliation_diff",
                    "warning",
                    `Pool ${dbPool.id} is missing on-chain`,
                    {
                        poolId: dbPool.id,
                        entityType: "pool",
                        reason: "missing_on_chain",
                    }
                );
                continue;
            }

            const onChainPool = this.codec.decodePoolAccount(
                dbPool.id,
                Buffer.from(account.data)
            );
            const mismatches: Record<string, { db: string; onChain: string }> = {};

            this.compareField(
                mismatches,
                "stakedAmount",
                dbPool.stakedAmount,
                onChainPool.totalStaked
            );
            this.compareField(
                mismatches,
                "tokenMint",
                dbPool.tokenMint,
                onChainPool.stakeMint
            );
            this.compareField(
                mismatches,
                "rewardAmount",
                dbPool.rewardAmount,
                onChainPool.totalRewardsFunded
            );
            this.compareField(
                mismatches,
                "lockUpPeriod",
                dbPool.lockUpPeriod,
                onChainPool.lockDuration
            );
            this.compareField(
                mismatches,
                "totalShares",
                dbPool.totalShares,
                onChainPool.depositCap
            );

            if (Object.keys(mismatches).length > 0) {
                diffCount += await this.recordDiff(
                    "reconciliation_diff",
                    "warning",
                    `Pool drift detected for ${dbPool.id}`,
                    {
                        poolId: dbPool.id,
                        entityType: "pool",
                        mismatches,
                    }
                );

                if (this.conflictPolicy === "on_chain") {
                    await this.prisma.pool.update({
                        where: { id: dbPool.id },
                        data: {
                            tokenMint: onChainPool.stakeMint,
                            stakedAmount: onChainPool.totalStaked,
                            rewardAmount: onChainPool.totalRewardsFunded,
                            lockUpPeriod: onChainPool.lockDuration,
                            totalShares: onChainPool.depositCap,
                            lastUpdatedSlot: currentSlot,
                        },
                    });
                }
            }

            diffCount += await this.validateVault(
                dbPool.id,
                "stake",
                onChainPool.stakeVault,
                onChainPool.totalStaked,
                currentSlot
            );
        }

        return diffCount;
    }

    private async reconcilePositions(
        positions: Array<{
            id: string;
            pool: string;
            userAuthority: string;
            shares: bigint;
            depositAmount: bigint;
        }>,
        currentSlot: bigint
    ): Promise<number> {
        if (positions.length === 0) {
            return 0;
        }

        const accounts = await this.rpcClient.getMultipleAccountsInfo(
            positions.map((position) => position.id),
            { commitment: "confirmed" }
        );

        let diffCount = 0;

        for (let index = 0; index < positions.length; index++) {
            const dbPosition = positions[index];
            const account = accounts[index];
            if (!account) {
                diffCount += await this.recordDiff(
                    "reconciliation_diff",
                    "warning",
                    `User position ${dbPosition.id} is missing on-chain`,
                    {
                        positionId: dbPosition.id,
                        entityType: "user_position",
                        reason: "missing_on_chain",
                    }
                );
                continue;
            }

            const onChainPosition = this.codec.decodeUserPositionAccount(
                dbPosition.id,
                Buffer.from(account.data)
            );
            const mismatches: Record<string, { db: string; onChain: string }> = {};

            this.compareField(
                mismatches,
                "pool",
                dbPosition.pool,
                onChainPosition.pool
            );
            this.compareField(
                mismatches,
                "userAuthority",
                dbPosition.userAuthority,
                onChainPosition.owner
            );
            this.compareField(
                mismatches,
                "shares",
                dbPosition.shares,
                onChainPosition.amount
            );
            this.compareField(
                mismatches,
                "depositAmount",
                dbPosition.depositAmount,
                onChainPosition.amount
            );

            if (Object.keys(mismatches).length > 0) {
                diffCount += await this.recordDiff(
                    "reconciliation_diff",
                    "warning",
                    `User position drift detected for ${dbPosition.id}`,
                    {
                        positionId: dbPosition.id,
                        entityType: "user_position",
                        mismatches,
                    }
                );

                if (this.conflictPolicy === "on_chain") {
                    await this.prisma.userPosition.update({
                        where: { id: dbPosition.id },
                        data: {
                            pool: onChainPosition.pool,
                            userAuthority: onChainPosition.owner,
                            shares: onChainPosition.amount,
                            depositAmount: onChainPosition.amount,
                            depositTime: onChainPosition.depositTimestamp,
                            lastUpdatedSlot: currentSlot,
                        },
                    });
                }
            }
        }

        return diffCount;
    }

    private async validateVault(
        poolId: string,
        vaultType: string,
        vaultAddress: string,
        expectedBalance: bigint,
        currentSlot: bigint
    ): Promise<number> {
        const balance = await this.rpcClient.getTokenAccountBalance(vaultAddress, {
            commitment: "confirmed",
        });
        const actualBalance = BigInt(balance.value.amount);
        const difference =
            actualBalance >= expectedBalance
                ? actualBalance - expectedBalance
                : expectedBalance - actualBalance;

        await this.prisma.$executeRawUnsafe(
            `
                INSERT INTO "VaultHistory"
                    ("poolId", "vaultType", "slot", "expectedBalance", "actualBalance", "difference", "reconciled", "tolerance", "createdAt")
                VALUES
                    ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `,
            poolId,
            vaultType,
            currentSlot.toString(),
            expectedBalance.toString(),
            actualBalance.toString(),
            difference.toString(),
            difference <= this.toleranceLamports,
            this.toleranceLamports.toString()
        );

        if (difference <= this.toleranceLamports) {
            return 0;
        }

        return this.recordDiff(
            "vault_mismatch",
            "warning",
            `Vault balance drift detected for pool ${poolId}`,
            {
                poolId,
                vaultType,
                vaultAddress,
                expectedBalance: expectedBalance.toString(),
                actualBalance: actualBalance.toString(),
                difference: difference.toString(),
                tolerance: this.toleranceLamports.toString(),
            }
        );
    }

    private async recordDiff(
        alertType: string,
        severity: string,
        message: string,
        metadata: Record<string, unknown>
    ): Promise<number> {
        await this.alertEngine.createQueuedAlert(this.prisma, {
            alertType,
            severity,
            message,
            metadata: metadata as any,
        });

        return 1;
    }

    private compareField(
        mismatches: Record<string, { db: string; onChain: string }>,
        field: string,
        dbValue: string | bigint,
        onChainValue: string | bigint
    ): void {
        if (dbValue === onChainValue) {
            return;
        }

        mismatches[field] = {
            db: dbValue.toString(),
            onChain: onChainValue.toString(),
        };
    }
}
