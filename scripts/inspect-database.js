#!/usr/bin/env node

/**
 * Database Inspector
 * فاحص قاعدة البيانات
 */

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function inspectDatabase() {
  console.log('🔍 فحص قاعدة البيانات المحلية...');
  console.log('================================\n');
  
  const dbPath = path.join(__dirname, '..', 'database.db');
  
  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    console.log(`📁 مسار قاعدة البيانات: ${dbPath}`);
    
    // فحص الجداول
    console.log('\n📋 الجداول الموجودة:');
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
    
    if (tables.length === 0) {
      console.log('❌ لا توجد جداول في قاعدة البيانات');
      return;
    }
    
    for (const table of tables) {
      console.log(`  - ${table.name}`);
      
      // عدد السجلات في كل جدول
      try {
        const count = await db.get(`SELECT COUNT(*) as count FROM ${table.name}`);
        console.log(`    📊 عدد السجلات: ${count.count}`);
        
        // عرض عينة من البيانات
        if (count.count > 0) {
          const sample = await db.all(`SELECT * FROM ${table.name} LIMIT 3`);
          console.log(`    📄 عينة من البيانات:`);
          sample.forEach((row, index) => {
            console.log(`      ${index + 1}. ${JSON.stringify(row)}`);
          });
        }
      } catch (err) {
        console.log(`    ❌ خطأ في قراءة الجدول: ${err.message}`);
      }
      console.log('');
    }
    
    await db.close();
    console.log('✅ تم إغلاق قاعدة البيانات');
    
  } catch (err) {
    console.error('❌ خطأ في فحص قاعدة البيانات:', err.message);
  }
}

inspectDatabase();
