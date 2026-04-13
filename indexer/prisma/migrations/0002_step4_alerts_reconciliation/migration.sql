-- Step 4 support: multiple cursors, alert queue isolation, vault reconciliation detail

ALTER TABLE "IndexerCursor"
ADD COLUMN "jobName" TEXT NOT NULL DEFAULT 'default';

CREATE UNIQUE INDEX "IndexerCursor_jobName_key" ON "IndexerCursor"("jobName");

UPDATE "IndexerCursor"
SET "jobName" = CASE "id"
    WHEN 1 THEN 'gap_fill'
    WHEN 2 THEN 'reconciler'
    WHEN 3 THEN 'alert_processor'
    ELSE CONCAT('job_', "id"::TEXT)
END
WHERE "jobName" = 'default';

ALTER TABLE "VaultHistory"
ADD COLUMN "vaultType" TEXT NOT NULL DEFAULT 'stake';

CREATE TABLE "AlertQueue" (
    "id" BIGSERIAL NOT NULL,
    "alertId" BIGINT,
    "alertType" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "historical" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertQueue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlertQueue_alertId_key" ON "AlertQueue"("alertId");
CREATE INDEX "AlertQueue_status_availableAt_idx" ON "AlertQueue"("status", "availableAt");
CREATE INDEX "AlertQueue_alertType_idx" ON "AlertQueue"("alertType");

CREATE INDEX "TxActivity_slot_signature_ixIndex_idx"
ON "TxActivity"("slot" DESC, "signature" DESC, "ixIndex" DESC);

CREATE INDEX "TxActivity_poolId_slot_idx"
ON "TxActivity"("poolId", "slot" DESC);

CREATE INDEX "TxActivity_userAuthority_slot_idx"
ON "TxActivity"("userAuthority", "slot" DESC);
