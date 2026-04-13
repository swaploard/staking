import { Prisma, PrismaClient } from "@prisma/client";
import { Logger } from "../logger";

export interface AlertActivityRecord {
    signature: string;
    slot: bigint;
    eventType: string;
    amount?: bigint | null;
    userAuthority?: string | null;
    poolId?: string | null;
    historical?: boolean;
    metadata?: Prisma.JsonValue | null;
}

export interface QueuedAlertInput {
    alertType: string;
    severity: string;
    message: string;
    historical?: boolean;
    metadata?: Prisma.InputJsonValue;
}

type AlertWriter = PrismaClient | Prisma.TransactionClient;

export class AlertEngine {
    private logger = new Logger("AlertEngine");
    private highValueThreshold: bigint;

    constructor() {
        this.highValueThreshold = BigInt(
            process.env.ALERT_HIGH_VALUE_THRESHOLD || "1000000000"
        );
    }

    async enqueueActivityAlerts(
        writer: AlertWriter,
        activities: AlertActivityRecord[]
    ): Promise<number> {
        let created = 0;

        for (const activity of activities) {
            if (activity.historical) {
                continue;
            }

            const alert = this.toAlertInput(activity);
            if (!alert) {
                continue;
            }

            await this.createQueuedAlert(writer, alert);
            created++;
        }

        if (created > 0) {
            this.logger.info(`Enqueued ${created} activity alerts`);
        }

        return created;
    }

    async createQueuedAlert(
        writer: AlertWriter,
        input: QueuedAlertInput
    ): Promise<void> {
        const alert = await writer.alert.create({
            data: {
                alertType: input.alertType,
                severity: input.severity,
                message: input.message,
                metadata: input.metadata,
                processed: false,
            },
        });

        await writer.$executeRawUnsafe(
            `
                INSERT INTO "AlertQueue"
                    ("alertId", "alertType", "payload", "historical", "status", "retryCount", "availableAt", "createdAt", "updatedAt")
                VALUES
                    ($1, $2, $3::jsonb, $4, 'pending', 0, NOW(), NOW(), NOW())
            `,
            alert.id.toString(),
            input.alertType,
            JSON.stringify(input.metadata ?? {}),
            input.historical ?? false
        );
    }

    private toAlertInput(
        activity: AlertActivityRecord
    ): QueuedAlertInput | null {
        const amount = activity.amount ?? 0n;
        const baseMetadata: Prisma.InputJsonObject = {
            signature: activity.signature,
            slot: activity.slot.toString(),
            eventType: activity.eventType,
            userAuthority: activity.userAuthority ?? undefined,
            poolId: activity.poolId ?? undefined,
            amount: amount.toString(),
            activityMetadata: activity.metadata ?? undefined,
        };

        if (activity.eventType === "EmergencyWithdrawn") {
            return {
                alertType: "emergency_withdrawal",
                severity: "warning",
                message: `Emergency withdrawal detected for pool ${activity.poolId ?? "unknown"}`,
                metadata: baseMetadata,
            };
        }

        const highValueTypes = new Set([
            "Staked",
            "UnstakeRequested",
            "Withdrawn",
            "RewardsClaimed",
        ]);

        if (highValueTypes.has(activity.eventType) && amount >= this.highValueThreshold) {
            return {
                alertType: "high_value_activity",
                severity: "info",
                message: `${activity.eventType} crossed threshold in pool ${activity.poolId ?? "unknown"}`,
                metadata: baseMetadata,
            };
        }

        return null;
    }
}
