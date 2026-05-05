import { PrismaClient } from "@prisma/client";
import { Logger } from "./logger";
import { RpcClient } from "./rpc/client";
import { TransactionIngestor } from "./ingestion/parser";
import { AccountSyncJob } from "./jobs/accountSync";
import { GapFillJob } from "./jobs/gapFill";
import { runIdempotencyTest } from "./jobs/idempotencyTest";
import { ReconcilerJob } from "./jobs/reconciler";
import { AlertProcessorJob } from "./jobs/alertProcessor";
import { PartitionTunerJob } from "./jobs/partitionTuner";
import { FinalizerJob } from "./jobs/finalizer";
import { BackfillJob } from "./jobs/backfill";
import pLimit from "p-limit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const logger = new Logger("Indexer");

/**
 * Main Indexer Application
 *
 * Step 1 (MVP):
 * - Initialize database connection
 * - Set up RPC client with failover
 * - Basic transaction ingestion (confirmed only)
 * - Ingestion contract guarantee (exactly-once)
 * - Simple CLI to ingest transactions by signature
 */
class StakingIndexer {
    private prisma!: PrismaClient;
    private rpcClient!: RpcClient;
    private ingestor!: TransactionIngestor;
    private accountSync!: AccountSyncJob;
    private gapFillJob!: GapFillJob;
    private reconcilerJob!: ReconcilerJob;
    private alertProcessorJob!: AlertProcessorJob;
    private partitionTuner!: PartitionTunerJob;
    private finalizerJob!: FinalizerJob;
    private backfillJob!: BackfillJob;
    private running: boolean = false;
    private accountSyncInterval: NodeJS.Timeout | null = null;

    async initialize(): Promise<void> {
        logger.info("Initializing Staking Indexer...");

        // Load environment variables
        const dbUrl = process.env.DATABASE_URL;
        const rpcEndpoint = process.env.RPC_ENDPOINT || "http://localhost:8899";
        const rpcFallback = process.env.RPC_ENDPOINT_FALLBACK;
        const stakingProgramId =
            process.env.STAKING_PROGRAM_ID ||
            "7TjUWKKLqxQVxSWqVFN9PqpNFe8Q8RhXFDx3CGrQZsm";
        const processingTimeoutMs = parseInt(
            process.env.PROCESSING_TIMEOUT_MS || "60000"
        );

        if (!dbUrl) {
            throw new Error(
                "DATABASE_URL not set. Please set DATABASE_URL environment variable."
            );
        }

        // Initialize Prisma
        this.prisma = new PrismaClient();
        logger.info("Connected to database");

        // Verify database connection
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            logger.info("Database connection verified");
        } catch (error) {
            logger.error("Failed to connect to database:", error);
            throw error;
        }

        // Initialize RPC client
        const endpoints = rpcFallback
            ? rpcFallback.split(",").map((e) => e.trim())
            : [];
        this.rpcClient = new RpcClient(rpcEndpoint, endpoints);
        logger.info(`RPC client initialized with ${this.rpcClient}`);

        // Initialize transaction ingestor
        this.ingestor = new TransactionIngestor(
            this.prisma,
            this.rpcClient,
            stakingProgramId,
            processingTimeoutMs
        );
        logger.info("Transaction ingestor initialized");

        // Initialize account sync job
        this.accountSync = new AccountSyncJob(
            this.prisma,
            this.rpcClient,
            stakingProgramId
        );
        logger.info("Account sync job initialized");

        // Initialize gap fill job
        this.gapFillJob = new GapFillJob(
            this.prisma,
            this.rpcClient,
            this.ingestor,
            stakingProgramId
        );
        logger.info("Gap fill job initialized");

        this.reconcilerJob = new ReconcilerJob(
            this.prisma,
            this.rpcClient,
            stakingProgramId
        );
        logger.info("Reconciler job initialized");

        this.alertProcessorJob = new AlertProcessorJob(this.prisma);
        logger.info("Alert processor initialized");

        this.partitionTuner = new PartitionTunerJob(this.prisma);
        logger.info("Partition tuner initialized");

        this.finalizerJob = new FinalizerJob(this.prisma, this.rpcClient);
        logger.info("Finalizer job initialized");

        this.backfillJob = new BackfillJob(
            this.prisma,
            this.rpcClient,
            this.ingestor,
            stakingProgramId
        );
        logger.info("Backfill job initialized");

        // Run initialization checks
        await this.runInitializationChecks();
    }

    /**
     * Run basic health checks during startup
     */
    private async runInitializationChecks(): Promise<void> {
        logger.info("Running initialization checks...");

        try {
            // Check database tables exist
            const tables = await this.prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
            logger.info(`Found ${(tables as any[]).length} tables in database`);

            // Test RPC connection
            const slot = await this.rpcClient.getSlot("confirmed");
            logger.info(`Current slot: ${slot}`);

            const metrics = this.rpcClient.getMetrics();
            logger.info(`RPC metrics: ${JSON.stringify(metrics)}`);
        } catch (error) {
            logger.warn("Some initialization checks failed:", error);
        }
    }

    /**
     * Process a single transaction by signature
     */
    async processTransaction(signature: string): Promise<void> {
        logger.info(`Processing transaction: ${signature}`);

        try {
            const result = await this.ingestor.ingestSignature(signature);

            if (result.success) {
                logger.info(
                    `✓ Successfully processed ${signature} (was processed: ${result.wasProcessed})`
                );
            } else {
                logger.warn(
                    `✗ Failed to process ${signature}: ${result.error}`
                );
            }
        } catch (error) {
            logger.error(`Processing failed for ${signature}:`, error);
        }
    }

    /**
     * Batch process multiple signatures
     */
    async processBatch(signatures: string[], concurrency: number = 5): Promise<{
        total: number;
        succeeded: number;
        failed: number;
    }> {
        logger.info(`Processing batch of ${signatures.length} signatures...`);

        const limit = pLimit(concurrency);
        const results = await Promise.allSettled(
            signatures.map((sig) =>
                limit(() => this.ingestor.ingestSignature(sig))
            )
        );

        const succeeded = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.filter((r) => r.status === "rejected").length;

        logger.info(
            `Batch complete: ${succeeded} succeeded, ${failed} failed out of ${signatures.length}`
        );

        return {
            total: signatures.length,
            succeeded,
            failed,
        };
    }

    /**
     * Sync all on-chain accounts (pools and user positions)
     */
    async syncAccounts(): Promise<void> {
        try {
            logger.info("Starting account sync...");
            await this.accountSync.sync();
            logger.info("✓ Account sync completed successfully");
        } catch (error) {
            logger.error("Account sync failed:", error);
            throw error;
        }
    }

    /**
     * Start scheduled account sync (every N milliseconds)
     */
    startScheduledSync(intervalMs: number = 60000): void {
        if (this.accountSyncInterval) {
            logger.warn("Account sync already scheduled");
            return;
        }

        logger.info(`Starting scheduled account sync every ${intervalMs}ms`);

        // Run immediately once
        this.syncAccounts().catch((error) => {
            logger.error("Initial sync failed:", error);
        });

        // Then scheduled
        this.accountSyncInterval = setInterval(() => {
            this.syncAccounts().catch((error) => {
                logger.error("Scheduled sync failed:", error);
            });
        }, intervalMs);
    }

    /**
     * Stop scheduled account sync
     */
    stopScheduledSync(): void {
        if (this.accountSyncInterval) {
            clearInterval(this.accountSyncInterval);
            this.accountSyncInterval = null;
            logger.info("Scheduled account sync stopped");
        }
    }

    /**
     * Start gap fill job
     */
    startGapFill(intervalMs: number = 30000): void {
        this.gapFillJob.start(intervalMs).catch(error => {
            logger.error("GapFillJob failed:", error);
        });
    }

    /**
     * Stop gap fill job
     */
    stopGapFill(): void {
        if (this.gapFillJob) {
            this.gapFillJob.stop();
        }
    }

    async runReconciler(): Promise<void> {
        await this.reconcilerJob.runOnce();
    }

    startReconciler(intervalMs: number = 300000): void {
        this.reconcilerJob.start(intervalMs).catch((error) => {
            logger.error("ReconcilerJob failed:", error);
        });
    }

    stopReconciler(): void {
        if (this.reconcilerJob) {
            this.reconcilerJob.stop();
        }
    }

    async runAlertProcessor(batchSize: number = 20): Promise<void> {
        await this.alertProcessorJob.runOnce(batchSize);
    }

    startAlertProcessor(intervalMs: number = 15000): void {
        this.alertProcessorJob.start(intervalMs).catch((error) => {
            logger.error("AlertProcessorJob failed:", error);
        });
    }

    stopAlertProcessor(): void {
        if (this.alertProcessorJob) {
            this.alertProcessorJob.stop();
        }
    }

    async runFinalizer(batchSize: number = 100): Promise<void> {
        await this.finalizerJob.runOnce(batchSize);
    }

    startFinalizer(intervalMs: number = 30000): void {
        this.finalizerJob.start(intervalMs).catch((error) => {
            logger.error("FinalizerJob failed:", error);
        });
    }

    stopFinalizer(): void {
        if (this.finalizerJob) {
            this.finalizerJob.stop();
        }
    }

    async tunePartitions(
        startSlot: bigint,
        endSlot: bigint,
        partitionSize: bigint = 1_000_000n
    ): Promise<void> {
        await this.partitionTuner.ensureFuturePartitions(
            startSlot,
            endSlot,
            partitionSize
        );
    }

    /**
     * Backfill historical transactions using getSignaturesForAddress
     */
    async runBackfill(maxPages: number = 0): Promise<{
        totalFound: number;
        ingested: number;
        skipped: number;
        failed: number;
    }> {
        return this.backfillJob.run(100, maxPages);
    }

    /**
     * Reset gap-fill cursor to current slot
     */
    async resetCursor(): Promise<void> {
        return this.backfillJob.resetCursor();
    }

    /**
     * Clean up resources
     */
    async shutdown(): Promise<void> {
        logger.info("Shutting down indexer...");
        this.running = false;

        // Stop scheduled jobs
        this.stopScheduledSync();
        this.stopGapFill();
        this.stopReconciler();
        this.stopAlertProcessor();
        this.stopFinalizer();

        try {
            await this.prisma.$disconnect();
            logger.info("Database connection closed");
        } catch (error) {
            logger.error("Error during shutdown:", error);
        }
    }

    /**
     * Get current status
     */
    getStatus(): {
        running: boolean;
        rpcHealth: any;
        version: "1.0.0" | string;
    } {
        return {
            running: this.running,
            rpcHealth: this.rpcClient.getHealth(),
            version: "1.0.0",
        };
    }
}

/**
 * CLI Interface for Step 1 MVP
 */
async function main() {
    const indexer = new StakingIndexer();

    try {
        // Initialize
        await indexer.initialize();
        logger.info("✓ Indexer initialized successfully");

        // Example: Process some test transactions if provided as command line args
        const args = process.argv.slice(2);

        if (args.length > 0) {
            if (args[0] === "process" && args[1]) {
                // Process single signature: node dist/index.js process <signature>
                await indexer.processTransaction(args[1]);
            } else if (args[0] === "batch" && args[1]) {
                // Process batch: node dist/index.js batch <sig1> <sig2> ...
                await indexer.processBatch(args.slice(1));
            } else if (args[0] === "sync-accounts") {
                // Sync accounts once: node dist/index.js sync-accounts
                await indexer.syncAccounts();
            } else if (args[0] === "start-sync") {
                // Start scheduled sync: node dist/index.js start-sync [intervalMs]
                const intervalMs = parseInt(args[1], 10) || 60000;
                logger.info(`Starting account sync scheduler (interval: ${intervalMs}ms)`);
                indexer.startScheduledSync(intervalMs);
                // Don't exit - keep running
                logger.info("Account sync is running. Press Ctrl+C to stop.");
                await new Promise(() => { }); // Keep process alive
            } else if (args[0] === "start-gap-fill") {
                // Start gap fill scheduler: node dist/index.js start-gap-fill [intervalMs]
                const intervalMs = parseInt(args[1], 10) || 30000;
                logger.info(`Starting gap fill scheduler (interval: ${intervalMs}ms)`);
                indexer.startGapFill(intervalMs);
                logger.info("Gap fill is running. Press Ctrl+C to stop.");
                await new Promise(() => { }); // Keep process alive
            } else if (args[0] === "test-idempotency") {
                logger.info("Running idempotency load test...");
                await runIdempotencyTest();
            } else if (args[0] === "reconcile") {
                await indexer.runReconciler();
            } else if (args[0] === "start-reconciler") {
                const intervalMs = parseInt(args[1], 10) || 300000;
                logger.info(`Starting reconciler (interval: ${intervalMs}ms)`);
                indexer.startReconciler(intervalMs);
                logger.info("Reconciler is running. Press Ctrl+C to stop.");
                await new Promise(() => {});
            } else if (args[0] === "process-alerts") {
                const batchSize = parseInt(args[1], 10) || 20;
                await indexer.runAlertProcessor(batchSize);
            } else if (args[0] === "start-alerts") {
                const intervalMs = parseInt(args[1], 10) || 15000;
                logger.info(`Starting alert processor (interval: ${intervalMs}ms)`);
                indexer.startAlertProcessor(intervalMs);
                logger.info("Alert processor is running. Press Ctrl+C to stop.");
                await new Promise(() => {});
            } else if (args[0] === "finalize") {
                const batchSize = parseInt(args[1], 10) || 100;
                await indexer.runFinalizer(batchSize);
            } else if (args[0] === "start-finalizer") {
                const intervalMs = parseInt(args[1], 10) || 30000;
                logger.info(`Starting finalizer (interval: ${intervalMs}ms)`);
                indexer.startFinalizer(intervalMs);
                logger.info("Finalizer is running. Press Ctrl+C to stop.");
                await new Promise(() => {});
            } else if (args[0] === "tune-partitions") {
                const startSlot = BigInt(args[1] || "0");
                const endSlot = BigInt(args[2] || args[1] || "0");
                const partitionSize = BigInt(args[3] || "1000000");
                await indexer.tunePartitions(startSlot, endSlot, partitionSize);
            } else if (args[0] === "backfill") {
                // Backfill using getSignaturesForAddress
                const maxPages = parseInt(args[1], 10) || 0;
                logger.info(`Starting backfill${maxPages > 0 ? ` (max ${maxPages} pages)` : " (all history)"}...`);
                const result = await indexer.runBackfill(maxPages);
                logger.info(`Backfill result: ${JSON.stringify(result)}`);
            } else if (args[0] === "reset-cursor") {
                // Reset gap-fill cursor to current slot
                logger.info("Resetting gap-fill cursor to current slot...");
                await indexer.resetCursor();
                logger.info("✓ Cursor reset. You can now run start-gap-fill to track new transactions.");
            } else if (args[0] === "status") {
                // Show status
                const status = indexer.getStatus();
                logger.info(`Indexer status: ${JSON.stringify(status, null, 2)}`);
            }
        } else {
            // Interactive mode (for testing)
            logger.info("Indexer ready. Use CLI commands:");
            logger.info("  process <signature>     - Process a single transaction");
            logger.info("  batch <sig1> <sig2>     - Process multiple transactions");
            logger.info("  sync-accounts           - Sync accounts once");
            logger.info("  start-sync [intervalMs] - Start scheduled account sync (default: 60000ms)");
            logger.info("  start-gap-fill [gapMs]  - Start slot continuity guard and gap fill (default: 30000ms)");
            logger.info("  reconcile               - Run one reconciliation pass");
            logger.info("  start-reconciler [ms]   - Start scheduled reconciliation");
            logger.info("  process-alerts [n]      - Deliver queued alerts once");
            logger.info("  start-alerts [ms]       - Start the alert processor loop");
            logger.info("  finalize [n]            - Finalize up to n confirmed signatures");
            logger.info("  start-finalizer [ms]    - Start the finalizer loop");
            logger.info("  tune-partitions a b [s] - Ensure tx_activity indexes / partitions");
            logger.info("  backfill [maxPages]     - Index historical txs via getSignaturesForAddress");
            logger.info("  reset-cursor            - Reset gap-fill cursor to current slot");
            logger.info("  test-idempotency        - Run concurrent ingestion test to verify idempotency");
            logger.info("  status                  - Show status");
            logger.info("\nExamples:");
            logger.info(
                '  node dist/index.js process 3Abcdef123... (base58 tx signature)'
            );
            logger.info("  node dist/index.js sync-accounts");
            logger.info("  node dist/index.js start-sync 60000");
            logger.info("  node dist/index.js start-gap-fill 30000");
            logger.info("  node dist/index.js reconcile");
            logger.info("  node dist/index.js finalize 100");
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Fatal error: ${errorMessage}`, error);
        process.exit(1);
    } finally {
        await indexer.shutdown();
    }
}

// Run main
main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Indexer error:", errorMessage);
    console.error(error);
    process.exit(1);
});

export { StakingIndexer };
