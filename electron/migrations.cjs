const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// تحديد مسار قاعدة البيانات
let dbPath;
if (app) {
  dbPath = path.join(app.getPath('userData'), 'database.sqlite');
} else {
  // للاختبار
  dbPath = path.join(__dirname, 'database.sqlite');
}

console.log('Database path for migrations:', dbPath);

// اتصال بقاعدة البيانات
let db;
try {
  db = new Database(dbPath, { verbose: console.log });
  console.log('Database connected successfully for migrations');
} catch (error) {
  console.error('Error connecting to database:', error);
  throw new Error(`فشل الاتصال بقاعدة البيانات: ${error.message}`);
}

// وظيفة لتنفيذ الترقيات
function runMigrations() {
  try {
    console.log('Running database migrations...');
    
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
    const groupColumns = db.prepare("PRAGMA table_info(groups)").all()
      .map(col => col.name.toLowerCase());
    
    // إضافة أعمدة جديدة إلى جدول المجموعات
    if (!groupColumns.includes('department_id')) {
      db.exec(`ALTER TABLE groups ADD COLUMN department_id INTEGER REFERENCES departments(id)`);
      console.log('Added department_id column to groups table');
    }
    
    if (!groupColumns.includes('group_type')) {
      db.exec(`ALTER TABLE groups ADD COLUMN group_type TEXT`);
      console.log('Added group_type column to groups table');
    }
    
    if (!groupColumns.includes('specialization')) {
      db.exec(`ALTER TABLE groups ADD COLUMN specialization TEXT`);
      console.log('Added specialization column to groups table');
    }
    
    if (!groupColumns.includes('parent_group_id')) {
      db.exec(`ALTER TABLE groups ADD COLUMN parent_group_id INTEGER REFERENCES groups(id)`);
      console.log('Added parent_group_id column to groups table');
    }
    
    if (!groupColumns.includes('year')) {
      db.exec(`ALTER TABLE groups ADD COLUMN year TEXT`);
      console.log('Added year column to groups table');
    }
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw new Error(`فشل تنفيذ ترقيات قاعدة البيانات: ${error.message}`);
  }
}

// وظيفة للتأكد من وجود بيانات الأقسام الأساسية
function seedBasicData() {
  try {
    console.log('Seeding basic data...');
    
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
      
      const insertDepartment = db.prepare('INSERT INTO departments (name, code) VALUES (?, ?)');
      
      for (const dept of defaultDepartments) {
        insertDepartment.run(dept.name, dept.code);
      }
      
      console.log('Added default departments');
    }
    
    console.log('Data seeding completed');
  } catch (error) {
    console.error('Error seeding data:', error);
    throw new Error(`فشل زرع البيانات الأولية: ${error.message}`);
  }
}

// تصدير الوظائف
module.exports = {
  runMigrations,
  seedBasicData
}; 