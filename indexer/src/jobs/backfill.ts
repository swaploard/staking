import { PrismaClient } from "@prisma/client";
import { RpcClient } from "../rpc/client";
import { TransactionIngestor } from "../ingestion/parser";
import { Logger } from "../logger";

/**
 * BackfillJob — Signature-based historical transaction indexing
 *
 * Instead of scanning every block sequentially (GapFillJob),
 * this uses getSignaturesForAddress to find actual staking program
 * transactions directly, which is orders of magnitude faster.
 */
export class BackfillJob {
    private logger: Logger;

    constructor(
        private prisma: PrismaClient,
        private rpcClient: RpcClient,
        private ingestor: TransactionIngestor,
        private stakingProgramId: string
    ) {
        this.logger = new Logger("BackfillJob");
    }

    /**
     * Backfill all historical transactions for the staking program.
     * Uses getSignaturesForAddress to paginate through all transactions.
     *
     * @param limit Max signatures per RPC page (default 100, max 1000)
     * @param maxPages Safety cap on number of pages to fetch (0 = unlimited)
     */
    async run(limit: number = 100, maxPages: number = 0): Promise<{
        totalFound: number;
        ingested: number;
        skipped: number;
        failed: number;
    }> {
        this.logger.info(
            `Starting backfill for program ${this.stakingProgramId}...`
        );

        // Clean up stale "processing" entries from previous failed runs
        // so they can be re-ingested cleanly
        const cleanedProcessing = await this.prisma.processedSignature.deleteMany({
            where: { status: "processing" },
        });
        if (cleanedProcessing.count > 0) {
            this.logger.info(
                `Cleaned up ${cleanedProcessing.count} stale processing entries`
            );
        }

        // Also clean up "completed" entries that have NO matching TxActivity rows
        // (ghost completions from rolled-back transactions in previous buggy runs)
        const completedSigs = await this.prisma.processedSignature.findMany({
            where: { status: "completed" },
            select: { signature: true },
        });

        if (completedSigs.length > 0) {
            const sigList = completedSigs.map((s) => s.signature);
            const existingActivity = await this.prisma.txActivity.findMany({
                where: { signature: { in: sigList } },
                select: { signature: true },
                distinct: ["signature"],
            });
            const activitySet = new Set(existingActivity.map((a) => a.signature));
            const orphaned = sigList.filter((sig) => !activitySet.has(sig));

            if (orphaned.length > 0) {
                await this.prisma.processedSignature.deleteMany({
                    where: { signature: { in: orphaned } },
                });
                this.logger.info(
                    `Cleaned up ${orphaned.length} orphaned completed entries (no TxActivity)`
                );
            }
        }

        let before: string | undefined;
        let page = 0;
        let totalFound = 0;
        let ingested = 0;
        let skipped = 0;
        let failed = 0;

        while (true) {
            if (maxPages > 0 && page >= maxPages) {
                this.logger.info(
                    `Reached max pages limit (${maxPages}), stopping`
                );
                break;
            }

            this.logger.info(
                `Fetching signatures page ${page + 1}${before ? ` (before: ${before.slice(0, 16)}...)` : ""}...`
            );

            const signatures = await this.rpcClient.getSignaturesForAddress(
                this.stakingProgramId,
                {
                    limit,
                    before,
                },
                { commitment: "confirmed" }
            );

            if (signatures.length === 0) {
                this.logger.info("No more signatures found, backfill complete");
                break;
            }

            totalFound += signatures.length;
            this.logger.info(
                `Found ${signatures.length} signatures (total: ${totalFound})`
            );

            // Process each signature
            for (const sigInfo of signatures) {
                if (sigInfo.err) {
                    this.logger.debug(
                        `Skipping failed tx: ${sigInfo.signature}`
                    );
                    skipped++;
                    continue;
                }

                try {
                    const result = await this.ingestor.ingestSignature(
                        sigInfo.signature
                    );

                    if (result.success) {
                        ingested++;
                    } else if (
                        result.error?.includes("already processed") ||
                        result.error?.includes("Could not claim")
                    ) {
                        skipped++;
                    } else {
                        this.logger.warn(
                            `Failed to ingest ${sigInfo.signature}: ${result.error}`
                        );
                        failed++;
                    }
                } catch (error) {
                    this.logger.error(
                        `Error ingesting ${sigInfo.signature}:`,
                        error
                    );
                    failed++;
                }
            }

            this.logger.info(
                `Page ${page + 1} done — ingested: ${ingested}, skipped: ${skipped}, failed: ${failed}`
            );

            // Move cursor to oldest signature for next page
            before = signatures[signatures.length - 1].signature;
            page++;
        }

        this.logger.info(
            `Backfill complete: ${totalFound} found, ${ingested} ingested, ${skipped} skipped, ${failed} failed`
        );

        return { totalFound, ingested, skipped, failed };
    }

    /**
     * Reset the IndexerCursor to the current slot so gap-fill
     * starts tracking from now instead of millions of slots behind.
     */
    async resetCursor(): Promise<void> {
        const currentSlot = await this.rpcClient.getSlot("confirmed");
        const startSlot = Math.max(0, currentSlot - 10); // small buffer

        await this.prisma.indexerCursor.upsert({
            where: { id: 1 },
            update: {
                lastProcessedSlot: BigInt(startSlot),
            },
            create: {
                id: 1,
                lastProcessedSlot: BigInt(startSlot),
            },
        });

        // Also mark all old unprocessed SlotProgress entries as processed
        // so gap-fill doesn't try to process millions of stale slots
        await this.prisma.slotProgress.updateMany({
            where: {
                slot: { lte: BigInt(startSlot) },
                processed: false,
            },
            data: { processed: true },
        });

        this.logger.info(
            `Cursor reset to slot ${startSlot} (current: ${currentSlot})`
        );
    }
}
