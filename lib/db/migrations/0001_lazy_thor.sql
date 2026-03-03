ALTER TABLE "request_template_fields" RENAME COLUMN "field_name" TO "name";--> statement-breakpoint
ALTER TABLE "request_template_fields" RENAME COLUMN "field_type" TO "type";--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "filled_document_url" text;--> statement-breakpoint
ALTER TABLE "request_template" ADD COLUMN "document_url" text;--> statement-breakpoint
ALTER TABLE "request_template" ADD COLUMN "document_width" integer;--> statement-breakpoint
ALTER TABLE "request_template" ADD COLUMN "document_height" integer;--> statement-breakpoint
ALTER TABLE "request_template" ADD COLUMN "placed_fields_data" jsonb;--> statement-breakpoint
ALTER TABLE "request_template" ADD COLUMN "signing_flow_data" jsonb;--> statement-breakpoint
ALTER TABLE "request_template_fields" ADD COLUMN "label" text NOT NULL;--> statement-breakpoint
ALTER TABLE "request_template_fields" ADD COLUMN "font" text;--> statement-breakpoint
ALTER TABLE "request_template_fields" ADD COLUMN "font_size" integer;--> statement-breakpoint
ALTER TABLE "request_template_fields" ADD COLUMN "is_fillable" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "request_template_fields" ADD COLUMN "width" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "request_template_fields" ADD COLUMN "height" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "request_template_fields" ADD COLUMN "icon" text NOT NULL;--> statement-breakpoint
ALTER TABLE "request_template_fields" ADD COLUMN "amount" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "request_template_fields" DROP COLUMN "template_id";