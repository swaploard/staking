-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "rewardMint" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Stakingpool" ADD COLUMN     "rewardMint" TEXT NOT NULL DEFAULT '';
