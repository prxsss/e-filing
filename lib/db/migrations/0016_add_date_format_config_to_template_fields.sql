ALTER TABLE "request_template_fields"
ADD COLUMN IF NOT EXISTS "date_format_config" jsonb DEFAULT '{}';
