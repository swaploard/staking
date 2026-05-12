-- DropIndex
DROP INDEX IF EXISTS "TxActivity_poolId_slot_idx";

-- DropIndex
DROP INDEX IF EXISTS "TxActivity_slot_signature_ixIndex_idx";

-- DropIndex
DROP INDEX IF EXISTS "TxActivity_userAuthority_slot_idx";

-- This intentionally excludes reward funding transactions so pools are
-- linked to their original CreatePool / PoolCreated transaction.
UPDATE "Pool" AS p
SET "createdTxHash" = src."signature"
FROM (
    SELECT DISTINCT ON ("poolId")
        "poolId",
        "signature"
    FROM "TxActivity"
    WHERE "poolId" IS NOT NULL
      AND (
        "eventType" IN ('PoolCreated', 'CreatePool')
        OR COALESCE("metadata"::text, '') LIKE '%Instruction: CreatePool%'
      )
    ORDER BY "poolId", "slot" ASC, "ixIndex" ASC
) AS src
WHERE p."id" = src."poolId"
  AND p."createdTxHash" IS NULL;

-- DropEnum
DROP TYPE IF EXISTS "ProcessedSignatureStatus";

-- CreateTable
CREATE TABLE IF NOT EXISTS "Stakingpool" (
    "id" TEXT NOT NULL,
    "poolId" INTEGER,
    "authority" TEXT NOT NULL,
    "tokenMint" TEXT NOT NULL,
    "rewardMint" TEXT NOT NULL DEFAULT '',
    "vaultBump" INTEGER NOT NULL,
    "stakedAmount" BIGINT NOT NULL DEFAULT 0,
    "rewardAmount" BIGINT NOT NULL DEFAULT 0,
    "rewardPerShare" BIGINT NOT NULL DEFAULT 0,
    "totalShares" BIGINT NOT NULL DEFAULT 0,
    "lockUpPeriod" BIGINT NOT NULL,
    "startTime" BIGINT NOT NULL,
    "endTime" BIGINT,
    "lastUpdatedSlot" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stakingpool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Stakingpool_authority_idx" ON "Stakingpool"("authority");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Stakingpool_lastUpdatedSlot_idx" ON "Stakingpool"("lastUpdatedSlot");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Pool_poolId_idx" ON "Pool"("poolId");
