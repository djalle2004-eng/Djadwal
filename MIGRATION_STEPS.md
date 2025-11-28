# 🔄 خطوات ترحيل الطباعة إلى PDF

## 📋 الصفحات التي تحتاج تحديث

### ✅ **مكتمل:**
- [x] `src/pages/AvailableRooms.tsx` - تم التحديث

### 🔄 **يحتاج تحديث:**
- [ ] `src/pages/CourseAssignments.tsx` - (استخدام window.open)
- [ ] `src/pages/GroupTimetables.tsx` - (استخدام printSettings)
- [ ] `src/pages/ProfessorWorkload.tsx` - (استخدام printSettings)
- [ ] `src/pages/Schedule.tsx` - (فحص إضافي)
- [ ] `src/pages/Sessions.tsx` - (فحص إضافي)

---

## 🛠️ خطوات التحديث لكل صفحة

### **1. إضافة imports في أعلى الملف:**

```typescript
import { 
  printContent, 
  generateStyledTable, 
  generateFullDocument 
} from '../utils/printUtils';
```

### **2. استبدال window.open القديم:**

**❌ قبل:**
```typescript
const printWindow = window.open('', '_blank');
if (printWindow) {
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}
```

**✅ بعد:**
```typescript
// استخدام inline styles للجداول
const content = generateFullDocument(
  'عنوان المستند',
  tableHTML, // المحتوى
  {
    universityName: printSettings.universityName,
    facultyName: printSettings.facultyName,
    logoUrl: printSettings.universityLogoUrl,
    footerRight: 'رئيس القسم'
  }
);

// خيار 1: طباعة عادية
printContent(content, {
  title: 'اسم_الملف',
  orientation: 'landscape',
  fontSize: '12pt',
  asPDF: false
});

// خيار 2: حفظ كـ PDF (الأفضل)
printContent(content, {
  title: 'اسم_الملف',
  orientation: 'landscape',
  fontSize: '12pt',
  asPDF: true
});
```

### **3. تحديث الجداول لاستخدام inline styles:**

**❌ قبل:**
```html
<table>
  <thead>
    <tr>
      <th>العمود</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>البيانات</td>
    </tr>
  </tbody>
</table>
```

**✅ بعد (خيار 1 - يدوي):**
```html
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr style="background-color: #f0f0f0;">
      <th style="border: 2px solid #333; padding: 8px; text-align: center; font-weight: bold;">العمود</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #666; padding: 6px; text-align: center;">البيانات</td>
    </tr>
  </tbody>
</table>
```

**✅ بعد (خيار 2 - استخدام الدالة):**
```typescript
const table = generateStyledTable(
  ['العمود 1', 'العمود 2'], // Headers
  [
    ['بيانات 1', 'بيانات 2'],
    ['بيانات 3', 'بيانات 4']
  ],
  'عنوان الجدول' // Optional
);
```

---

## 📄 مثال كامل: تحديث صفحة CourseAssignments.tsx

### **الدالة: `exportRemoteCoursesReport()`**

**❌ الكود القديم (السطر 1300-1440):**
```typescript
const exportRemoteCoursesReport = async () => {
  try {
    const printSettings = await window.dataUtils.getPrintSettings();
    // ... build HTML ...
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  } catch (error) {
    // ...
  }
};
```

**✅ الكود الجديد:**
```typescript
const exportRemoteCoursesReport = async () => {
  try {
    const printSettings = await window.dataUtils.getPrintSettings();
    
    // بناء صفوف الجدول
    const rows = remoteCourses.map(course => [
      course.course_name || 'غير محدد',
      course.professor_name || 'غير معين',
      course.group_name || 'غير محدد',
      course.day_name || '-',
      `${course.start_time || '-'} - ${course.end_time || '-'}`,
      course.academic_year || '-',
      course.semester || '-'
    ]);
    
    // إنشاء الجدول
    const table = generateStyledTable(
      ['المقياس', 'الأستاذ', 'الفوج', 'اليوم', 'التوقيت', 'السنة', 'الفصل'],
      rows
    );
    
    // إضافة إحصائيات
    const stats = `
      <div style="margin: 20px 0; padding: 15px; background-color: #f0f0f0; border-radius: 5px;">
        <p style="font-size: 12pt;"><strong>إجمالي المقاييس عن بعد:</strong> ${remoteCourses.length}</p>
      </div>
    `;
    
    // إنشاء المستند الكامل
    const content = generateFullDocument(
      'تقرير المقاييس عن بعد',
      stats + table,
      {
        universityName: printSettings.universityName,
        facultyName: printSettings.facultyName,
        logoUrl: printSettings.universityLogoUrl,
        footerRight: 'رئيس القسم'
      }
    );
    
    // حفظ كـ PDF
    printContent(content, {
      title: 'مقاييس_عن_بعد',
      orientation: 'landscape',
      fontSize: '11pt',
      asPDF: true
    });
    
  } catch (error) {
    console.error('خطأ في تصدير التقرير:', error);
    alert('حدث خطأ أثناء تصدير التقرير');
  }
};
```

---

## 🎨 إضافة زرّين (طباعة + PDF)

إذا أردت خيار الطباعة العادية + PDF:

```typescript
// في الـ UI:
<Button 
  onClick={() => exportReport(false)} // false = طباعة عادية
  variant="outlined"
>
  🖨️ طباعة عادية
</Button>

<Button 
  onClick={() => exportReport(true)} // true = PDF
  variant="contained"
  color="success"
>
  📄 حفظ كـ PDF
</Button>

// في الدالة:
const exportReport = async (asPDF: boolean) => {
  // ... build content ...
  
  printContent(content, {
    title: 'التقرير',
    orientation: 'landscape',
    fontSize: '12pt',
    asPDF: asPDF // ✅
  });
};
```

---

## ✅ Checklist للتحديث

لكل صفحة:

- [ ] إضافة imports من printUtils
- [ ] استبدال window.open بـ printContent
- [ ] تحديث الجداول لاستخدام inline styles
- [ ] إضافة asPDF: true للخيار
- [ ] اختبار الطباعة والـ PDF
- [ ] التأكد من ظهور الخطوط
- [ ] التأكد من التنسيق

---

## 🚀 الأولوية

### **عالية:**
1. **CourseAssignments.tsx** - يحتوي على reportات مهمة
2. **GroupTimetables.tsx** - جداول الفرق
3. **ProfessorWorkload.tsx** - عبء الأساتذة

### **متوسطة:**
4. **Schedule.tsx** - جدول الدروس
5. **Sessions.tsx** - الحصص

---

## 📞 ملاحظات

- ✅ كل الدوال موجودة في `src/utils/printUtils.ts`
- ✅ التوثيق الكامل في `PDF_EXPORT_GUIDE.md`
- ✅ اختبر على `AvailableRooms.tsx` أولاً كمثال
- ⚠️ لا تنسَ `asPDF: true` للـ PDF!

---

تم إنشاء هذا الملف في: **25 أكتوبر 2025**
