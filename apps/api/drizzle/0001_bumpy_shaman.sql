CREATE TABLE IF NOT EXISTS "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"signals" jsonb,
	"tech_stack" jsonb,
	"score_maturity" integer,
	"score_breakdown" jsonb,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analyses_domain_created_idx" ON "analyses" USING btree ("domain","created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analyses_user_created_idx" ON "analyses" USING btree ("user_id","created_at" DESC);