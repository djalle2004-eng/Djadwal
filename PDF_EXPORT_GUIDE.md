# 📄 دليل تصدير PDF المُحسّن

## 🎯 التحديثات المطبقة

تم تحديث نظام الطباعة في Djadwal ليدعم **تصدير PDF حقيقي** بدلاً من الصور.

---

## ✨ المميزات الجديدة

### **1. تصدير PDF حقيقي**
- ✅ PDF قابل للبحث والنسخ (ليس صورة)
- ✅ جودة عالية للنصوص العربية
- ✅ حجم ملف أصغر
- ✅ دعم الجداول مع borders واضحة

### **2. خيارات مرنة**
- 🖨️ **طباعة عادية**: تفتح dialog الطباعة
- 📄 **حفظ كـ PDF**: يحفظ مباشرة كملف PDF

### **3. Inline Styles للجداول**
كل الجداول تستخدم inline styles لضمان ظهورها في PDF:
```html
<table style="width: 100%; border-collapse: collapse;">
  <th style="border: 2px solid #333; padding: 8px;">العمود</th>
  <td style="border: 1px solid #666; padding: 6px;">البيانات</td>
</table>
```

---

## 📚 الدوال المساعدة الجديدة

### **في `src/utils/printUtils.ts`:**

#### **1. `generatePDFFromHTML(content, options)`**
```typescript
// توليد PDF من HTML
printContent(htmlContent, {
  title: 'عنوان الملف',
  orientation: 'portrait', // or 'landscape'
  fontSize: '12pt',
  asPDF: true // ✅ مهم!
});
```

#### **2. `generateStyledTable(headers, rows, title?)`**
```typescript
// إنشاء جدول بـ inline styles
const table = generateStyledTable(
  ['العمود 1', 'العمود 2'], // Headers
  [['بيانات 1', 'بيانات 2']], // Rows
  'عنوان الجدول' // Optional
);
```

#### **3. `generateDocumentHeader(title, university?, faculty?, logo?)`**
```typescript
// إنشاء header للمستند
const header = generateDocumentHeader(
  'جدول الأساتذة',
  'جامعة الأغواط',
  'كلية العلوم',
  'logo.png'
);
```

#### **4. `generateFullDocument(title, content, options?)`**
```typescript
// إنشاء مستند كامل
const document = generateFullDocument(
  'جدول الحصص',
  tableHTML,
  {
    universityName: 'جامعة الأغواط',
    facultyName: 'كلية العلوم',
    logoUrl: 'logo.png',
    footerRight: 'رئيس القسم'
  }
);
```

---

## 🔄 كيفية تحويل كود قديم

### **قبل (window.open):**
```typescript
const printWindow = window.open('', '_blank');
if (printWindow) {
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}
```

### **بعد (printContent مع PDF):**
```typescript
import { printContent, generateFullDocument } from '../utils/printUtils';

// إنشاء المحتوى
const content = generateFullDocument(
  'عنوان المستند',
  tableHTML,
  {
    universityName: 'جامعة الأغواط',
    facultyName: 'كلية العلوم'
  }
);

// طباعة أو حفظ PDF
printContent(content, {
  title: 'اسم_الملف',
  orientation: 'landscape',
  fontSize: '12pt',
  asPDF: true // ✅ للـ PDF
});
```

---

## 📋 الصفحات المُحدّثة

### ✅ **مكتمل:**
1. ✅ `src/pages/AvailableRooms.tsx`
   - قائمة الحصص الإضافية
   - شهادات الحصص الفردية
   
2. ✅ `src/utils/printUtils.ts`
   - دوال مساعدة عامة
   - تصدير PDF

### 🔄 **يحتاج تحديث:**
1. ⏳ `src/pages/ProfessorWorkload.tsx`
2. ⏳ `src/pages/Schedule.tsx`
3. ⏳ `src/pages/GroupTimetables.tsx`
4. ⏳ `src/pages/CourseAssignments.tsx`
5. ⏳ `src/pages/Sessions.tsx`

---

## 🎨 مثال كامل

```typescript
import { 
  printContent, 
  generateStyledTable, 
  generateFullDocument 
} from '../utils/printUtils';

// 1. إنشاء جدول
const table = generateStyledTable(
  ['الأستاذ', 'المقياس', 'الساعات'],
  [
    ['د. محمد', 'رياضيات', '6'],
    ['د. فاطمة', 'فيزياء', '4']
  ]
);

// 2. إنشاء مستند كامل
const document = generateFullDocument(
  'جدول العبء التدريسي',
  table,
  {
    universityName: 'جامعة عمار ثليجي الأغواط',
    facultyName: 'كلية الاقتصاد',
    footerRight: 'رئيس القسم: د. علي'
  }
);

// 3. حفظ كـ PDF
printContent(document, {
  title: 'عبء_الأساتذة_2024',
  orientation: 'landscape',
  fontSize: '12pt',
  asPDF: true
});
```

---

## ⚙️ الإعدادات المتقدمة

### **في `generatePDFFromHTML()`:**
```typescript
{
  margin: [10, 10, 10, 10],
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { 
    scale: 3,              // ✅ جودة عالية
    letterRendering: true, // ✅ نصوص واضحة
    windowWidth: 1200
  },
  jsPDF: { 
    unit: 'mm', 
    format: 'a4', 
    orientation: 'portrait',
    compress: false        // ✅ جودة أفضل
  }
}
```

---

## 🐛 حل المشاكل الشائعة

### **المشكلة: الجداول لا تظهر في PDF**
**الحل:** استخدم inline styles:
```html
<!-- ❌ خطأ -->
<table class="my-table">

<!-- ✅ صحيح -->
<table style="border-collapse: collapse;">
```

### **المشكلة: النصوص غير واضحة**
**الحل:** زيادة scale في الإعدادات (حالياً 3)

### **المشكلة: الملف كبير جداً**
**الحل:** تقليل `quality` أو `scale`

---

## 📦 المتطلبات

```json
{
  "html2pdf.js": "^0.10.3",
  "html2canvas": "^1.4.1"
}
```

---

## 👨‍💻 المطور

تم التطوير بواسطة: **Ali**  
التاريخ: **25 أكتوبر 2025**  
الإصدار: **7.9.2025**

---

## 📞 للدعم

إذا واجهت أي مشاكل، راجع:
- 📄 `src/utils/printUtils.ts`
- 🔍 Console في DevTools (F12)
- 📝 هذا الملف للأمثلة
