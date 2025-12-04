const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

try {
    console.log('Creating sandbox_snapshots table...');

    db.exec(`
    CREATE TABLE IF NOT EXISTS sandbox_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    console.log('✅ sandbox_snapshots table created successfully.');

} catch (error) {
    console.error('❌ Error creating table:', error);
} finally {
    db.close();
}
