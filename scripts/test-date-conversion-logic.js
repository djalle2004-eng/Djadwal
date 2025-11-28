#!/usr/bin/env node

/**
 * Test Date Conversion Logic
 * اختبار منطق تحويل التواريخ
 */

console.log('🧪 اختبار منطق تحويل التواريخ...');
console.log('==============================\n');

console.log('Testing date conversion logic:');
console.log('');

const testDates = [
  { date: '2025-10-26', expected: 'Saturday' },
  { date: '2025-11-02', expected: 'Sunday' },
  { date: '2025-11-03', expected: 'Monday' }
];

testDates.forEach(test => {
  console.log(`📅 Testing ${test.date}:`);
  
  // Test with different time formats
  const date1 = new Date(test.date);
  const date2 = new Date(test.date + 'T00:00:00');
  const date3 = new Date(test.date + 'T12:00:00');
  
  console.log(`  new Date('${test.date}'): ${date1.toDateString()}, Day: ${date1.getDay()}`);
  console.log(`  new Date('${test.date}T00:00:00'): ${date2.toDateString()}, Day: ${date2.getDay()}`);
  console.log(`  new Date('${test.date}T12:00:00'): ${date3.toDateString()}, Day: ${date3.getDay()}`);
  
  // Test the conversion logic
  const dayOfWeek = date3.getDay(); // Use the 12:00:00 version
  
  let systemDayOfWeek;
  if (dayOfWeek === 0) { // الأحد
    systemDayOfWeek = 1;
  } else if (dayOfWeek === 6) { // السبت
    systemDayOfWeek = 0;
  } else { // الاثنين إلى الجمعة
    systemDayOfWeek = dayOfWeek + 1;
  }
  
  console.log(`  JavaScript dayOfWeek: ${dayOfWeek}`);
  console.log(`  System dayOfWeek: ${systemDayOfWeek}`);
  console.log(`  Expected: ${test.expected}`);
  console.log('');
});

console.log('🎉 تم اختبار منطق تحويل التواريخ!');


