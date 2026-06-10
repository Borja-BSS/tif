-- AlterTable: add emailNotify column to UserJourney (missed in initial migration)
ALTER TABLE "UserJourney" ADD COLUMN IF NOT EXISTS "emailNotify" VARCHAR(200);
