-- CreateEnum
CREATE TYPE "ProcessedSignatureStatus" AS ENUM ('processing', 'completed');

-- CreateTable ProcessedSignature
CREATE TABLE "ProcessedSignature" (
    "id" SERIAL NOT NULL,
    "signature" VARCHAR(88) NOT NULL,
    "slot" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessedSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedSignature_signature_key" ON "ProcessedSignature"("signature");
CREATE INDEX "ProcessedSignature_status_updatedAt_idx" ON "ProcessedSignature"("status", "updatedAt");
CREATE INDEX "ProcessedSignature_slot_idx" ON "ProcessedSignature"("slot");

-- CreateTable SlotProgress
CREATE TABLE "SlotProgress" (
    "slot" BIGINT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,

    CONSTRAINT "SlotProgress_pkey" PRIMARY KEY ("slot")
);

CREATE INDEX "SlotProgress_processed_idx" ON "SlotProgress"("processed");
CREATE INDEX "SlotProgress_firstSeenAt_idx" ON "SlotProgress"("firstSeenAt");

-- CreateTable IndexerCursor
CREATE TABLE "IndexerCursor" (
    "id" SERIAL NOT NULL,
    "lastProcessedSlot" BIGINT NOT NULL DEFAULT 0,
    "lastProcessedSignature" TEXT,
    "lastProcessedIxIndex" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable Pool
CREATE TABLE "Pool" (
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

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Pool_authority_idx" ON "Pool"("authority");
CREATE INDEX "Pool_lastUpdatedSlot_idx" ON "Pool"("lastUpdatedSlot");

-- CreateTable UserPosition
CREATE TABLE "UserPosition" (
    "id" TEXT NOT NULL,
    "pool" TEXT NOT NULL,
    "userAuthority" TEXT NOT NULL,
    "shares" BIGINT NOT NULL,
    "unlockedShares" BIGINT NOT NULL DEFAULT 0,
    "depositAmount" BIGINT NOT NULL,
    "depositTime" BIGINT NOT NULL,
    "rewardDebt" BIGINT NOT NULL DEFAULT 0,
    "lastUpdatedSlot" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPosition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserPosition_userAuthority_idx" ON "UserPosition"("userAuthority");
CREATE INDEX "UserPosition_pool_idx" ON "UserPosition"("pool");
CREATE INDEX "UserPosition_lastUpdatedSlot_idx" ON "UserPosition"("lastUpdatedSlot");

-- CreateTable TxActivity
CREATE TABLE "TxActivity" (
    "id" BIGSERIAL NOT NULL,
    "signature" VARCHAR(88) NOT NULL,
    "slot" BIGINT NOT NULL,
    "blockTime" TIMESTAMP(3),
    "ixIndex" INTEGER NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "eventType" TEXT NOT NULL,
    "userAuthority" TEXT,
    "poolId" TEXT,
    "shares" BIGINT,
    "amount" BIGINT,
    "timestamp" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "historical" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TxActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TxActivity_signature_ixIndex_key" ON "TxActivity"("signature", "ixIndex");
CREATE INDEX "TxActivity_slot_idx" ON "TxActivity"("slot");
CREATE INDEX "TxActivity_blockTime_idx" ON "TxActivity"("blockTime");
CREATE INDEX "TxActivity_status_idx" ON "TxActivity"("status");
CREATE INDEX "TxActivity_userAuthority_idx" ON "TxActivity"("userAuthority");
CREATE INDEX "TxActivity_poolId_idx" ON "TxActivity"("poolId");
CREATE INDEX "TxActivity_eventType_idx" ON "TxActivity"("eventType");
CREATE INDEX "TxActivity_eventVersion_idx" ON "TxActivity"("eventVersion");
CREATE INDEX "TxActivity_historical_idx" ON "TxActivity"("historical");

-- CreateTable VaultHistory
CREATE TABLE "VaultHistory" (
    "id" BIGSERIAL NOT NULL,
    "poolId" TEXT NOT NULL,
    "slot" BIGINT NOT NULL,
    "expectedBalance" BIGINT NOT NULL,
    "actualBalance" BIGINT NOT NULL,
    "difference" BIGINT NOT NULL,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "tolerance" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VaultHistory_poolId_idx" ON "VaultHistory"("poolId");
CREATE INDEX "VaultHistory_slot_idx" ON "VaultHistory"("slot");
CREATE INDEX "VaultHistory_reconciled_idx" ON "VaultHistory"("reconciled");

-- CreateTable Alert
CREATE TABLE "Alert" (
    "id" BIGSERIAL NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Alert_alertType_idx" ON "Alert"("alertType");
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");
CREATE INDEX "Alert_processed_idx" ON "Alert"("processed");
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateTable TxQueue
CREATE TABLE "TxQueue" (
    "id" BIGSERIAL NOT NULL,
    "signature" VARCHAR(88) NOT NULL,
    "slot" BIGINT NOT NULL,
    "rawTx" JSONB NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TxQueue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TxQueue_signature_key" ON "TxQueue"("signature");
CREATE INDEX "TxQueue_status_idx" ON "TxQueue"("status");
CREATE INDEX "TxQueue_slot_idx" ON "TxQueue"("slot");
