CREATE TABLE "instructor_course" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instructor_course_unique" UNIQUE("instructor_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "instructor_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"profile_id" uuid,
	"fullname" varchar NOT NULL,
	"email" varchar,
	"ccp_number" varchar,
	"ccp_valid_until" timestamp with time zone,
	"specialization" varchar,
	"contract_status" text DEFAULT 'none' NOT NULL,
	"ip_cession_status" text DEFAULT 'none' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instructor_course" ADD CONSTRAINT "instructor_course_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_course" ADD CONSTRAINT "instructor_course_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_profile" ADD CONSTRAINT "instructor_profile_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_profile" ADD CONSTRAINT "instructor_profile_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_instructor_course_course_id" ON "instructor_course" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_instructor_profile_org_id" ON "instructor_profile" USING btree ("org_id");