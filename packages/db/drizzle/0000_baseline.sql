-- ==============================================================================
-- 0000_baseline.sql: Snapshot of baseline schema (لقطة وليس تنفيذًا على قاعدة موجودة)
-- Captured from production schema state for Drizzle ORM baseline tracking.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "academic_years" (
	"id" serial PRIMARY KEY NOT NULL,
	"year_name" text NOT NULL,
	"is_current" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer,
	"course_id" integer NOT NULL,
	"professor_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"session_type" text DEFAULT 'lecture',
	"academic_year" text DEFAULT '',
	"semester" text DEFAULT '1',
	"specialization" text DEFAULT '',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" integer,
	"details" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now(),
	"prev_hash" text DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
	"row_hash" text,
	"claimed_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"kind" text NOT NULL,
	"ip" text,
	"ua" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"backup_name" text NOT NULL,
	"backup_path" text,
	"backup_type" text,
	"backup_format" text DEFAULT 'sqlite',
	"file_size" integer,
	"created_by" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"metadata" text DEFAULT '{}',
	"department_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"professor_id" integer,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"gmail_refresh_token" text,
	"gmail_access_token" text,
	"token_expiry" timestamp,
	"app_email" text,
	"is_authenticated" integer DEFAULT 0,
	"last_auth_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extra_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer,
	"course_id" integer NOT NULL,
	"professor_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"session_date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"description" text,
	"session_type" text,
	"academic_year" text,
	"semester" text,
	"reason" text,
	"is_archived" integer DEFAULT 0,
	"exam_note" text DEFAULT '',
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"specialization" text,
	"parent_group_id" integer,
	"department_id" integer,
	"group_type" text DEFAULT 'group',
	"year" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'PROFESSOR' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" integer,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "invitations_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mfa_factors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"enabled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "mfa_factors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_code" varchar(50),
	"module_name_arabic" varchar(255) NOT NULL,
	"module_name_english" varchar(255) NOT NULL,
	"credits" integer,
	"semester" integer,
	"department" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "modules_module_code_unique" UNIQUE("module_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text,
	"token_hash" text,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"professor_id" integer,
	"module_id" integer,
	"academic_year_id" integer,
	"teaching_type" varchar(20) NOT NULL,
	"priority_level" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "print_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "print_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "professors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"title" text,
	"academic_title" text,
	"full_name_arabic" text,
	"full_name_latin" text,
	"academic_rank" text,
	"professional_email" text,
	"personal_email" text,
	"primary_phone" text,
	"secondary_phone" text,
	"phd_specialization" text,
	"field_of_research" text,
	"department" varchar(255),
	"profile_completed" boolean DEFAULT false,
	"user_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reconciliation_diffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_name" varchar(100) NOT NULL,
	"operation" varchar(10) NOT NULL,
	"entity_id" varchar(100),
	"payload" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"capacity" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sandbox_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"data" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schema_migrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"applied_by" varchar(100),
	"status" varchar(20) NOT NULL,
	CONSTRAINT "schema_migrations_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "semesters" (
	"id" serial PRIMARY KEY NOT NULL,
	"academic_year_id" integer NOT NULL,
	"semester_name" text NOT NULL,
	"start_date" text,
	"end_date" text,
	"is_current" integer DEFAULT 0,
	"is_public" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "specializations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"department_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text,
	"email" text,
	"role" text DEFAULT 'staff' NOT NULL,
	"professor_id" integer,
	"is_active" integer DEFAULT 1,
	"last_login" text,
	"permissions" text,
	"email_verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "assignments" ADD CONSTRAINT "assignments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "assignments" ADD CONSTRAINT "assignments_professor_id_professors_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."professors"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "assignments" ADD CONSTRAINT "assignments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "backup_history" ADD CONSTRAINT "backup_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "courses" ADD CONSTRAINT "courses_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_professor_id_professors_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."professors"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "extra_sessions" ADD CONSTRAINT "extra_sessions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "extra_sessions" ADD CONSTRAINT "extra_sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "extra_sessions" ADD CONSTRAINT "extra_sessions_professor_id_professors_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."professors"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "extra_sessions" ADD CONSTRAINT "extra_sessions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "groups" ADD CONSTRAINT "groups_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "preferences" ADD CONSTRAINT "preferences_professor_id_users_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "preferences" ADD CONSTRAINT "preferences_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "preferences" ADD CONSTRAINT "preferences_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "print_settings" ADD CONSTRAINT "print_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "professors" ADD CONSTRAINT "professors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "semesters" ADD CONSTRAINT "semesters_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "specializations" ADD CONSTRAINT "specializations_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assignments_year_sem" ON "assignments" USING btree ("academic_year","semester");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assignments_prof" ON "assignments" USING btree ("professor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assignments_group" ON "assignments" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assignments_room" ON "assignments" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_created" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_user_id" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_events_user" ON "auth_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_events_kind" ON "auth_events" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_events_created" ON "auth_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_extra_sessions_date" ON "extra_sessions" USING btree ("session_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_extra_sessions_prof" ON "extra_sessions" USING btree ("professor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invitations_token_hash" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recon_table_op" ON "reconciliation_diffs" USING btree ("table_name","operation");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_token_hash" ON "sessions" USING btree ("token_hash");