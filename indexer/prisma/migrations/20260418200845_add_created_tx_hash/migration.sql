-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "createdTxHash" VARCHAR(88),
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "poolId" INTEGER;

-- AlterTable
ALTER TABLE "Stakingpool" ADD COLUMN     "poolId" INTEGER;

-- CreateIndex
CREATE INDEX "Pool_poolId_idx" ON "Pool"("poolId");
