ALTER TABLE "permissions" ALTER COLUMN "code" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "name" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "permissions" RENAME COLUMN "description" TO "description_en";--> statement-breakpoint
ALTER TABLE "roles" RENAME COLUMN "description" TO "description_en";--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "description_th" text;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "description_th" text;
