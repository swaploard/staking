-- Add cooldownDuration to Pool
ALTER TABLE "Pool" ADD COLUMN     "cooldownDuration" BIGINT NOT NULL DEFAULT 0;

-- Add pending withdrawal, cooldown, and available stake fields to UserPosition
ALTER TABLE "UserPosition" ADD COLUMN     "pendingRewards" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "UserPosition" ADD COLUMN     "pendingWithdrawal" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "UserPosition" ADD COLUMN     "unlockTimestamp" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "UserPosition" ADD COLUMN     "cooldownStart" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "UserPosition" ADD COLUMN     "availableStake" BIGINT NOT NULL DEFAULT 0;
