#!/usr/bin/env node

/**
 * Test getTimeSlots Function
 * اختبار دالة getTimeSlots
 */

require('dotenv').config();
const { getTimeSlots } = require('../electron/database');

async function testGetTimeSlots() {
  console.log('🧪 اختبار دالة getTimeSlots...');
  console.log('================================\n');
  
  try {
    const timeSlots = await getTimeSlots();
    console.log('✅ تم جلب الفترات الزمنية بنجاح:');
    console.log('📋 عدد الفترات:', timeSlots.length);
    console.log('\n📅 الفترات الزمنية:');
    timeSlots.forEach(slot => {
      console.log(`   ${slot.id}: ${slot.label} (${slot.start} - ${slot.end})`);
    });
    
    console.log('\n🎉 الاختبار نجح!');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testGetTimeSlots()
    .then(() => {
      console.log('\n✅ تم اختبار getTimeSlots بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testGetTimeSlots };
