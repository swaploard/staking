import { PrismaClient } from "@prisma/client";
import { Logger } from "../logger";

export class AlertProcessorJob {
    private logger = new Logger("AlertProcessorJob");
    private running = false;
    private webhookUrl = process.env.ALERT_WEBHOOK_URL;

    constructor(private prisma: PrismaClient) {}

    async start(intervalMs: number = 15000): Promise<void> {
        if (this.running) {
            this.logger.warn("Alert processor already running");
            return;
        }

        this.running = true;
        while (this.running) {
            try {
                await this.runOnce();
            } catch (error) {
                this.logger.error("Alert processor loop failed", error);
            }

            if (this.running) {
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }
        }
    }

    stop(): void {
        this.running = false;
    }

    async runOnce(batchSize: number = 20): Promise<number> {
        const rows = await this.prisma.$queryRawUnsafe<
            Array<{
                id: bigint;
                alertId: bigint | null;
                alertType: string;
                payload: unknown;
                retryCount: number;
                createdAt: Date;
            }>
        >(
            `
                SELECT "id", "alertId", "alertType", "payload", "retryCount", "createdAt"
                FROM "AlertQueue"
                WHERE "status" = 'pending' AND "availableAt" <= NOW()
                ORDER BY "createdAt" ASC
                LIMIT $1
            `,
            batchSize
        );

        for (const row of rows) {
            await this.prisma.$executeRawUnsafe(
                `UPDATE "AlertQueue" SET "status" = 'processing', "updatedAt" = NOW() WHERE "id" = $1`,
                row.id.toString()
            );

            try {
                await this.deliver(row.alertType, row.payload);

                await this.prisma.$transaction([
                    this.prisma.$executeRawUnsafe(
                        `UPDATE "AlertQueue" SET "status" = 'completed', "lastError" = NULL, "updatedAt" = NOW() WHERE "id" = $1`,
                        row.id.toString()
                    ),
                    ...(row.alertId
                        ? [
                              this.prisma.alert.update({
                                  where: { id: row.alertId },
                                  data: { processed: true },
                              }),
                          ]
                        : []),
                ]);
            } catch (error) {
                const retryCount = row.retryCount + 1;
                const backoffMs = Math.min(60000, 5000 * retryCount);

                await this.prisma.$executeRawUnsafe(
                    `
                        UPDATE "AlertQueue"
                        SET
                            "status" = $2,
                            "retryCount" = $3,
                            "lastError" = $4,
                            "availableAt" = $5,
                            "updatedAt" = NOW()
                        WHERE "id" = $1
                    `,
                    row.id.toString(),
                    retryCount >= 5 ? "failed" : "pending",
                    retryCount,
                    error instanceof Error ? error.message : String(error),
                    new Date(Date.now() + backoffMs)
                );
            }
        }

        if (rows.length > 0) {
            this.logger.info(`Processed ${rows.length} queued alerts`);
        }

        return rows.length;
    }

    private async deliver(
        alertType: string,
        payload: unknown
    ): Promise<void> {
        if (!this.webhookUrl) {
            this.logger.info(`No ALERT_WEBHOOK_URL configured; acknowledging ${alertType}`);
            return;
        }

        const response = await fetch(this.webhookUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                alertType,
                payload,
            }),
        });

        if (!response.ok) {
            throw new Error(
                `Webhook delivery failed with status ${response.status}`
            );
        }
    }
}
