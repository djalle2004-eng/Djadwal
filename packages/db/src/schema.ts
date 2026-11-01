import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  varchar,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';

// 1. Academic Years
export const academicYears = pgTable('academic_years', {
  id: serial('id').primaryKey(),
  year_name: text('year_name').notNull(),
  is_current: integer('is_current').default(0),
  created_at: timestamp('created_at').defaultNow()
});

// 2. Departments
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code'),
  created_at: timestamp('created_at').defaultNow(),
  deleted_at: timestamp('deleted_at')
});

// 3. Rooms
export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  capacity: integer('capacity').default(0),
  version: integer('version').default(1).notNull(),
  deleted_at: timestamp('deleted_at'),
  created_at: timestamp('created_at').defaultNow()
});

// 4. Courses
export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code'),
  metadata: text('metadata').default('{}'),
  department_id: integer('department_id').references(() => departments.id),
  version: integer('version').default(1).notNull(),
  deleted_at: timestamp('deleted_at'),
  created_at: timestamp('created_at').defaultNow()
});

// 5. Users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  full_name: text('full_name'),
  email: text('email'),
  role: text('role').default('staff').notNull(),
  professor_id: integer('professor_id'),
  is_active: integer('is_active').default(1),
  last_login: text('last_login'),
  permissions: text('permissions'),
  email_verified_at: timestamp('email_verified_at'),
  created_at: text('created_at'),
  updated_at: timestamp('updated_at').defaultNow()
});

// 6. Professors
export const professors = pgTable('professors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  title: text('title'),
  academic_title: text('academic_title'),
  full_name_arabic: text('full_name_arabic'),
  full_name_latin: text('full_name_latin'),
  academic_rank: text('academic_rank'),
  professional_email: text('professional_email'),
  personal_email: text('personal_email'),
  primary_phone: text('primary_phone'),
  secondary_phone: text('secondary_phone'),
  phd_specialization: text('phd_specialization'),
  field_of_research: text('field_of_research'),
  department: varchar('department', { length: 255 }),
  profile_completed: boolean('profile_completed').default(false),
  user_id: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  version: integer('version').default(1).notNull(),
  deleted_at: timestamp('deleted_at'),
  created_at: timestamp('created_at').defaultNow()
});

// 7. Groups
export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  specialization: text('specialization'),
  parent_group_id: integer('parent_group_id'),
  department_id: integer('department_id').references(() => departments.id),
  group_type: text('group_type').default('group'),
  year: text('year'),
  version: integer('version').default(1).notNull(),
  deleted_at: timestamp('deleted_at'),
  created_at: timestamp('created_at').defaultNow()
});

// 8. Semesters
export const semesters = pgTable('semesters', {
  id: serial('id').primaryKey(),
  academic_year_id: integer('academic_year_id').references(() => academicYears.id).notNull(),
  semester_name: text('semester_name').notNull(),
  start_date: text('start_date'),
  end_date: text('end_date'),
  is_current: integer('is_current').default(0),
  is_public: integer('is_public').default(1),
  version: integer('version').default(1).notNull(),
  created_at: timestamp('created_at').defaultNow()
});

// 9. Assignments
export const assignments = pgTable('assignments', {
  id: serial('id').primaryKey(),
  group_id: integer('group_id').references(() => groups.id),
  course_id: integer('course_id').references(() => courses.id).notNull(),
  professor_id: integer('professor_id').references(() => professors.id).notNull(),
  room_id: integer('room_id').references(() => rooms.id).notNull(),
  day_of_week: integer('day_of_week').notNull(),
  start_time: text('start_time').notNull(),
  end_time: text('end_time').notNull(),
  session_type: text('session_type').default('lecture'),
  academic_year: text('academic_year').default(''),
  semester: text('semester').default('1'),
  specialization: text('specialization').default(''),
  created_at: text('created_at'),
  version: integer('version').default(1).notNull(),
  updated_at: timestamp('updated_at').defaultNow()
}, (table) => ({
  yearSemIdx: index('idx_assignments_year_sem').on(table.academic_year, table.semester),
  profIdx: index('idx_assignments_prof').on(table.professor_id),
  groupIdx: index('idx_assignments_group').on(table.group_id),
  roomIdx: index('idx_assignments_room').on(table.room_id)
}));

// 10. Extra Sessions
export const extraSessions = pgTable('extra_sessions', {
  id: serial('id').primaryKey(),
  group_id: integer('group_id').references(() => groups.id),
  course_id: integer('course_id').references(() => courses.id).notNull(),
  professor_id: integer('professor_id').references(() => professors.id).notNull(),
  room_id: integer('room_id').references(() => rooms.id).notNull(),
  session_date: text('session_date').notNull(),
  start_time: text('start_time').notNull(),
  end_time: text('end_time').notNull(),
  description: text('description'),
  session_type: text('session_type'),
  academic_year: text('academic_year'),
  semester: text('semester'),
  reason: text('reason'),
  is_archived: integer('is_archived').default(0),
  exam_note: text('exam_note').default(''),
  version: integer('version').default(1),
  created_at: text('created_at'),
  updated_at: timestamp('updated_at').defaultNow()
}, (table) => ({
  dateIdx: index('idx_extra_sessions_date').on(table.session_date),
  profIdx: index('idx_extra_sessions_prof').on(table.professor_id)
}));

// 11. Audit Log (Hardened with Cryptographic Hash Chain)
export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entity_type: text('entity_type'),
  entity_id: text('entity_id'),
  details: text('details'),
  ip_address: text('ip_address'),
  created_at: text('created_at'),
  prev_hash: text('prev_hash').default('0000000000000000000000000000000000000000000000000000000000000000'),
  row_hash: text('row_hash'),
  claimed_by: text('claimed_by')
}, (table) => ({
  createdIdx: index('idx_audit_created').on(table.created_at),
  userIdx: index('idx_audit_user_id').on(table.user_id)
}));

// 12. App Config
export const appConfig = pgTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value')
});

// 13. Backup History
export const backupHistory = pgTable('backup_history', {
  id: serial('id').primaryKey(),
  backup_name: text('backup_name').notNull(),
  backup_path: text('backup_path'),
  backup_type: text('backup_type'),
  backup_format: text('backup_format').default('sqlite'),
  file_size: integer('file_size'),
  created_by: integer('created_by').references(() => users.id),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow()
});

// 14. Email Settings
export const emailSettings = pgTable('email_settings', {
  id: serial('id').primaryKey(),
  gmail_refresh_token: text('gmail_refresh_token'),
  gmail_access_token: text('gmail_access_token'),
  token_expiry: timestamp('token_expiry'),
  app_email: text('app_email'),
  is_authenticated: integer('is_authenticated').default(0),
  last_auth_date: timestamp('last_auth_date'),
  created_at: text('created_at'),
  updated_at: timestamp('updated_at').defaultNow()
});

// 15. Email Logs
export const emailLogs = pgTable('email_logs', {
  id: serial('id').primaryKey(),
  professor_id: integer('professor_id').references(() => professors.id),
  recipient_email: text('recipient_email').notNull(),
  subject: text('subject').notNull(),
  status: text('status').notNull(),
  error_message: text('error_message'),
  sent_at: timestamp('sent_at'),
  created_at: timestamp('created_at').defaultNow()
});

// 16. Print Settings
export const printSettings = pgTable('print_settings', {
  id: serial('id').primaryKey(),
  setting_key: text('setting_key').unique().notNull(),
  setting_value: text('setting_value'),
  updated_at: timestamp('updated_at').defaultNow(),
  updated_by: integer('updated_by').references(() => users.id)
});

// 17. Sandbox Snapshots
export const sandboxSnapshots = pgTable('sandbox_snapshots', {
  id: serial('id').primaryKey(),
  name: text('name'),
  data: text('data').notNull(),
  created_at: text('created_at'),
  updated_at: timestamp('updated_at').defaultNow()
});

// 18. Sessions (P4 Revocable Sessions)
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id).notNull(),
  token_hash: text('token_hash').notNull(),
  user_agent: text('user_agent'),
  ip: text('ip'),
  created_at: text('created_at'),
  expires_at: timestamp('expires_at').notNull(),
  revoked_at: timestamp('revoked_at')
}, (table) => ({
  userIdx: index('idx_sessions_user').on(table.user_id),
  tokenHashIdx: index('idx_sessions_token_hash').on(table.token_hash)
}));

// 19. Auth Events
export const authEvents = pgTable('auth_events', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id),
  kind: text('kind').notNull(),
  ip: text('ip'),
  ua: text('ua'),
  created_at: timestamp('created_at').defaultNow()
}, (table) => ({
  userIdx: index('idx_auth_events_user').on(table.user_id),
  kindIdx: index('idx_auth_events_kind').on(table.kind),
  createdIdx: index('idx_auth_events_created').on(table.created_at)
}));

// 20. Invitations
export const invitations = pgTable('invitations', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  role: text('role').default('PROFESSOR').notNull(),
  token_hash: text('token_hash').notNull(),
  invited_by: integer('invited_by').references(() => users.id),
  expires_at: timestamp('expires_at').notNull(),
  accepted_at: timestamp('accepted_at'),
  created_at: timestamp('created_at').defaultNow()
}, (table) => ({
  tokenHashIdx: index('idx_invitations_token_hash').on(table.token_hash)
}));

// 21. MFA Factors
export const mfaFactors = pgTable('mfa_factors', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id).notNull().unique(),
  secret: text('secret').notNull(),
  backup_codes: text('backup_codes').notNull(),
  enabled_at: timestamp('enabled_at'),
  created_at: timestamp('created_at').defaultNow()
});

// 22. Password Reset Tokens
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').unique(),
  token_hash: text('token_hash'),
  expires_at: timestamp('expires_at').notNull(),
  used_at: timestamp('used_at'),
  created_at: timestamp('created_at').defaultNow()
});

// 23. Modules
export const modules = pgTable('modules', {
  id: serial('id').primaryKey(),
  module_code: varchar('module_code', { length: 50 }).unique(),
  module_name_arabic: varchar('module_name_arabic', { length: 255 }).notNull(),
  module_name_english: varchar('module_name_english', { length: 255 }).notNull(),
  credits: integer('credits'),
  semester: integer('semester'),
  department: varchar('department', { length: 255 }).notNull(),
  description: text('description'),
  created_at: text('created_at'),
  updated_at: timestamp('updated_at').defaultNow()
});

// 24. Preferences
export const preferences = pgTable('preferences', {
  id: serial('id').primaryKey(),
  professor_id: integer('professor_id').references(() => users.id, { onDelete: 'cascade' }),
  module_id: integer('module_id').references(() => modules.id, { onDelete: 'cascade' }),
  academic_year_id: integer('academic_year_id').references(() => academicYears.id, { onDelete: 'cascade' }),
  teaching_type: varchar('teaching_type', { length: 20 }).notNull(),
  priority_level: integer('priority_level').default(3),
  created_at: text('created_at'),
  updated_at: timestamp('updated_at').defaultNow()
});

// 25. Specializations
export const specializations = pgTable('specializations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code'),
  department_id: integer('department_id').references(() => departments.id),
  created_at: timestamp('created_at').defaultNow()
});

// 26. Schema Migrations (P6 Managed Migrations Audit Trail)
export const schemaMigrations = pgTable('schema_migrations', {
  id: serial('id').primaryKey(),
  version: varchar('version', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  checksum: varchar('checksum', { length: 64 }).notNull(),
  started_at: timestamp('started_at').defaultNow().notNull(),
  finished_at: timestamp('finished_at'),
  applied_by: varchar('applied_by', { length: 100 }),
  status: varchar('status', { length: 20 }).notNull() // 'pending' | 'applied' | 'failed'
});

// 27. Reconciliation Diffs (P6 Asynchronous Dual-Write Safety Log)
export const reconciliationDiffs = pgTable('reconciliation_diffs', {
  id: serial('id').primaryKey(),
  table_name: varchar('table_name', { length: 100 }).notNull(),
  operation: varchar('operation', { length: 10 }).notNull(),
  entity_id: varchar('entity_id', { length: 100 }),
  payload: text('payload'),
  error_message: text('error_message'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  resolved_at: timestamp('resolved_at')
}, (table) => ({
  tableOpIdx: index('idx_recon_table_op').on(table.table_name, table.operation)
}));


// 28. Change Log (P7 Atomic Business Layer Audit & Undo Log)
export const changeLog = pgTable('change_log', {
  id: serial('id').primaryKey(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id').notNull(),
  action: text('action').notNull(),
  before_state: text('before_state'),
  after_state: text('after_state'),
  changed_by: integer('changed_by').references(() => users.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  reverted_at: timestamp('reverted_at'),
  reverted_by: integer('reverted_by').references(() => users.id)
}, (table) => ({
  entityIdx: index('idx_change_log_entity').on(table.entity_type, table.entity_id),
  createdIdx: index('idx_change_log_created').on(table.created_at)
}));
