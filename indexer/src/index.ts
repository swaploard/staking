import { PrismaClient } from "@prisma/client";
import { Logger } from "./logger";
import { RpcClient } from "./rpc/client";
import { TransactionIngestor } from "./ingestion/parser";
import { AccountSyncJob } from "./jobs/accountSync";
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
     * Clean up resources
     */
    async shutdown(): Promise<void> {
        logger.info("Shutting down indexer...");
        this.running = false;

        // Stop scheduled sync
        this.stopScheduledSync();

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
            logger.info("  status                  - Show status");
            logger.info("\nExamples:");
            logger.info(
                '  node dist/index.js process 3Abcdef123... (base58 tx signature)'
            );
            logger.info("  node dist/index.js sync-accounts");
            logger.info("  node dist/index.js start-sync 60000");
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
