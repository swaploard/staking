import { PrismaClient } from "@prisma/client";
import { Logger } from "../logger";

export class PartitionTunerJob {
    private logger = new Logger("PartitionTunerJob");

    constructor(private prisma: PrismaClient) {}

    async ensureIndexes(): Promise<void> {
        await this.prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "TxActivity_slot_signature_ixIndex_idx"
            ON "TxActivity"("slot" DESC, "signature" DESC, "ixIndex" DESC)
        `);
        await this.prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "TxActivity_poolId_slot_idx"
            ON "TxActivity"("poolId", "slot" DESC)
        `);
        await this.prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "TxActivity_userAuthority_slot_idx"
            ON "TxActivity"("userAuthority", "slot" DESC)
        `);
    }

    async ensureFuturePartitions(
        startSlot: bigint,
        endSlot: bigint,
        partitionSize: bigint = 1_000_000n
    ): Promise<number> {
        const isPartitioned = await this.prisma.$queryRawUnsafe<
            Array<{ partitioned: boolean }>
        >(`
            SELECT EXISTS (
                SELECT 1
                FROM pg_partitioned_table p
                JOIN pg_class c ON c.oid = p.partrelid
                WHERE c.relname = 'TxActivity'
            ) AS partitioned
        `);

        if (!isPartitioned[0]?.partitioned) {
            this.logger.warn(
                "TxActivity is not partitioned yet; applied indexes only and skipped partition creation"
            );
            await this.ensureIndexes();
            return 0;
        }

        let created = 0;
        for (
            let fromSlot = startSlot;
            fromSlot <= endSlot;
            fromSlot += partitionSize
        ) {
            const toSlot = fromSlot + partitionSize;
            const partitionName = `TxActivity_${fromSlot}_${toSlot}`;

            await this.prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "${partitionName}"
                PARTITION OF "TxActivity"
                FOR VALUES FROM (${fromSlot.toString()}) TO (${toSlot.toString()})
            `);
            created++;
        }

        await this.ensureIndexes();
        this.logger.info(`Ensured ${created} future tx_activity partitions`);
        return created;
    }
}
