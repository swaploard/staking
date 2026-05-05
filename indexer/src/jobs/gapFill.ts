import { PrismaClient } from "@prisma/client";
import { RpcClient } from "../rpc/client";
import { Logger } from "../logger";
import { TransactionIngestor } from "../ingestion/parser";
import pLimit from "p-limit";

export class GapFillJob {
    private logger: Logger;
    private running: boolean = false;
    private readonly cursorId = 1;

    constructor(
        private prisma: PrismaClient,
        private rpcClient: RpcClient,
        private ingestor: TransactionIngestor,
        private stakingProgramId: string
    ) {
        this.logger = new Logger("GapFillJob");
    }

    /**
     * Start the gap fill and continuity loop
     */
    async start(intervalMs: number = 30000): Promise<void> {
        if (this.running) {
            this.logger.warn("GapFillJob is already running");
            return;
        }

        this.running = true;
        this.logger.info("Starting Slot Continuity and Gap Fill Job...");

        // Initialize cursor if needed
        await this.initializeCursor();

        // Run continuously
        while (this.running) {
            try {
                await this.runContinuityGuard();
            } catch (error) {
                this.logger.error("Error in check loop:", error);
            }

            // Wait until next interval
            if (this.running) {
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }
        }
    }

    stop(): void {
        this.running = false;
        this.logger.info("GapFillJob stopped");
    }

    /**
     * Ensure we have an active cursor
     */
    private async initializeCursor(): Promise<void> {
        const cursor = await this.prisma.indexerCursor.findUnique({
            where: { id: this.cursorId },
        });

        if (!cursor) {
            const currentSlot = await this.rpcClient.getSlot("confirmed");
            // Start from 100 slots ago to be safe
            const startSlot = Math.max(0, currentSlot - 100);
            
            await this.prisma.indexerCursor.create({
                data: {
                    id: this.cursorId,
                    lastProcessedSlot: BigInt(startSlot),
                },
            });
            this.logger.info(`Initialized cursor at slot ${startSlot}`);
        }
    }

    /**
     * Core continuity logic
     */
    private async runContinuityGuard(): Promise<void> {
        const cursor = await this.prisma.indexerCursor.findUnique({
            where: { id: this.cursorId },
        });

        if (!cursor) return;

        const lastSlot = Number(cursor.lastProcessedSlot);
        const currentSlot = await this.rpcClient.getSlot("confirmed");

        if (currentSlot <= lastSlot) {
            return; // Up to date
        }

        // Fetch up to 100 blocks at a time to prevent RPC timeouts
        const targetSlot = Math.min(lastSlot + 100, currentSlot);

        this.logger.info(`Checking slots ${lastSlot + 1} to ${targetSlot}...`);

        // 1. Discover valid blocks
        const blocks = await this.rpcClient.getBlocks(lastSlot + 1, targetSlot);

        if (blocks.length > 0) {
            this.logger.info(`Discovered ${blocks.length} expected blocks`);

            // 2. Upsert them into SlotProgress as unprocessed
            await this.prisma.$transaction(
                blocks.map((slot: number) =>
                    this.prisma.slotProgress.upsert({
                        where: { slot: BigInt(slot) },
                        update: {}, // if exists, don't change anything
                        create: {
                            slot: BigInt(slot),
                            processed: false,
                            source: "getBlocks",
                        },
                    })
                )
            );

            // 3. Process missing / unprocessed slots
            const unprocessed = await this.prisma.slotProgress.findMany({
                where: {
                    slot: {
                        in: blocks.map((b) => BigInt(b)),
                    },
                    processed: false,
                },
                orderBy: { slot: "asc" },
            });

            if (unprocessed.length > 0) {
                this.logger.info(`Processing ${unprocessed.length} missing slots...`);
                
                // Concurrency control to not spam RPC
                const limit = pLimit(5);
                await Promise.all(
                    unprocessed.map((entry) =>
                        limit(() => this.processSlot(Number(entry.slot)))
                    )
                );
            }
        } else {
            this.logger.debug(`No valid blocks found between ${lastSlot + 1} and ${targetSlot}`);
        }

        // 4. Advance Cursor (only if all in range are done)
        // Check if any unprocessed block exist below targetSlot
        const anyUnprocessed = await this.prisma.slotProgress.findFirst({
            where: {
                slot: {
                    lte: BigInt(targetSlot),
                },
                processed: false,
            },
        });

        if (!anyUnprocessed) {
            await this.prisma.indexerCursor.update({
                where: { id: this.cursorId },
                data: {
                    lastProcessedSlot: BigInt(targetSlot),
                },
            });
            this.logger.info(`Advanced cursor to slot ${targetSlot}`);
        } else {
            this.logger.warn(`Could not advance cursor to ${targetSlot} due to unprocessed slots like ${anyUnprocessed.slot}. Will retry missing slots later.`);
        }
    }

    /**
     * Fetch a full block, extract pertinent transactions, and ingest them
     */
    private async processSlot(slot: number): Promise<void> {
        try {
            // Fetch block with maxSupportedTransactionVersion so it doesn't crash on versioned txs
            const block = await this.rpcClient.getBlock(slot, {
                transactionDetails: "full",
                rewards: false,
                maxSupportedTransactionVersion: 0,
            });

            if (!block) {
                // Block was skipped / null
                await this.markSlotProcessed(slot);
                return;
            }

            const transactions = block.transactions || [];
            const relevantSignatures: string[] = [];

            // Find transactions associated with our staking program
            for (const tx of transactions) {
                if (!tx.transaction || !tx.transaction.message) continue;
                
                const message = tx.transaction.message;
                // Handle both legacy (accountKeys) and versioned (staticAccountKeys) transactions
                const accountKeys = (message as any).accountKeys || (message as any).staticAccountKeys || [];
                
                const addresses = accountKeys.map((key: any) => 
                    key?.pubkey ? key.pubkey.toString() : key.toString()
                );

                if (addresses.includes(this.stakingProgramId)) {
                    relevantSignatures.push(
                        // @ts-ignore
                        tx.transaction.signatures ? tx.transaction.signatures[0] : tx.transaction.signatures[0]
                    );
                }
            }

            if (relevantSignatures.length > 0) {
                this.logger.info(`Found ${relevantSignatures.length} relevant transactions in slot ${slot}`);
                
                // Process each signature sequentially here to ensure idempotency block logic
                for (const sig of relevantSignatures) {
                    await this.ingestor.ingestSignature(sig);
                }
            }

            // Mark slot as fully processed
            await this.markSlotProcessed(slot);

        } catch (error: any) {
            this.logger.error(`Error processing slot ${slot}:`, error.message || String(error));
            // DO NOT mark as processed, so it will be retried next tick
        }
    }

    private async markSlotProcessed(slot: number): Promise<void> {
        await this.prisma.slotProgress.update({
            where: { slot: BigInt(slot) },
            data: { processed: true },
        });
    }
}
