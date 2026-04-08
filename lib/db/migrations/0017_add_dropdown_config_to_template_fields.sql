ALTER TABLE "request_template_fields"
ADD COLUMN IF NOT EXISTS "dropdown_config" jsonb DEFAULT '{}';
