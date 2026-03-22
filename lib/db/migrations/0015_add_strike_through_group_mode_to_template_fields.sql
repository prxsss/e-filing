ALTER TABLE "request_template_fields"
ADD COLUMN IF NOT EXISTS "strike_through_group_mode" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "strike_line_thickness" double precision DEFAULT 1.5;
