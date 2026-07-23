CREATE TABLE "course_class" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"enrollment_opens_at" timestamp with time zone,
	"enrollment_closes_at" timestamp with time zone,
	"seats" integer,
	"price_cents" integer,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"mode" text DEFAULT 'online' NOT NULL,
	"location" text,
	"schedule" text,
	"instructor_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_class_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"payment_id" uuid,
	"reserved_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_class_member_unique" UNIQUE("class_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "course_class" ADD CONSTRAINT "course_class_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_class" ADD CONSTRAINT "course_class_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_class" ADD CONSTRAINT "course_class_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_class_member" ADD CONSTRAINT "course_class_member_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."course_class"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_class_member" ADD CONSTRAINT "course_class_member_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_class_member" ADD CONSTRAINT "course_class_member_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."course_payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_course_class_course" ON "course_class" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_course_class_status" ON "course_class" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_course_class_member_class" ON "course_class_member" USING btree ("class_id");