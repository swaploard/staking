import {
    Connection,
    ConfirmedSignatureInfo,
    ParsedConfirmedTransaction,
    RpcResponseAndContext,
    SignatureStatus,
    TransactionResponse,
    PublicKey,
    AccountInfo,
    TokenAmount,
} from "@solana/web3.js";
import { Logger } from "../logger";

export interface RpcCallOptions {
    commitment?: "confirmed" | "finalized" | "processed";
    retries?: number;
    timeoutMs?: number;
}

export interface RpcMetrics {
    total_calls: number;
    successful_calls: number;
    failed_calls: number;
    failover_count: number;
    rate_limit_hits: number;
    average_latency_ms: number;
}

/**
 * Centralized RPC client with:
 * - Multiple endpoint support with fallback rotation
 * - Automatic retries with exponential backoff
 * - Rate limit handling
 * - Metrics collection
 * - Strict error categorization
 */
export class RpcClient {
    private endpoints: string[];
    private currentIndex: number = 0;
    private connections: Map<string, Connection> = new Map();
    private metrics: RpcMetrics = {
        total_calls: 0,
        successful_calls: 0,
        failed_calls: 0,
        failover_count: 0,
        rate_limit_hits: 0,
        average_latency_ms: 0,
    };
    private logger: Logger;
    private latencies: number[] = [];
    private latencyWindowSize: number = 100;

    constructor(primaryEndpoint: string, fallbackEndpoints: string[] = []) {
        this.endpoints = [primaryEndpoint, ...fallbackEndpoints];
        this.logger = new Logger("RpcClient");
        this.initializeConnections();
    }

    private initializeConnections() {
        for (const endpoint of this.endpoints) {
            this.connections.set(endpoint, new Connection(endpoint, "confirmed"));
        }
    }

    /**
     * Get current active connection
     */
    private getConnection(): Connection {
        const endpoint = this.endpoints[this.currentIndex];
        return this.connections.get(endpoint)!;
    }

    /**
     * Rotate to next endpoint (failover)
     */
    private rotateEndpoint() {
        const previousIndex = this.currentIndex;
        this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;

        if (this.currentIndex !== previousIndex) {
            this.metrics.failover_count++;
            this.logger.warn(
                `Failover from ${this.endpoints[previousIndex]} to ${this.endpoints[this.currentIndex]}`
            );
        }
    }

    /**
     * Record call latency
     */
    private recordLatency(latencyMs: number) {
        this.latencies.push(latencyMs);
        if (this.latencies.length > this.latencyWindowSize) {
            this.latencies.shift();
        }
        this.metrics.average_latency_ms =
            this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
    }

    /**
     * Determine if error is rate limiting
     */
    private isRateLimitError(error: any): boolean {
        const message = error?.message || "";
        return (
            message.includes("429") ||
            message.includes("Too Many Requests") ||
            message.includes("rate limit")
        );
    }

    /**
     * Determine if error is retriable
     */
    private isRetriableError(error: any): boolean {
        const message = error?.message || "";
        return (
            this.isRateLimitError(error) ||
            message.includes("ECONNREFUSED") ||
            message.includes("ETIMEDOUT") ||
            message.includes("503") ||
            message.includes("502") ||
            message.includes("500")
        );
    }

    /**
     * Execute RPC call with retry + fallover logic
     */
    async call<T>(
        method: string,
        params: any[] = [],
        options: RpcCallOptions = {}
    ): Promise<T> {
        const { commitment = "confirmed", retries = 3, timeoutMs = 30000 } =
            options;

        this.metrics.total_calls++;
        let lastError: any;

        // Try primary endpoint first, then fallback
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const connection = this.getConnection();
                const startTime = Date.now();

                // Add timeout protection
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                let result: T;
                try {
                    // Call the appropriate method based on the method string
                    const methodLower = method.toLowerCase();

                    if (methodLower === "getprogramaccounts") {
                        const programId = new PublicKey(params[0]);
                        result = (await connection.getProgramAccounts(programId, {
                            commitment,
                        })) as T;
                    } else if (methodLower === "getconfirmedsignaturesfortheprogramaddress") {
                        const programId = new PublicKey(params[0]);
                        result = (await connection.getProgramAccounts(programId, {
                            commitment,
                        })) as T;
                    } else if (methodLower === "gettransaction") {
                        // getTransaction only accepts 'confirmed' | 'finalized', not 'processed'
                        const finalityCommitment = commitment === "processed" ? "confirmed" : commitment;
                        result = (await connection.getTransaction(params[0], {
                            commitment: finalityCommitment as "confirmed" | "finalized",
                        })) as T;
                    } else if (methodLower === "getblocktime") {
                        result = (await connection.getBlockTime(params[0])) as T;
                    } else if (methodLower === "getslot") {
                        result = (await connection.getSlot(commitment)) as T;
                    } else if (methodLower === "getblocks") {
                        result = (await connection.getBlocks(params[0], params[1])) as T;
                    } else if (methodLower === "getblock") {
                        result = (await connection.getBlock(params[0], params[1])) as T;
                    } else if (methodLower === "getsignaturesforaddress") {
                        const address = new PublicKey(params[0]);
                        result = (await connection.getSignaturesForAddress(address, params[1])) as T;
                    } else if (methodLower === "getsignaturestatuses") {
                        const signatures = params[0] as string[];
                        const response = await connection.getSignatureStatuses(signatures);
                        result = response as T;
                    } else if (methodLower === "getmultipleaccountsinfo") {
                        const pubkeys = (params[0] as string[]).map(
                            (pubkey) => new PublicKey(pubkey)
                        );
                        result = (await connection.getMultipleAccountsInfo(
                            pubkeys,
                            commitment
                        )) as T;
                    } else if (methodLower === "gettokenaccountbalance") {
                        const pubkey = new PublicKey(params[0]);
                        result = (await connection.getTokenAccountBalance(
                            pubkey,
                            commitment === "processed" ? "confirmed" : commitment
                        )) as T;
                    } else {
                        // Fallback to raw RPC call
                        result = (await (connection as any)._rpcRequest(
                            method,
                            params
                        )) as T;
                    }
                } finally {
                    clearTimeout(timeoutId);
                }

                const latency = Date.now() - startTime;
                this.recordLatency(latency);
                this.metrics.successful_calls++;

                this.logger.debug(`${method} succeeded in ${latency}ms`);
                return result;
            } catch (error) {
                lastError = error;
                const latency = Date.now() - Date.now();
                this.recordLatency(latency);

                if (this.isRateLimitError(error)) {
                    this.metrics.rate_limit_hits++;
                    const backoffMs = Math.pow(2, attempt) * 1000;
                    this.logger.warn(
                        `Rate limited on attempt ${attempt + 1}, backoff ${backoffMs}ms`
                    );
                    await this.sleep(backoffMs);

                    // Don't failover on rate limit, retry same endpoint
                    continue;
                }

                if (!this.isRetriableError(error)) {
                    // Non-retriable error, fail immediately
                    this.logger.error(`Non-retriable error: ${method}`, error);
                    throw error;
                }

                // Retriable error, try next endpoint
                if (attempt < retries) {
                    this.logger.warn(
                        `Attempt ${attempt + 1} failed: ${method}, rotating endpoint`
                    );
                    this.rotateEndpoint();
                }
            }
        }

        this.metrics.failed_calls++;
        this.logger.error(
            `${method} failed after ${retries + 1} attempts`,
            lastError
        );
        throw lastError;
    }

    /**
     * Get signature statuses (for confirming finality)
     */
    async getSignatureStatuses(
        signatures: string[],
        options: RpcCallOptions = {}
    ): Promise<RpcResponseAndContext<Array<SignatureStatus | null>>> {
        return this.call(
            "getSignatureStatuses",
            [signatures],
            options
        ) as Promise<RpcResponseAndContext<Array<SignatureStatus | null>>>;
    }

    /**
     * Get transaction details
     */
    async getTransaction(
        signature: string,
        options: RpcCallOptions = {}
    ): Promise<TransactionResponse | null> {
        return this.call("getTransaction", [signature], options) as Promise<
            TransactionResponse | null
        >;
    }

    /**
     * Get block time
     */
    async getBlockTime(
        slot: number,
        options: RpcCallOptions = {}
    ): Promise<number | null> {
        return this.call("getBlockTime", [slot], options) as Promise<
            number | null
        >;
    }

    /**
     * Get current slot
     */
    async getSlot(
        commitment: "confirmed" | "finalized" | "processed" = "confirmed",
        options: RpcCallOptions = {}
    ): Promise<number> {
        return this.call(
            "getSlot",
            [],
            { ...options, commitment }
        ) as Promise<number>;
    }

    /**
     * Get block range
     */
    async getBlocks(
        startSlot: number,
        endSlot?: number,
        options: RpcCallOptions = {}
    ): Promise<number[]> {
        return this.call(
            "getBlocks",
            [startSlot, endSlot],
            options
        ) as Promise<number[]>;
    }

    /**
     * Get a single block
     */
    async getBlock(
        slot: number,
        blockOptions: any = {}
    ): Promise<any> {
        return this.call(
            "getBlock",
            [slot, { commitment: "confirmed", maxSupportedTransactionVersion: 0, ...blockOptions }],
            blockOptions
        );
    }

    /**
     * Get signatures for address
     */
    async getSignaturesForAddress(
        address: string | PublicKey,
        signaturesOptions: any = {},
        options: RpcCallOptions = {}
    ): Promise<ConfirmedSignatureInfo[]> {
        return this.call(
            "getSignaturesForAddress",
            [typeof address === "string" ? address : address.toBase58(), signaturesOptions],
            options
        ) as Promise<ConfirmedSignatureInfo[]>;
    }

    /**
     * Get program accounts (alternative to getProgramAccounts)
     */
    async getProgramAccounts(
        programId: string,
        options: RpcCallOptions = {}
    ) {
        return this.call(
            "getProgramAccounts",
            [programId],
            options
        );
    }

    async getMultipleAccountsInfo(
        addresses: Array<string | PublicKey>,
        options: RpcCallOptions = {}
    ): Promise<Array<AccountInfo<Buffer> | null>> {
        return this.call(
            "getMultipleAccountsInfo",
            [
                addresses.map((address) =>
                    typeof address === "string" ? address : address.toBase58()
                ),
            ],
            options
        ) as Promise<Array<AccountInfo<Buffer> | null>>;
    }

    async getTokenAccountBalance(
        address: string | PublicKey,
        options: RpcCallOptions = {}
    ): Promise<RpcResponseAndContext<TokenAmount>> {
        return this.call(
            "getTokenAccountBalance",
            [typeof address === "string" ? address : address.toBase58()],
            options
        ) as Promise<RpcResponseAndContext<TokenAmount>>;
    }

    /**
     * Sleep utility for backoff
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Get current metrics
     */
    getMetrics(): RpcMetrics {
        return { ...this.metrics };
    }

    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            total_calls: 0,
            successful_calls: 0,
            failed_calls: 0,
            failover_count: 0,
            rate_limit_hits: 0,
            average_latency_ms: 0,
        };
        this.latencies = [];
    }

    /**
     * Get health status
     */
    getHealth(): {
        healthy: boolean;
        failoverCount: number;
        successRate: number;
        averageLatencyMs: number;
    } {
        const successRate =
            this.metrics.total_calls > 0
                ? this.metrics.successful_calls / this.metrics.total_calls
                : 0;

        return {
            healthy: successRate > 0.95 && this.metrics.failover_count < 5,
            failoverCount: this.metrics.failover_count,
            successRate,
            averageLatencyMs: this.metrics.average_latency_ms,
        };
    }
}
