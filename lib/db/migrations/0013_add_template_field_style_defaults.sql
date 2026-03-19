ALTER TABLE "request_template_fields"
ADD COLUMN IF NOT EXISTS "font_weight" text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS "font_style" text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS "text_decoration" text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS "text_align" text DEFAULT 'left',
ADD COLUMN IF NOT EXISTS "letter_spacing" double precision DEFAULT 0,
ADD COLUMN IF NOT EXISTS "line_height" double precision DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS "max_length" integer;
