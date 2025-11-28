# إصلاح طباعة جدول Schedule.tsx

## المشاكل التي تم حلها

### 1. إعدادات الطباعة لا تُطبق
**المشكلة**: كانت الصفحة تستخدم `window.dataUtils.getPrintSettings()` مباشرة بدلاً من استخدام الـ hook الموحد.

**الحل**:
- إضافة استيراد `usePrintSettings` و `createPrintOptions`
- استخدام `const { settings: printSettingsHook } = usePrintSettings();`
- استبدال جميع مراجع `printSettings` بـ `printSettingsHook`

### 2. تداخل في الخلايا الفرعية ورأس الجدول
**المشكلة**: كان `vertical-align: middle` يسبب تداخل المحتوى في الخلايا.

**الحل**:
```css
th, td {
  vertical-align: top;  /* بدلاً من middle */
  line-height: ${lineHeight};
  padding: ${cellPadding}px;
}
```

### 3. عدم تطبيق إعدادات الحدود
**المشكلة**: كانت الحدود ثابتة `1px solid #ccc`.

**الحل**:
```css
th, td {
  border: ${tableBorderWidth}px solid ${tableBorderColor};
}
```

## التغييرات المنفذة

### 1. الاستيرادات
```typescript
import { usePrintSettings, createPrintOptions } from '../hooks/usePrintSettings';
```

### 2. استخدام الـ Hook
```typescript
const { settings: printSettingsHook } = usePrintSettings();
```

### 3. تحديث دالتي التصدير
تم تحديث كلا من:
- `exportToPDF()`
- `exportToPDFWithoutTemporaryProfessors()`

لاستخدام الإعدادات من الـ hook:
```typescript
const headerFontSize = printSettingsHook.headerFontSize || 16;
const titleFontSize = printSettingsHook.titleFontSize || 16;
const subtitleFontSize = printSettingsHook.subtitleFontSize || 14;
const cellContentFontSize = printSettingsHook.cellContentFontSize || 10;
const logoSize = printSettingsHook.logoSize || 80;
const cellPadding = printSettingsHook.cellPadding || 3;
const lineHeight = printSettingsHook.lineHeight || 1.2;
const marginBetweenLines = printSettingsHook.marginBetweenLines || 2;
const tableCellAlignment = printSettingsHook.tableCellAlignment || 'center';
const tableBorderWidth = printSettingsHook.tableBorderWidth || 1;
const tableBorderColor = printSettingsHook.tableBorderColor || '#000000';
```

### 4. تحديث CSS الجدول
```css
th, td {
  border: ${tableBorderWidth}px solid ${tableBorderColor};
  padding: ${cellPadding}px;
  text-align: ${tableCellAlignment} !important;
  font-size: ${cellContentFontSize}px;
  vertical-align: top;  /* إصلاح التداخل */
  line-height: ${lineHeight};
}

.course-group-info {
  margin-bottom: ${marginBetweenLines}px;
  line-height: ${lineHeight};
}

.professor-room-info {
  line-height: ${lineHeight};
}
```

### 5. استخدام createPrintOptions
```typescript
const printOptions = createPrintOptions(
  `التوزيع الزمني - ${selectedSpecialization}`,
  printSettingsHook,
  {
    orientation: 'landscape',
    asPDF: true
  }
);
printContent(htmlContent, printOptions);
```

## النتيجة

الآن عند تغيير إعدادات الطباعة في صفحة **إعدادات الطباعة**:
- ✅ تُطبق جميع الإعدادات على جدول Schedule
- ✅ لا يوجد تداخل في الخلايا
- ✅ الحدود تستخدم العرض واللون المحددين
- ✅ المحاذاة تعمل بشكل صحيح
- ✅ الخطوط بالأحجام الصحيحة
- ✅ الهوامش والمسافات صحيحة

## الاختبار

1. افتح **إعدادات الطباعة**
2. غيّر أي إعداد (مثل حجم الخط، لون الحدود، المحاذاة)
3. احفظ الإعدادات
4. اذهب إلى صفحة **الجدول الزمني**
5. اضغط على **تصدير PDF**
6. تحقق من تطبيق الإعدادات الجديدة

---

**تاريخ الإصلاح**: 5 نوفمبر 2025
