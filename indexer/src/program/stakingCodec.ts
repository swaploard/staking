import { BorshCoder, EventParser, Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { Logger } from "../logger";

export interface DecodedAnchorEvent {
    name: string;
    version: number;
    data: Record<string, unknown>;
}

export interface DecodedPoolAccount {
    id: string;
    poolId: bigint;
    stakeMint: string;
    rewardMint: string;
    stakeVault: string;
    rewardVault: string;
    aprBps: bigint;
    lockDuration: bigint;
    cooldownDuration: bigint;
    depositCap: bigint;
    paused: boolean;
    totalStaked: bigint;
    rewardRatePerSecond: bigint;
    totalRewardsFunded: bigint;
    rewardsDistributed: bigint;
    lastUpdateTimestamp: bigint;
    bump: number;
    version: number;
}

export interface DecodedUserPositionAccount {
    id: string;
    owner: string;
    pool: string;
    amount: bigint;
    pendingRewards: bigint;
    pendingWithdrawal: bigint;
    depositTimestamp: bigint;
    unlockTimestamp: bigint;
    cooldownStart: bigint;
    bump: number;
    version: number;
}

function normalizeValue(value: unknown): unknown {
    if (typeof value === "bigint") {
        return value.toString();
    }

    if (value instanceof PublicKey) {
        return value.toBase58();
    }

    if (Array.isArray(value)) {
        return value.map((item) => normalizeValue(item));
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
                key,
                normalizeValue(entry),
            ])
        );
    }

    return value;
}

export class StakingProgramCodec {
    private static instance: StakingProgramCodec | null = null;

    static load(programId: string): StakingProgramCodec {
        if (!this.instance) {
            this.instance = new StakingProgramCodec(programId);
        }

        return this.instance;
    }

    private logger = new Logger("StakingProgramCodec");
    private idl: Idl | null = null;
    private coder: BorshCoder | null = null;
    private eventParser: EventParser | null = null;

    private constructor(programId: string) {
        const idlPath = path.resolve(
            __dirname,
            "../../../target/idl/staking.json"
        );

        if (!fs.existsSync(idlPath)) {
            this.logger.warn(`IDL not found at ${idlPath}; event decoding disabled`);
            return;
        }

        const parsed = JSON.parse(fs.readFileSync(idlPath, "utf8")) as Idl;
        this.idl = parsed;
        this.coder = new BorshCoder(parsed);
        this.eventParser = new EventParser(new PublicKey(programId), this.coder);
    }

    isLoaded(): boolean {
        return this.coder !== null && this.eventParser !== null;
    }

    countProgramDataLogs(logs: string[]): number {
        return logs.filter((log) => log.startsWith("Program data:")).length;
    }

    parseEvents(logs: string[]): DecodedAnchorEvent[] {
        if (!this.eventParser) {
            return [];
        }

        const parsedEvents: DecodedAnchorEvent[] = [];

        for (const event of this.eventParser.parseLogs(logs)) {
            parsedEvents.push({
                name: event.name,
                version: this.extractEventVersion(event.name),
                data: normalizeValue(event.data) as Record<string, unknown>,
            });
        }

        return parsedEvents;
    }

    decodePoolAccount(address: string, data: Buffer): DecodedPoolAccount {
        const decoded = this.decodeAccount("Pool", data) as Record<string, unknown>;

        return {
            id: address,
            poolId: BigInt(decoded.poolId as bigint | number | string),
            stakeMint: this.asString(decoded.stakeMint),
            rewardMint: this.asString(decoded.rewardMint),
            stakeVault: this.asString(decoded.stakeVault),
            rewardVault: this.asString(decoded.rewardVault),
            aprBps: BigInt(decoded.aprBps as bigint | number | string),
            lockDuration: BigInt(decoded.lockDuration as bigint | number | string),
            cooldownDuration: BigInt(
                decoded.cooldownDuration as bigint | number | string
            ),
            depositCap: BigInt(decoded.depositCap as bigint | number | string),
            paused: Boolean(decoded.paused),
            totalStaked: BigInt(decoded.totalStaked as bigint | number | string),
            rewardRatePerSecond: BigInt(
                decoded.rewardRatePerSecond as bigint | number | string
            ),
            totalRewardsFunded: BigInt(
                decoded.totalRewardsFunded as bigint | number | string
            ),
            rewardsDistributed: BigInt(
                decoded.rewardsDistributed as bigint | number | string
            ),
            lastUpdateTimestamp: BigInt(
                decoded.lastUpdateTimestamp as bigint | number | string
            ),
            bump: Number(decoded.bump),
            version: Number(decoded.version),
        };
    }

    decodeUserPositionAccount(
        address: string,
        data: Buffer
    ): DecodedUserPositionAccount {
        const decoded = this.decodeAccount(
            "UserPosition",
            data
        ) as Record<string, unknown>;

        return {
            id: address,
            owner: this.asString(decoded.owner),
            pool: this.asString(decoded.pool),
            amount: BigInt(decoded.amount as bigint | number | string),
            pendingRewards: BigInt(
                decoded.pendingRewards as bigint | number | string
            ),
            pendingWithdrawal: BigInt(
                decoded.pendingWithdrawal as bigint | number | string
            ),
            depositTimestamp: BigInt(
                decoded.depositTimestamp as bigint | number | string
            ),
            unlockTimestamp: BigInt(
                decoded.unlockTimestamp as bigint | number | string
            ),
            cooldownStart: BigInt(
                decoded.cooldownStart as bigint | number | string
            ),
            bump: Number(decoded.bump),
            version: Number(decoded.version),
        };
    }

    private decodeAccount(name: string, data: Buffer): unknown {
        if (!this.coder) {
            throw new Error("Staking IDL unavailable for account decoding");
        }

        return this.coder.accounts.decode(name, data);
    }

    private extractEventVersion(name: string): number {
        const match = name.match(/V(\d+)$/);
        return match ? Number(match[1]) : 1;
    }

    private asString(value: unknown): string {
        if (value instanceof PublicKey) {
            return value.toBase58();
        }

        return String(value);
    }
}
