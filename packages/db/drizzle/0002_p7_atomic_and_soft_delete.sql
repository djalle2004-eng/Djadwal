-- ==============================================================================
-- 0002_p7_atomic_and_soft_delete.sql: P7 Atomic Business Layer & Soft Delete
-- Expand pattern: Safe, additive-only migration. Never drops columns or tables.
-- ==============================================================================

-- 1. Optimistic Locking (version) columns
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "semesters" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;

-- 2. Soft Delete (deleted_at) columns
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

-- 3. Indexes on deleted_at for high performance query filtering
CREATE INDEX IF NOT EXISTS "idx_professors_deleted_at" ON "professors" ("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_courses_deleted_at" ON "courses" ("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_rooms_deleted_at" ON "rooms" ("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_groups_deleted_at" ON "groups" ("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_departments_deleted_at" ON "departments" ("deleted_at");

-- 4. Change Log table for business audit trail and 24h undo
CREATE TABLE IF NOT EXISTS "change_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"changed_by" integer REFERENCES "users"("id"),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reverted_at" timestamp,
	"reverted_by" integer REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "idx_change_log_entity" ON "change_log" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_change_log_created" ON "change_log" ("created_at");

