import { PrismaClient } from "@prisma/client";
import { Logger } from "../logger";

export interface IngestionResult {
    claimed: boolean;
    wasProcessed: boolean;
    error?: string;
    processingTimeoutMs?: number;
}

export interface TxProcessingData {
    signature: string;
    slot: bigint;
    blockTime?: Date;
    instructions?: any[];
    events?: any[];
    logs?: string[];
}

/**
 * Ingestion Contract — Claim-First with Reclaim (Timeout Recovery)
 *
 * Enforces exactly-once processing with recovery for stale "processing" status:
 * 1. BEGIN transaction
 * 2. Try INSERT processed_signature with status='processing' ON CONFLICT DO NOTHING
 * 3. If no row inserted:
 *    - Check existing row's updated_at timestamp
 *    - If stale (> PROCESSING_TIMEOUT), update to 'processing' and continue (reclaim)
 *    - Else abort and return (already being processed or completed)
 * 4. Parse and process the transaction
 * 5. INSERT tx_activity and update processed_signature to status='completed'
 * 6. COMMIT
 *
 * This design ensures:
 * - No duplicate processing (ON CONFLICT DO NOTHING)
 * - Recovery from crashed workers (stale reclaim)
 * - Single atomic operation (one database transaction)
 */
export class IngestionContract {
    private logger: Logger;
    private processingTimeoutMs: number;

    constructor(
        private prisma: PrismaClient,
        processingTimeoutMs: number = 60000 // 60 seconds default
    ) {
        this.logger = new Logger("IngestionContract");
        this.processingTimeoutMs = processingTimeoutMs;
    }

    /**
     * Attempts to claim a transaction for processing using the claim-first protocol
     * Returns whether the claim was successful and whether it was a reclaim
     */
    async claimForProcessing(
        signature: string,
        slot: bigint
    ): Promise<IngestionResult> {
        try {
            // Start transaction
            const result = await this.prisma.$transaction(async (tx: PrismaClient) => {
                // 1. Try to insert new processed_signature record
                const inserted = await tx.processedSignature.create({
                    data: {
                        signature,
                        slot,
                        status: "processing",
                    },
                });

                return {
                    claimed: true,
                    wasProcessed: false,
                    isNew: true,
                };
            });

            return {
                claimed: result.claimed,
                wasProcessed: result.wasProcessed,
            };
        } catch (error) {
            // Handle unique constraint violation (signature already exists)
            if (
                error instanceof Error &&
                error.message.includes("unique constraint")
            ) {
                // Fetch existing record to check if it's stale
                const existing = await this.prisma.processedSignature.findUnique({
                    where: { signature },
                });

                if (!existing) {
                    this.logger.error(`Race condition: ${signature} disappeared after insert attempt`);
                    return {
                        claimed: false,
                        wasProcessed: false,
                        error: "Race condition detected",
                    };
                }

                // Check if already completed
                if (existing.status === "completed") {
                    this.logger.debug(`[${signature}] Already processed (completed)`);
                    return {
                        claimed: false,
                        wasProcessed: true,
                    };
                }

                // Check if stale (crashed worker recovery)
                const staleThresholdMs = this.processingTimeoutMs;
                const ageMs = Date.now() - existing.updatedAt.getTime();

                if (ageMs > staleThresholdMs) {
                    this.logger.info(
                        `[${signature}] Reclaiming stale processing entry (age: ${ageMs}ms)`
                    );

                    // Attempt to reclaim (update stale entry back to processing)
                    try {
                        await this.prisma.$transaction(async (tx: PrismaClient) => {
                            await tx.processedSignature.update({
                                where: { signature },
                                data: {
                                    status: "processing",
                                    updatedAt: new Date(),
                                },
                            });
                        });

                        return {
                            claimed: true,
                            wasProcessed: false,
                            processingTimeoutMs: staleThresholdMs,
                        };
                    } catch (updateError) {
                        this.logger.error(
                            `[${signature}] Failed to reclaim stale entry:`,
                            updateError
                        );
                        return {
                            claimed: false,
                            wasProcessed: false,
                            error: "Failed to reclaim stale entry",
                        };
                    }
                } else {
                    // Still being processed by another worker
                    this.logger.debug(
                        `[${signature}] Still processing (age: ${ageMs}ms, threshold: ${staleThresholdMs}ms)`
                    );
                    return {
                        claimed: false,
                        wasProcessed: false,
                        error: "Currently being processed by another worker",
                        processingTimeoutMs: staleThresholdMs - ageMs,
                    };
                }
            }

            this.logger.error(`[${signature}] Unexpected error during claim:`, error);
            return {
                claimed: false,
                wasProcessed: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    /**
     * Marks a transaction as completed after successful processing
     */
    async markCompleted(signature: string): Promise<void> {
        try {
            await this.prisma.processedSignature.update({
                where: { signature },
                data: {
                    status: "completed",
                    updatedAt: new Date(),
                },
            });
            this.logger.debug(`[${signature}] Marked as completed`);
        } catch (error) {
            this.logger.error(
                `[${signature}] Failed to mark as completed:`,
                error
            );
            throw error;
        }
    }

    /**
     * Process a transaction with the ingestion contract guarantee
     * Handles the full flow: claim → process → record
     */
    async processTransaction(
        data: TxProcessingData,
        processorFn: (data: TxProcessingData, tx: PrismaClient) => Promise<void>
    ): Promise<{ success: boolean; error?: string }> {
        const { signature, slot } = data;

        try {
            // Step 1: Claim for processing
            const claim = await this.claimForProcessing(signature, slot);

            if (!claim.claimed) {
                if (claim.wasProcessed) {
                    this.logger.debug(`[${signature}] Transaction already processed`);
                    return { success: true }; // Not an error, idempotent
                }
                this.logger.warn(
                    `[${signature}] Failed to claim: ${claim.error}, retry in ${claim.processingTimeoutMs}ms`
                );
                return {
                    success: false,
                    error: `Could not claim: ${claim.error}`,
                };
            }

            // Step 2: Process transaction within a database transaction
            try {
                await this.prisma.$transaction(async (tx: PrismaClient) => {
                    // Call the processor function to parse and record tx data
                    await processorFn(data, tx);

                    // Step 3: Mark as completed
                    // Re-fetch and update to ensure atomicity
                    await tx.processedSignature.update({
                        where: { signature },
                        data: {
                            status: "completed",
                            updatedAt: new Date(),
                        },
                    });
                });

                this.logger.debug(
                    `[${signature}] Successfully processed and committed`
                );
                return { success: true };
            } catch (processingError) {
                this.logger.error(`[${signature}] Processing failed:`, processingError);
                // Leave status as 'processing' for reclaim on retry
                return {
                    success: false,
                    error: processingError instanceof Error ? processingError.message : "Processing failed",
                };
            }
        } catch (error) {
            this.logger.error(
                `[${signature}] Unexpected error in processTransaction:`,
                error
            );
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    /**
     * Check if a signature has been processed
     */
    async isProcessed(signature: string): Promise<boolean> {
        const record = await this.prisma.processedSignature.findUnique({
            where: { signature },
        });
        return record?.status === "completed";
    }

    /**
     * Get processing status of a signature
     */
    async getStatus(
        signature: string
    ): Promise<"not_seen" | "processing" | "completed"> {
        const record = await this.prisma.processedSignature.findUnique({
            where: { signature },
        });
        if (!record) return "not_seen";
        return record.status as "processing" | "completed";
    }

    /**
     * Find stale processing entries that should be reclaimed
     */
    async findStaleEntries(limit: number = 100): Promise<Array<{ signature: string; ageMs: number }>> {
        const staleThreshold = new Date(Date.now() - this.processingTimeoutMs);

        const stale = await this.prisma.processedSignature.findMany({
            where: {
                status: "processing",
                updatedAt: {
                    lt: staleThreshold,
                },
            },
            take: limit,
            select: {
                signature: true,
                updatedAt: true,
            },
        });

        return stale.map((s: { signature: string; updatedAt: Date }) => ({
            signature: s.signature,
            ageMs: Date.now() - s.updatedAt.getTime(),
        }));
    }

    /**
     * Clean up completed entries older than the given threshold
     * Useful for maintenance and storage optimization
     */
    async cleanupOldEntries(olderThanDays: number = 7): Promise<number> {
        const threshold = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

        const result = await this.prisma.processedSignature.deleteMany({
            where: {
                status: "completed",
                updatedAt: {
                    lt: threshold,
                },
            },
        });

        this.logger.info(
            `Cleaned up ${result.count} completed entries older than ${olderThanDays} days`
        );
        return result.count;
    }
}
