ALTER TABLE "request"
ADD COLUMN "rejection_reasons" jsonb DEFAULT '{}'::jsonb NOT NULL;