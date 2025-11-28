# تحسينات نظام الطباعة - Djadwal

## نظرة عامة

تم تنفيذ تحسينات شاملة لنظام الطباعة في تطبيق Djadwal لتوفير تحكم كامل ومرن في إعدادات الطباعة والتنسيق.

## ✅ التحسينات المنفذة

### 1. نظام الأنواع المحسّن (TypeScript Types)

**الملف:** `src/types/shared.ts`

تم إضافة أنواع شاملة لإعدادات الطباعة:

- `PageSize`: أحجام الصفحات المدعومة (A4, A3, Letter, Legal)
- `PageOrientation`: اتجاه الصفحة (portrait, landscape)
- `TextAlignment`: محاذاة النص (left, center, right)
- `PrintSettings`: إعدادات الطباعة الأساسية (40+ خاصية)
- `PrintOptions`: خيارات الطباعة الموسعة
- `PrintPreset`: قوالب الطباعة المحددة مسبقاً

**الميزات:**
- توثيق كامل لكل خاصية مع القيم الافتراضية
- دعم كامل للـ IntelliSense في VS Code
- Type safety لجميع عمليات الطباعة

### 2. Hook موحد لإدارة الإعدادات

**الملف:** `src/hooks/usePrintSettings.ts`

Hook مخصص يوفر:

```typescript
const { 
  settings,           // الإعدادات الحالية
  isLoading,          // حالة التحميل
  error,              // رسائل الخطأ
  loadSettings,       // تحميل الإعدادات
  saveSettings,       // حفظ الإعدادات
  resetToDefaults,    // إعادة تعيين للقيم الافتراضية
  mergeWithDefaults   // دمج إعدادات جزئية
} = usePrintSettings();
```

**الميزات:**
- تحميل تلقائي للإعدادات عند التهيئة
- دمج ذكي مع القيم الافتراضية
- معالجة أخطاء شاملة
- دوال مساعدة: `createPrintOptions()`, `getPrintSettingsWithDefaults()`

### 3. تحديث printUtils.ts

**الملف:** `src/utils/printUtils.ts`

تحسينات CSS والطباعة:

#### الطباعة العادية (window.print):
- دعم كامل لجميع إعدادات الهوامش
- تطبيق ديناميكي لأحجام الخطوط
- دعم حدود الجداول (العرض واللون)
- تطبيق محاذاة الخلايا
- دعم العلامة المائية
- ترويسة وتذييل مخصصة

#### توليد PDF (html2pdf.js):
- إزالة scale الثابت
- حساب ديناميكي للهوامش
- دعم أحجام صفحات متعددة
- تحسين جودة الصور (scale: 2)
- رسالة تحميل أثناء التوليد

#### دوال مساعدة محسّنة:
- `generateFullDocument()`: دعم كامل للإعدادات الجديدة
- `generateDocumentHeader()`: ترويسة مخصصة
- `generateDocumentFooter()`: تذييل مخصص
- `generateStyledTable()`: جداول بتنسيق موحد

### 4. واجهة إعدادات محسّنة

**الملف:** `src/pages/PrintSettingsNew.tsx`

واجهة جديدة بالكامل مع:

#### التنظيم:
- 6 تبويبات منظمة:
  1. معلومات المؤسسة
  2. الشعارات
  3. أحجام الخطوط
  4. تنسيق الجداول
  5. هوامش الصفحة
  6. إعدادات إضافية

#### المعاينة المباشرة:
- iframe يعرض التغييرات فوراً
- نموذج جدول تجريبي
- تحديث تلقائي عند تغيير أي إعداد

#### عناصر التحكم:
- Sliders لأحجام الخطوط والهوامش
- Color picker لألوان الحدود
- Select boxes للمحاذاة وحجم الصفحة
- Switches للخيارات المنطقية
- Upload buttons للشعارات مع معاينة

#### تجربة المستخدم:
- Snackbar notifications للنجاح/الفشل
- تأكيد قبل إعادة التعيين
- حفظ تلقائي مع رجوع للصفحة السابقة
- معالجة أخطاء شاملة

### 5. تحسينات Electron

**الملف:** `electron/main.js`

#### معالج get-print-settings:
- قراءة من ملف JSON
- تحويل الشعارات إلى data URLs
- دمج مع القيم الافتراضية
- دعم جميع الإعدادات الجديدة (40+ خاصية)

#### معالج save-print-settings:
- حفظ جميع الإعدادات الجديدة
- إدارة ذكية للشعارات:
  - حفظ الشعارات الجديدة
  - حذف الشعارات القديمة
  - الاحتفاظ بالشعارات الموجودة
- تسجيل في Audit Log
- معالجة أخطاء محسّنة

## 📋 الإعدادات المدعومة

### معلومات المؤسسة
- `universityName`: اسم الجامعة
- `facultyName`: اسم الكلية
- `departmentName`: اسم القسم

### الشعارات
- `universityLogoUrl`: شعار الجامعة
- `facultyLogoUrl`: شعار الكلية
- `logoSize`: حجم الشعار (40-200px)

### أحجام الخطوط
- `headerFontSize`: حجم خط الترويسة (8-24pt)
- `titleFontSize`: حجم خط العنوان (10-32pt)
- `subtitleFontSize`: حجم خط العنوان الفرعي (8-24pt)
- `cellContentFontSize`: حجم خط محتوى الخلايا (6-18pt)
- `footerFontSize`: حجم خط التذييل (6-16pt)

### تنسيق الجداول
- `cellPadding`: المسافة الداخلية للخلايا (0-20px)
- `lineHeight`: ارتفاع السطر (1-3)
- `marginBetweenLines`: المسافة بين الأسطر (0-10px)
- `tableCellAlignment`: محاذاة محتوى الخلايا (left/center/right)
- `tableBorderWidth`: عرض حدود الجدول (0-5px)
- `tableBorderColor`: لون حدود الجدول

### هوامش الصفحة
- `pageMarginTop`: الهامش العلوي (0-50mm)
- `pageMarginBottom`: الهامش السفلي (0-50mm)
- `pageMarginLeft`: الهامش الأيسر (0-50mm)
- `pageMarginRight`: الهامش الأيمن (0-50mm)
- `pageSize`: حجم الصفحة (A4/A3/Letter/Legal)

### إعدادات إضافية
- `showPageNumbers`: إظهار أرقام الصفحات
- `showPrintDate`: إظهار تاريخ الطباعة
- `watermarkText`: نص العلامة المائية
- `watermarkOpacity`: شفافية العلامة المائية (0-1)

## 🔄 كيفية الاستخدام

### في المكونات

```typescript
import { usePrintSettings, createPrintOptions } from '../hooks/usePrintSettings';
import { printContent } from '../utils/printUtils';

function MyComponent() {
  const { settings } = usePrintSettings();
  
  const handlePrint = () => {
    const htmlContent = generateMyContent();
    const options = createPrintOptions(
      'عنوان المستند',
      settings,
      { 
        orientation: 'landscape',
        asPDF: true 
      }
    );
    
    printContent(htmlContent, options);
  };
  
  return <button onClick={handlePrint}>طباعة</button>;
}
```

### بدون Hooks

```typescript
import { getPrintSettingsWithDefaults } from '../hooks/usePrintSettings';
import { printContent } from '../utils/printUtils';

async function printDocument() {
  const settings = await getPrintSettingsWithDefaults();
  const options = {
    ...settings,
    title: 'عنوان المستند',
    orientation: 'portrait',
    asPDF: false
  };
  
  printContent(htmlContent, options);
}
```

## 📝 الصفحات التي تحتاج تحديث

لتطبيق النظام الجديد على الصفحات الموجودة:

### 1. Schedule.tsx
- استبدال الإعدادات المحلية بـ `usePrintSettings()`
- استخدام `createPrintOptions()` عند الطباعة

### 2. GroupTimetables.tsx
- استبدال الإعدادات المحلية بـ `usePrintSettings()`
- تمرير جميع الإعدادات لـ `generateFullDocument()`

### 3. GroupSchedules.tsx
- استخدام Hook الموحد
- إزالة CSS المكرر

### 4. ProfessorWorkload.tsx
- استخدام Hook الموحد
- تطبيق الإعدادات على جميع التقارير

### 5. AvailableRooms.tsx
- استخدام Hook الموحد
- تطبيق الإعدادات على الإعلانات

## 🎯 الفوائد

### للمطورين:
- كود موحد ومنظم
- Type safety كامل
- سهولة الصيانة
- إعادة استخدام الكود

### للمستخدمين:
- تحكم كامل في التنسيق
- معاينة مباشرة
- واجهة سهلة الاستخدام
- نتائج طباعة احترافية

### للنظام:
- تسجيل في Audit Log
- إدارة ذكية للملفات
- معالجة أخطاء محسّنة
- أداء محسّن

## 🚀 الخطوات التالية

### مرحلة قصيرة المدى:
1. ✅ تحديث `src/types/shared.ts`
2. ✅ إنشاء `src/hooks/usePrintSettings.ts`
3. ✅ تحديث `src/utils/printUtils.ts`
4. ✅ إنشاء `src/pages/PrintSettingsNew.tsx`
5. ✅ تحديث `electron/main.js`
6. ⏳ تحديث الصفحات المستهلكة
7. ⏳ اختبار شامل

### مرحلة متوسطة المدى:
- إضافة قوالب طباعة محددة مسبقاً
- دعم export/import للإعدادات
- إضافة ترويسة/تذييل مخصصة متقدمة
- دعم طباعة متعددة الصفحات

### مرحلة طويلة المدى:
- محرر WYSIWYG للقوالب
- مكتبة قوالب جاهزة
- دعم طباعة دفعية
- تكامل مع خدمات الطباعة السحابية

## 📚 المراجع

- [html2pdf.js Documentation](https://github.com/eKoopmans/html2pdf.js)
- [Material-UI Components](https://mui.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Hooks](https://react.dev/reference/react)

## 🐛 معالجة المشاكل

### المشكلة: الطباعة غير موسطة
**الحل:** تأكد من تطبيق `tableCellAlignment` في CSS

### المشكلة: الشعارات لا تظهر
**الحل:** تحقق من تحويل الشعارات إلى data URLs

### المشكلة: PDF فارغ
**الحل:** تأكد من تحميل html2pdf.js بشكل صحيح

### المشكلة: الإعدادات لا تُحفظ
**الحل:** تحقق من صلاحيات الكتابة في userData folder

## 👨‍💻 المطور

د. علي حسين  
hussain-ali@univ-eloued.dz

## 📅 تاريخ التحديث

5 نوفمبر 2025

---

**ملاحظة:** هذا المستند يوثق التحسينات المنفذة. للحصول على أحدث المعلومات، راجع الكود المصدري.
