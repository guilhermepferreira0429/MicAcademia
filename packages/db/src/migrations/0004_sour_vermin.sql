CREATE TABLE "course_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"profile_id" uuid,
	"email" varchar NOT NULL,
	"fullname" varchar,
	"provider" text DEFAULT 'easypay' NOT NULL,
	"provider_payment_id" text,
	"payment_key" text,
	"method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"mb_entity" text,
	"mb_reference" text,
	"phone" varchar,
	"phone_indicative" varchar,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"failure_reason" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_payment_provider_payment_id_key" UNIQUE("provider_payment_id")
);
--> statement-breakpoint
ALTER TABLE "course_payment" ADD CONSTRAINT "course_payment_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_payment" ADD CONSTRAINT "course_payment_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_payment" ADD CONSTRAINT "course_payment_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_course_payment_course_profile" ON "course_payment" USING btree ("course_id","profile_id");--> statement-breakpoint
CREATE INDEX "idx_course_payment_status_created" ON "course_payment" USING btree ("status","created_at");