-- Add revision snapshot for admin notes
ALTER TABLE "AdminNote" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
