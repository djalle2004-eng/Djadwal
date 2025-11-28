#!/usr/bin/env node

/**
 * Test Day of Week Logic
 * اختبار منطق أيام الأسبوع
 */

console.log('🧪 اختبار منطق أيام الأسبوع...');
console.log('============================\n');

console.log('JavaScript days of week:');
console.log('0 = Sunday (الأحد)');
console.log('1 = Monday (الاثنين)');
console.log('2 = Tuesday (الثلاثاء)');
console.log('3 = Wednesday (الأربعاء)');
console.log('4 = Thursday (الخميس)');
console.log('5 = Friday (الجمعة)');
console.log('6 = Saturday (السبت)');
console.log('');

console.log('Testing date 2025-11-02:');
const date = new Date('2025-11-02');
console.log('Date:', date);
console.log('getDay():', date.getDay());
console.log('Day name:', ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][date.getDay()]);
console.log('');

console.log('Testing date 2025-10-26:');
const date2 = new Date('2025-10-26');
console.log('Date:', date2);
console.log('getDay():', date2.getDay());
console.log('Day name:', ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][date2.getDay()]);
console.log('');

console.log('Current logic in AvailableRooms.tsx:');
console.log('if (dayOfWeek === 0) { // الأحد');
console.log('  systemDayOfWeek = 1;');
console.log('} else if (dayOfWeek === 6) { // السبت');
console.log('  systemDayOfWeek = 0;');
console.log('} else { // الاثنين إلى الجمعة');
console.log('  systemDayOfWeek = dayOfWeek + 1;');
console.log('}');
console.log('');

console.log('Testing the conversion:');
const testDates = [
  { date: '2025-10-26', expected: 'Saturday' },
  { date: '2025-11-02', expected: 'Sunday' },
  { date: '2025-11-03', expected: 'Monday' }
];

testDates.forEach(test => {
  const date = new Date(test.date);
  const dayOfWeek = date.getDay();
  
  let systemDayOfWeek;
  if (dayOfWeek === 0) { // الأحد
    systemDayOfWeek = 1;
  } else if (dayOfWeek === 6) { // السبت
    systemDayOfWeek = 0;
  } else { // الاثنين إلى الجمعة
    systemDayOfWeek = dayOfWeek + 1;
  }
  
  console.log(`Date: ${test.date}`);
  console.log(`JavaScript dayOfWeek: ${dayOfWeek} (${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][dayOfWeek]})`);
  console.log(`System dayOfWeek: ${systemDayOfWeek}`);
  console.log(`Expected: ${test.expected}`);
  console.log('');
});

console.log('🎉 تم اختبار منطق أيام الأسبوع!');


