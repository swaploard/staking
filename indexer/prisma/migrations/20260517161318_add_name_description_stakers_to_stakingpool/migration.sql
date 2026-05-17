-- Add name, description, and stakers to Stakingpool
ALTER TABLE "Stakingpool" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Stakingpool" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Stakingpool" ADD COLUMN     "stakers" BIGINT NOT NULL DEFAULT 0;