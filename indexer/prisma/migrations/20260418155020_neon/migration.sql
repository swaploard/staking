-- DropIndex
DROP INDEX "TxActivity_poolId_slot_idx";

-- DropIndex
DROP INDEX "TxActivity_slot_signature_ixIndex_idx";

-- DropIndex
DROP INDEX "TxActivity_userAuthority_slot_idx";

-- DropEnum
DROP TYPE "ProcessedSignatureStatus";

-- CreateTable
CREATE TABLE "Stakingpool" (
    "id" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "tokenMint" TEXT NOT NULL,
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
