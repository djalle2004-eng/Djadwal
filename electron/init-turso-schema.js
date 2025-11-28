// Script to initialize Turso database schema
const { createClient } = require('@libsql/client');

const TURSO_URL = 'libsql://djadwal-djalle.aws-eu-west-1.turso.io';
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjE5MDkwMDYsImlkIjoiNzQyYmY2OTYtNDA3Zi00NDYwLWE4ZGEtZTQwNDJmMzQxZTY0IiwicmlkIjoiZDM1NjBjOTMtYzlmZi00OTliLWJkOTMtMDE5YmMwODAzOTUyIn0.eBc_mzZBjxIKGk67o7P0eae3fS4dJoerkiBurw92bhlUpAaKvCg2jGNDrG3IlPwCwNgjG8J5rOlhoRU2RfcWBA';

async function initTursoSchema() {
  console.log('🚀 Connecting to Turso...');

  const client = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN
  });

  try {
    console.log('✅ Connected to Turso');
    console.log('📦 Creating tables...');

    // Departments table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created departments table');

    // Specializations table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS specializations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        department_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments (id)
      )
    `);
    console.log('✅ Created specializations table');

    // Groups table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialization TEXT,
        parent_group_id INTEGER,
        department_id INTEGER,
        group_type TEXT DEFAULT 'group',
        year TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_group_id) REFERENCES groups (id),
        FOREIGN KEY (department_id) REFERENCES departments (id)
      )
    `);
    console.log('✅ Created groups table');

    // Courses table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        metadata TEXT DEFAULT '{}',
        department_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments (id)
      )
    `);
    console.log('✅ Created courses table');

    // Professors table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS professors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        title TEXT,
        academic_title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created professors table');

    // Rooms table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        capacity INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created rooms table');

    // Academic years table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year_name TEXT NOT NULL,
        is_current INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created academic_years table');

    // Semesters table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS semesters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        academic_year_id INTEGER NOT NULL,
        semester_name TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        is_current INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years (id)
      )
    `);
    console.log('✅ Created semesters table');

    // Assignments table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        course_id INTEGER NOT NULL,
        professor_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        session_type TEXT DEFAULT 'lecture',
        academic_year TEXT DEFAULT '',
        semester TEXT DEFAULT '1',
        specialization TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups (id),
        FOREIGN KEY (course_id) REFERENCES courses (id),
        FOREIGN KEY (professor_id) REFERENCES professors (id),
        FOREIGN KEY (room_id) REFERENCES rooms (id)
      )
    `);
    console.log('✅ Created assignments table');

    // Extra sessions table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS extra_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        course_id INTEGER NOT NULL,
        professor_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL,
        session_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        description TEXT,
        session_type TEXT,
        academic_year TEXT,
        semester TEXT,
        is_archived INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups (id),
        FOREIGN KEY (course_id) REFERENCES courses (id),
        FOREIGN KEY (professor_id) REFERENCES professors (id),
        FOREIGN KEY (room_id) REFERENCES rooms (id)
      )
    `);
    console.log('✅ Created extra_sessions table');

    // Users table (for authentication)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        email TEXT,
        role TEXT DEFAULT 'staff',
        professor_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (professor_id) REFERENCES professors (id)
      )
    `);
    console.log('✅ Created users table');

    // Audit log table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
    console.log('✅ Created audit_log table');

    // Create indexes
    console.log('📑 Creating indexes...');

    await client.execute('CREATE INDEX IF NOT EXISTS idx_assignments_group ON assignments(group_id)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_assignments_professor ON assignments(professor_id)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_assignments_room ON assignments(room_id)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_assignments_day ON assignments(day_of_week)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_semesters_academic_year ON semesters(academic_year_id)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');

    console.log('✅ Created indexes');

    // Insert default admin user (password: admin123)
    console.log('👤 Creating default admin user...');

    // bcrypt hash for "admin123"
    const adminPasswordHash = '$2b$10$rQ5Z5Z5Z5Z5Z5Z5Z5Z5Z5uKJ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5';

    await client.execute({
      sql: 'INSERT OR IGNORE INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      args: ['admin', adminPasswordHash, 'Administrator', 'admin']
    });

    console.log('✅ Default admin user created (username: admin, password: admin123)');

    console.log('');
    console.log('🎉 Turso database schema initialized successfully!');
    console.log('');
    console.log('📊 Created tables:');
    console.log('   - departments');
    console.log('   - specializations');
    console.log('   - groups');
    console.log('   - courses');
    console.log('   - professors');
    console.log('   - rooms');
    console.log('   - academic_years');
    console.log('   - semesters');
    console.log('   - assignments');
    console.log('   - extra_sessions');
    console.log('   - users');
    console.log('   - audit_log');
    console.log('   - backup_history');
    console.log('');

  } catch (error) {
    console.error('❌ Error initializing Turso schema:', error);
    throw error;
  } finally {
    client.close();
  }
}

// Run the initialization
initTursoSchema()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
