// @djadwal/db package entry point
const database = require('../../server/database.js');

module.exports = {
  executeQuery: database.executeQuery,
  tables: [
    'academic_years',
    'app_config',
    'assignments',
    'audit_log',
    'backup_history',
    'courses',
    'departments',
    'email_logs',
    'email_settings',
    'extra_sessions',
    'groups',
    'print_settings',
    'professors',
    'rooms',
    'sandbox_snapshots',
    'semesters',
    'users'
  ]
};
