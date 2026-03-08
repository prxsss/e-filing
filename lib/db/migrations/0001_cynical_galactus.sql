ALTER TABLE "users" ADD COLUMN "institution_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_unique" UNIQUE("institution_id");