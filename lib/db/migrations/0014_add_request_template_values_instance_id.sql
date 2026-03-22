ALTER TABLE "request_template_values"
ADD COLUMN IF NOT EXISTS "field_instance_id" text;

-- Optional but recommended for performance/uniqueness:
-- You may want to add a unique index to prevent duplicate rows per request/field/instance.
-- CREATE UNIQUE INDEX IF NOT EXISTS "request_template_values_request_field_instance_unique"
--   ON "request_template_values" ("request_id", "field_id", "field_instance_id");

