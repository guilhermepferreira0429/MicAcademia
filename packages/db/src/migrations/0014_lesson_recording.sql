CREATE TABLE "lesson_recording" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"egress_id" text NOT NULL,
	"room_name" text,
	"status" text DEFAULT 'starting' NOT NULL,
	"storage_key" text,
	"location" text,
	"duration_seconds" integer,
	"size_bytes" bigint,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"error" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_recording_egress_id_unique" UNIQUE("egress_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_recording" ADD CONSTRAINT "lesson_recording_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_recording" ADD CONSTRAINT "lesson_recording_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lesson_recording_lesson" ON "lesson_recording" USING btree ("lesson_id");