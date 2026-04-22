-- DropIndex
DROP INDEX "TxActivity_poolId_slot_idx";

-- DropIndex
DROP INDEX "TxActivity_slot_signature_ixIndex_idx";

-- DropIndex
DROP INDEX "TxActivity_userAuthority_slot_idx";

-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "createdTxHash" VARCHAR(88),
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "poolId" INTEGER,
ADD COLUMN     "rewardMint" TEXT NOT NULL DEFAULT '';

-- Backfill pool creation tx hashes from pool-creation activity only.
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
DROP TYPE "ProcessedSignatureStatus";

-- CreateTable
CREATE TABLE "Stakingpool" (
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
CREATE INDEX "Stakingpool_authority_idx" ON "Stakingpool"("authority");

-- CreateIndex
CREATE INDEX "Stakingpool_lastUpdatedSlot_idx" ON "Stakingpool"("lastUpdatedSlot");

-- CreateIndex
CREATE INDEX "Pool_poolId_idx" ON "Pool"("poolId");
