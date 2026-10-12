# Archived Diagnostic and Migration Logs

This directory contains historical diagnostic scripts, temporary build timestamps, and migration error logs archived away from the root directory during the P0 Safety Net refactoring:

- `db-diagnostic.txt`: Raw diagnostic report from initial database inspection.
- `migration-errors.json`: Legacy migration run failure logs (135KB).
- `retry-migration-errors.json`: Migration retry attempt error dump.
- `vite.config.ts.timestamp-*.mjs`: Temporary Vite runtime build timestamps.

These files are preserved for historical reference and troubleshooting, but excluded from active builds and version control via `.gitignore`.
