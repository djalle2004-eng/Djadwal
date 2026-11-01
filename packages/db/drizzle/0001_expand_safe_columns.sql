-- ==============================================================================
-- 0001_expand_safe_columns.sql: Expand pattern migration (وسّع ثم قلّص)
-- Safe, additive-only migration. Never drops columns or tables.
-- ==============================================================================

-- 1. Missing tables on Neon PostgreSQL
CREATE TABLE IF NOT EXISTS "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text
);

CREATE TABLE IF NOT EXISTS "print_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" text UNIQUE NOT NULL,
	"setting_value" text,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer REFERENCES "users"("id")
);

CREATE TABLE IF NOT EXISTS "sandbox_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"data" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"professor_id" integer REFERENCES "professors"("id"),
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL REFERENCES "users"("id"),
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp
);

CREATE TABLE IF NOT EXISTS "auth_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer REFERENCES "users"("id"),
	"kind" text NOT NULL,
	"ip" text,
	"ua" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL UNIQUE,
	"role" text DEFAULT 'PROFESSOR' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" integer REFERENCES "users"("id"),
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "mfa_factors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL UNIQUE REFERENCES "users"("id"),
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"enabled_at" timestamp,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"token" text UNIQUE,
	"token_hash" text,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_code" varchar(50) UNIQUE,
	"module_name_arabic" varchar(255) NOT NULL,
	"module_name_english" varchar(255) NOT NULL,
	"credits" integer,
	"semester" integer,
	"department" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"professor_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
	"module_id" integer REFERENCES "modules"("id") ON DELETE CASCADE,
	"academic_year_id" integer REFERENCES "academic_years"("id") ON DELETE CASCADE,
	"teaching_type" varchar(20) NOT NULL,
	"priority_level" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

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

-- 2. Expand Pattern on existing tables
ALTER TABLE "semesters" ADD COLUMN IF NOT EXISTS "is_public" integer DEFAULT 1;

ALTER TABLE "extra_sessions" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1;
ALTER TABLE "extra_sessions" ADD COLUMN IF NOT EXISTS "is_archived" integer DEFAULT 0;
ALTER TABLE "extra_sessions" ADD COLUMN IF NOT EXISTS "exam_note" text DEFAULT '';
ALTER TABLE "extra_sessions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "prev_hash" text DEFAULT '0000000000000000000000000000000000000000000000000000000000000000';
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "row_hash" text;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "claimed_by" text;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;

ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "full_name_arabic" text;
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "full_name_latin" text;
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "academic_rank" text;
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "professional_email" text;
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "personal_email" text;
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "primary_phone" text;
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "secondary_phone" text;
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "phd_specialization" text;
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "field_of_research" text;
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "department" varchar(255);
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "profile_completed" boolean DEFAULT false;
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "user_id" integer REFERENCES "users"("id") ON DELETE CASCADE;

-- 3. Composite performance indexes
CREATE INDEX IF NOT EXISTS "idx_assignments_year_sem" ON "assignments"("academic_year", "semester");
CREATE INDEX IF NOT EXISTS "idx_assignments_prof" ON "assignments"("professor_id");
CREATE INDEX IF NOT EXISTS "idx_assignments_group" ON "assignments"("group_id");
CREATE INDEX IF NOT EXISTS "idx_assignments_room" ON "assignments"("room_id");

CREATE INDEX IF NOT EXISTS "idx_extra_sessions_date" ON "extra_sessions"("session_date");
CREATE INDEX IF NOT EXISTS "idx_extra_sessions_prof" ON "extra_sessions"("professor_id");

CREATE INDEX IF NOT EXISTS "idx_audit_created" ON "audit_log"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_user_id" ON "audit_log"("user_id");

CREATE INDEX IF NOT EXISTS "idx_sessions_user" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_token_hash" ON "sessions"("token_hash");

CREATE INDEX IF NOT EXISTS "idx_auth_events_user" ON "auth_events"("user_id");
CREATE INDEX IF NOT EXISTS "idx_auth_events_kind" ON "auth_events"("kind");
CREATE INDEX IF NOT EXISTS "idx_auth_events_created" ON "auth_events"("created_at");

CREATE INDEX IF NOT EXISTS "idx_invitations_token_hash" ON "invitations"("token_hash");

CREATE INDEX IF NOT EXISTS "idx_recon_table_op" ON "reconciliation_diffs"("table_name", "operation");

