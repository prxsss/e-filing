CREATE TABLE "dean_signing_delegations" (
	"id" serial PRIMARY KEY NOT NULL,
	"faculty_id" integer NOT NULL,
	"delegate_user_id" text NOT NULL,
	"allowed_template_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dean_signing_delegations_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id"),
	CONSTRAINT "dean_signing_delegations_delegate_user_id_fkey" FOREIGN KEY ("delegate_user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
