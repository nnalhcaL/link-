-- AlterTable
ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "hostAccessCreatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "hostAccessSecretHash" TEXT;
