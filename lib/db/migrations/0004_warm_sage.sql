ALTER TABLE "permissions" RENAME COLUMN "description" TO "description_en";--> statement-breakpoint
ALTER TABLE "roles" RENAME COLUMN "description" TO "description_en";--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "description_th" text;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "description_th" text;