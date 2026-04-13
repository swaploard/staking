import { PrismaClient } from "@prisma/client";
import { Logger } from "../logger";
import { RpcClient } from "../rpc/client";

interface PendingSignatureRow {
    signature: string;
    slot: bigint;
}

export class FinalizerJob {
    private logger = new Logger("FinalizerJob");
    private running = false;
    private readonly cursorId = 3;
    private readonly dropAfterSlots: bigint;

    constructor(
        private prisma: PrismaClient,
        private rpcClient: RpcClient
    ) {
        this.dropAfterSlots = BigInt(
            process.env.FINALIZER_DROP_AFTER_SLOTS || "150"
        );
    }

    async start(intervalMs: number = 30000): Promise<void> {
        if (this.running) {
            this.logger.warn("Finalizer already running");
            return;
        }

        this.running = true;

        while (this.running) {
            try {
                await this.runOnce();
            } catch (error) {
                this.logger.error("Finalizer loop failed", error);
            }

            if (this.running) {
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }
        }
    }

    stop(): void {
        this.running = false;
    }

    async runOnce(batchSize: number = 100): Promise<{
        checked: number;
        finalized: number;
        failed: number;
        dropped: number;
    }> {
        await this.ensureCursor();

        const currentFinalizedSlot = await this.rpcClient.getSlot("finalized");
        const pending = await this.fetchPendingSignatures(batchSize);

        let finalized = 0;
        let failed = 0;
        let dropped = 0;

        for (const row of pending) {
            const outcome = await this.finalizeSignature(
                row,
                BigInt(currentFinalizedSlot)
            );

            if (outcome === "finalized") {
                finalized++;
            } else if (outcome === "failed") {
                failed++;
            } else if (outcome === "dropped") {
                dropped++;
            }
        }

        await this.prisma.indexerCursor.upsert({
            where: { id: this.cursorId },
            update: {
                lastProcessedSlot: BigInt(currentFinalizedSlot),
            },
            create: {
                id: this.cursorId,
                lastProcessedSlot: BigInt(currentFinalizedSlot),
            },
        });

        this.logger.info(
            `Finalizer checked ${pending.length} signatures (finalized=${finalized}, failed=${failed}, dropped=${dropped})`
        );

        return {
            checked: pending.length,
            finalized,
            failed,
            dropped,
        };
    }

    private async ensureCursor(): Promise<void> {
        await this.prisma.indexerCursor.upsert({
            where: { id: this.cursorId },
            update: {},
            create: {
                id: this.cursorId,
                lastProcessedSlot: 0n,
            },
        });
    }

    private async fetchPendingSignatures(
        batchSize: number
    ): Promise<PendingSignatureRow[]> {
        const rows = await this.prisma.$queryRawUnsafe<
            Array<{ signature: string; slot: bigint }>
        >(
            `
                SELECT "signature", MIN("slot") AS "slot"
                FROM "TxActivity"
                WHERE "status" = 'confirmed'
                GROUP BY "signature"
                ORDER BY MIN("slot") ASC, "signature" ASC
                LIMIT $1
            `,
            batchSize
        );

        return rows.map((row) => ({
            signature: row.signature,
            slot: BigInt(row.slot),
        }));
    }

    private async finalizeSignature(
        row: PendingSignatureRow,
        currentFinalizedSlot: bigint
    ): Promise<"finalized" | "failed" | "dropped" | "pending"> {
        const finalizedTx = await this.rpcClient.getTransaction(row.signature, {
            commitment: "finalized",
        });

        if (finalizedTx) {
            const status = finalizedTx.meta?.err ? "failed" : "finalized";

            await this.prisma.txActivity.updateMany({
                where: {
                    signature: row.signature,
                    status: "confirmed",
                },
                data: {
                    status,
                    blockTime: finalizedTx.blockTime
                        ? new Date(finalizedTx.blockTime * 1000)
                        : undefined,
                },
            });

            return status;
        }

        const statuses = await this.rpcClient.getSignatureStatuses([
            row.signature,
        ]);
        const signatureStatus = statuses.value[0];

        if (signatureStatus?.err) {
            await this.prisma.txActivity.updateMany({
                where: {
                    signature: row.signature,
                    status: "confirmed",
                },
                data: {
                    status: "failed",
                },
            });

            return "failed";
        }

        const isOldEnoughToDrop =
            currentFinalizedSlot - row.slot >= this.dropAfterSlots;

        if (!signatureStatus && isOldEnoughToDrop) {
            await this.prisma.txActivity.updateMany({
                where: {
                    signature: row.signature,
                    status: "confirmed",
                },
                data: {
                    status: "dropped",
                },
            });

            return "dropped";
        }

        return "pending";
    }
}
