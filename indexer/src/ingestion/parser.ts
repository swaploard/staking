import { PrismaClient } from "@prisma/client";
import { TransactionResponse } from "@solana/web3.js";
import { Logger } from "../logger";
import { IngestionContract } from "./contract";

export interface ParsedInstruction {
    index: number;
    programId: string;
    discriminator?: string;
    parsed?: any;
}

export interface ParsedEvent {
    type: string;
    version: number;
    data: any;
}

export interface ParsedTxData {
    signature: string;
    slot: bigint;
    blockTime?: Date;
    events: ParsedEvent[];
    instructions: ParsedInstruction[];
    logs: string[];
    timestamp?: bigint;
}

/**
 * Transaction Parser — Deterministic Order
 *
 * Priority order for parsing (prevent double-counting):
 * 1. Events (if present, use ONLY events, skip instructions and logs)
 * 2. Instructions (programId check to avoid CPI false positives)
 * 3. Logs (fallback if events and instructions are empty)
 */
export class TransactionParser {
    private logger: Logger;
    private stakingProgramId: string;

    constructor(stakingProgramId: string) {
        this.logger = new Logger("TransactionParser");
        this.stakingProgramId = stakingProgramId;
    }

    /**
     * Parse transaction and extract staking-related activity
     * Returns events in deterministic priority order
     */
    async parse(tx: TransactionResponse): Promise<ParsedTxData> {
        const signature = tx.transaction.signatures[0];
        const slot = BigInt(tx.slot);
        const blockTime = tx.blockTime
            ? new Date(tx.blockTime * 1000)
            : undefined;

        const parsedData: ParsedTxData = {
            signature,
            slot,
            blockTime,
            events: [],
            instructions: [],
            logs: tx.meta?.logMessages || [],
            timestamp: tx.blockTime ? BigInt(tx.blockTime) : undefined,
        };

        // Parse instructions from the transaction
        const message = tx.transaction.message;
        const instructions = message.instructions;

        // 1. Try to extract Anchor events first (highest priority)
        const events = this.extractAnchorEvents(tx);
        if (events.length > 0) {
            parsedData.events = events;
            this.logger.debug(
                `[${signature}] Found ${events.length} Anchor events, skipping instructions`
            );
            return parsedData;
        }

        // 2. Parse instructions (with program ID validation)
        for (let i = 0; i < instructions.length; i++) {
            const ix = instructions[i];
            const programIdIndex = ix.programIdIndex;
            const programId = message.accountKeys[programIdIndex];

            // Only process instructions from our staking program
            if (programId.toBase58() !== this.stakingProgramId) {
                continue;
            }

            const parsed = this.parseInstruction(ix, i);
            if (parsed) {
                parsedData.instructions.push(parsed);
            }
        }

        if (parsedData.instructions.length > 0) {
            this.logger.debug(
                `[${signature}] Found ${parsedData.instructions.length} staking instructions`
            );
            return parsedData;
        }

        // 3. Fallback to log parsing
        const logEvents = this.parseLogsForEvents(tx);
        if (logEvents.length > 0) {
            parsedData.events = logEvents;
            this.logger.debug(
                `[${signature}] Extracted ${logEvents.length} events from logs`
            );
        }

        return parsedData;
    }

    /**
     * Extract Anchor events from transaction logs
     * Look for "Program log: " entries that match event signatures
     */
    private extractAnchorEvents(tx: TransactionResponse): ParsedEvent[] {
        const events: ParsedEvent[] = [];
        const logs = tx.meta?.logMessages || [];

        // Event discriminators (first 8 bytes of event struct hash)
        // These would be populated from your program's IDL
        const eventSignatures: Record<string, string> = {
            "0x123abc": "StakeEvent", // placeholder
            "0x456def": "UnstakeEvent",
            "0x789ghi": "ClaimEvent",
            "0xabcjkl": "EmergencyEvent",
        };

        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];

            // Look for "Program log: " entries
            if (log.includes("Program log:")) {
                // Try to parse event data from log
                try {
                    // This is a simplified extraction - in reality, you'd decode the event data
                    // from the Program Data account or from transaction logs more carefully
                    const match = log.match(/Program log: (\w+)=(.*)/);
                    if (match && match[1] && match[2]) {
                        const eventType = match[1];
                        try {
                            const data = JSON.parse(match[2]);
                            events.push({
                                type: eventType,
                                version: 1,
                                data,
                            });
                        } catch {
                            // Skip JSON parse errors
                        }
                    }
                } catch (error) {
                    // Continue on parse errors
                }
            }
        }

        return events;
    }

    /**
     * Parse a single instruction from the transaction
     */
    private parseInstruction(
        ix: any,
        index: number
    ): ParsedInstruction | null {
        try {
            // Extract instruction data (first 8 bytes is discriminator in Anchor programs)
            const data = ix.data;
            if (!data || data.length < 8) {
                return null;
            }

            const discriminator = data.slice(0, 8).toString("hex");

            return {
                index,
                programId: "", // Would be populated from message context
                discriminator,
                parsed: this.decodeInstruction(discriminator, data),
            };
        } catch (error) {
            this.logger.debug(`Failed to parse instruction at index ${index}:`, error);
            return null;
        }
    }

    /**
     * Decode instruction based on discriminator
     * This is a placeholder - in reality, you'd use your IDL
     */
    private decodeInstruction(
        discriminator: string,
        data: Buffer
    ): any {
        // Map discriminators to instruction types
        const discriminatorMap: Record<string, string> = {
            // These would be populated from your program's IDL
            "0x01": "Stake",
            "0x02": "Unstake",
            "0x03": "Claim",
            "0x04": "Emergency",
        };

        return {
            type: discriminatorMap[discriminator] || "Unknown",
            discriminator,
            dataSize: data.length,
        };
    }

    /**
     * Parse events from transaction logs (fallback)
     */
    private parseLogsForEvents(tx: TransactionResponse): ParsedEvent[] {
        const events: ParsedEvent[] = [];
        const logs = tx.meta?.logMessages || [];

        // Look for custom log patterns that indicate events
        for (const log of logs) {
            if (log.includes("Stake") || log.includes("stake")) {
                events.push({
                    type: "Stake",
                    version: 1,
                    data: { log },
                });
            } else if (log.includes("Unstake") || log.includes("unstake")) {
                events.push({
                    type: "Unstake",
                    version: 1,
                    data: { log },
                });
            } else if (log.includes("Claim") || log.includes("claim")) {
                events.push({
                    type: "Claim",
                    version: 1,
                    data: { log },
                });
            }
        }

        return events;
    }
}

/**
 * Transaction Ingestor — Main ingestion worker
 *
 * Processes transactions using the ingestion contract guarantee:
 * - Enforces exactly-once processing
 * - Deterministic parsing (events → instructions → logs)
 * - Confirmed status only (for Step 1)
 * - Atomic database operations
 */
export class TransactionIngestor {
    private logger: Logger;
    private parser: TransactionParser;
    private contract: IngestionContract;

    constructor(
        private prisma: PrismaClient,
        private rpcClient: any, // RpcClient type
        stakingProgramId: string,
        processingTimeoutMs: number = 60000
    ) {
        this.logger = new Logger("TransactionIngestor");
        this.parser = new TransactionParser(stakingProgramId);
        this.contract = new IngestionContract(prisma, processingTimeoutMs);
    }

    /**
     * Ingest a transaction by signature
     * Full flow: fetch → parse → apply ingestion contract
     */
    async ingestSignature(signature: string): Promise<{
        success: boolean;
        error?: string;
        wasProcessed?: boolean;
    }> {
        try {
            // Fetch transaction from RPC
            const tx = await this.rpcClient.getTransaction(signature, {
                commitment: "confirmed",
            });

            if (!tx) {
                this.logger.warn(`[${signature}] Transaction not found on chain`);
                return {
                    success: false,
                    error: "Transaction not found on chain",
                };
            }

            if (tx.meta?.err) {
                this.logger.debug(`[${signature}] Transaction failed on chain`);
                // Still record failed transactions
            }

            // Parse transaction data
            const parsedData = await this.parser.parse(tx);

            // Apply ingestion contract
            const result = await this.contract.processTransaction(
                {
                    signature: parsedData.signature,
                    slot: parsedData.slot,
                    blockTime: parsedData.blockTime,
                    instructions: parsedData.instructions,
                    events: parsedData.events,
                    logs: parsedData.logs,
                },
                async (data, tx) => {
                    // Process events and instructions
                    await this.recordTxActivity(data, tx);
                }
            );

            return {
                success: result.success,
                error: result.error,
            };
        } catch (error) {
            this.logger.error(`[${signature}] Failed to ingest:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    /**
     * Record transaction activity in database
     * Processes events and instructions in deterministic order
     */
    private async recordTxActivity(data: any, tx: any): Promise<void> {
        const { signature, slot, blockTime, events, instructions } = data;

        // Record events (highest priority)
        if (events && events.length > 0) {
            for (const event of events) {
                await tx.txActivity.create({
                    data: {
                        signature,
                        slot,
                        blockTime,
                        ixIndex: 0, // Events don't have ix index
                        eventVersion: event.version,
                        eventType: event.type,
                        userAuthority: event.data?.user || event.data?.userAuthority,
                        poolId: event.data?.pool || event.data?.poolId,
                        shares: event.data?.shares ? BigInt(event.data.shares) : null,
                        amount: event.data?.amount ? BigInt(event.data.amount) : null,
                        timestamp: data.timestamp,
                        status: "confirmed",
                        metadata: event.data,
                    },
                });
            }
        }

        // Record instructions (if no events)
        if (instructions && instructions.length > 0 && (!events || events.length === 0)) {
            for (const ix of instructions) {
                const eventType =
                    ix.parsed?.type ||
                    ix.discriminator?.toUpperCase() ||
                    `Instruction_${ix.index}`;

                await tx.txActivity.create({
                    data: {
                        signature,
                        slot,
                        blockTime,
                        ixIndex: ix.index,
                        eventVersion: 1,
                        eventType,
                        metadata: ix.parsed,
                        status: "confirmed",
                    },
                });
            }
        }

        this.logger.debug(
            `[${signature}] Recorded ${events.length + (instructions.length || 0)} activities`
        );
    }

    /**
     * Get processing status
     */
    async getProcessingStatus(signature: string): Promise<{
        status: "not_seen" | "processing" | "completed";
        details?: any;
    }> {
        const status = await this.contract.getStatus(signature);
        const activity = await this.prisma.txActivity.findFirst({
            where: { signature },
        });

        return {
            status,
            details: activity,
        };
    }

    /**
     * Find stale processing entries for recovery
     */
    async findStaleProcessing(limit: number = 100): Promise<
        Array<{ signature: string; ageMs: number }>
    > {
        return this.contract.findStaleEntries(limit);
    }
}
