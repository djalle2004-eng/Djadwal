const { app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

// Désactiver better-sqlite3 et utiliser Neon PostgreSQL
const USE_NEON = process.env.USE_NEON === 'true';

// Chemin de la base de données locale
const dbPath = path.join(app.getPath('userData'), 'database.sqlite');

// Fonction pour exécuter les migrations
async function runMigrations() {
  try {
    console.log('Running migrations...');
    
    // Si on utilise Neon, sauter les migrations liées à better-sqlite3
    if (USE_NEON) {
      console.log('Migrations skipped: using Neon PostgreSQL');
      return;
    }
    
    const db = new Database(dbPath);
    
    // إنشاء جدول الأقسام
    db.exec(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created departments table');
    
    // التحقق من وجود العمود group_type في جدول المجموعات
    const groupColumns = db.prepare("PRAGMA table_info(groups)").all();
    const columnNames = groupColumns.map(col => col.name.toLowerCase());
    
    // إضافة أعمدة جديدة إلى جدول المجموعات
    if (!columnNames.includes('department_id')) {
      db.exec(`ALTER TABLE groups ADD COLUMN department_id INTEGER REFERENCES departments(id)`);
      console.log('Added department_id column to groups table');
    }
    
    if (!columnNames.includes('group_type')) {
      db.exec(`ALTER TABLE groups ADD COLUMN group_type TEXT`);
      console.log('Added group_type column to groups table');
    }
    
    if (!columnNames.includes('specialization')) {
      db.exec(`ALTER TABLE groups ADD COLUMN specialization TEXT`);
      console.log('Added specialization column to groups table');
    }
    
    if (!columnNames.includes('parent_group_id')) {
      db.exec(`ALTER TABLE groups ADD COLUMN parent_group_id INTEGER REFERENCES groups(id)`);
      console.log('Added parent_group_id column to groups table');
    }
    
    if (!columnNames.includes('year')) {
      db.exec(`ALTER TABLE groups ADD COLUMN year TEXT`);
      console.log('Added year column to groups table');
    }
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw new Error(`فشل تنفيذ ترقيات قاعدة البيانات: ${error.message}`);
  }
}

// Fonction pour ajouter des données initiales
function seedBasicData() {
  try {
    console.log('Seeding basic data...');
    
    // Si on utilise Neon, sauter le seeding local
    if (USE_NEON) {
      console.log('Seeding skipped: using Neon PostgreSQL (data already migrated)');
      return;
    }
    
    const db = new Database(dbPath);
    
    // التحقق من وجود أقسام وإضافة الأقسام الافتراضية إذا لم تكن موجودة
    const departmentsCount = db.prepare('SELECT COUNT(*) as count FROM departments').get().count;
    
    if (departmentsCount === 0) {
      const defaultDepartments = [
        { name: 'علوم اقتصادية', code: 'ECO' },
        { name: 'علوم التسيير', code: 'MGT' },
        { name: 'علوم تجارية', code: 'COM' },
        { name: 'علوم مالية ومحاسبية', code: 'FIN' },
        { name: 'الجذع المشترك', code: 'TC' }
      ];
      
      const insertStmt = db.prepare('INSERT INTO departments (name, code) VALUES (?, ?)');
      
      for (const dept of defaultDepartments) {
        insertStmt.run(dept.name, dept.code);
      }
      
      console.log('Added default departments');
    }
    
    console.log('Basic data seeding completed successfully');
  } catch (error) {
    console.error('Error seeding basic data:', error);
    throw new Error(`فشل إضافة البيانات الأساسية: ${error.message}`);
  }
}

module.exports = {
  runMigrations,
  seedBasicData
}; 