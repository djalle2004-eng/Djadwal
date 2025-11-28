# حل جذري لمشكلة تداخل الخلايا الفرعية

## التحليل الجذري للمشكلة

### الأسباب الرئيسية:

1. **`table-layout: fixed`** - يجبر الجدول على عرض ثابت ويمنع التمدد الطبيعي
2. **`overflow: hidden`** - يقص المحتوى الزائد بدلاً من السماح للخلية بالتمدد
3. **`vertical-align: middle`** - يسبب تداخل المحتوى عند وجود حصص متعددة
4. **بنية HTML غير منظمة** - استخدام `session-divider` بدلاً من حاوية Flex
5. **عدم وجود فصل بصري واضح** - المسافة بين الحصص ضئيلة جداً

## الحل المطبق

### 1. إضافة إعداد جديد `sessionGap`

```typescript
// في src/types/shared.ts
sessionGap?: number;  // المسافة بين الحصص في نفس الخلية (افتراضي: 8)
```

**القيمة الافتراضية**: 8 بكسل

### 2. تحديث CSS الجدول

#### قبل:
```css
table {
  table-layout: fixed;  /* ❌ يمنع التمدد */
}
th, td {
  overflow: hidden;     /* ❌ يقص المحتوى */
  vertical-align: middle; /* ❌ يسبب تداخل */
}
```

#### بعد:
```css
table {
  table-layout: auto;   /* ✅ يسمح بالتمدد التلقائي */
}
th, td {
  overflow: visible;    /* ✅ يسمح بظهور المحتوى كاملاً */
  vertical-align: top;  /* ✅ يمنع التداخل */
}
```

### 3. استخدام Flexbox للحصص المتعددة

#### قبل:
```html
<td class="schedule-cell">
  <div class="session">حصة 1</div>
  <div class="session-divider"></div>
  <div class="session">حصة 2</div>
</td>
```

#### بعد:
```html
<td class="schedule-cell">
  <div class="sessions-container">
    <div class="session">حصة 1</div>
    <div class="session">حصة 2</div>
  </div>
</td>
```

**CSS الجديد:**
```css
.sessions-container {
  display: flex;
  flex-direction: column;
  gap: ${sessionGap}px;  /* مسافة ديناميكية */
  width: 100%;
}

.session {
  display: block;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
```

### 4. تحسين التمييز البصري

كل حصة الآن لها:
- ✅ خلفية شبه شفافة
- ✅ حدود خفيفة
- ✅ ظل خفيف
- ✅ زوايا مستديرة
- ✅ مسافة قابلة للتحكم (sessionGap)

## الملفات المحدثة

### 1. `src/types/shared.ts`
- إضافة `sessionGap?: number;`

### 2. `src/hooks/usePrintSettings.ts`
- إضافة القيمة الافتراضية: `sessionGap: 8`

### 3. `src/pages/Schedule.tsx`
**التغييرات:**
- تحميل `sessionGap` من الإعدادات
- تحديث CSS: `table-layout: auto`, `overflow: visible`, `vertical-align: top`
- إضافة `.sessions-container` مع Flexbox
- تحديث `.session` مع تصميم محسّن
- إخفاء `.session-divider` (لم تعد مطلوبة)
- تحديث بنية HTML لاستخدام `sessions-container`

### 4. `src/pages/PrintSettingsNew.tsx`
- إضافة منزلق للتحكم في `sessionGap` (0-20 بكسل)
- موجود في تبويب "تنسيق الجداول"

### 5. `electron/main.js`
- إضافة `sessionGap` إلى معالج `save-print-settings`

## كيفية الاستخدام

### 1. ضبط المسافة بين الحصص:
1. افتح **إعدادات الطباعة**
2. اذهب إلى تبويب **تنسيق الجداول**
3. اضبط منزلق **المسافة بين الحصص** (0-20 بكسل)
4. اضغط **حفظ**

### 2. معاينة النتيجة:
1. اذهب إلى **الجدول الزمني**
2. اضغط **تصدير PDF**
3. ستجد الحصص منفصلة بوضوح بدون تداخل

## المزايا

✅ **لا تداخل**: كل حصة في مساحتها الخاصة
✅ **قابل للتخصيص**: المستخدم يتحكم في المسافة
✅ **تمييز بصري واضح**: خلفية وحدود لكل حصة
✅ **تمدد تلقائي**: الخلايا تتمدد حسب المحتوى
✅ **طباعة نظيفة**: النتيجة احترافية وواضحة

## الاختبار

### سيناريو 1: خلية بحصة واحدة
- ✅ تظهر الحصة بوضوح مع تصميم محسّن

### سيناريو 2: خلية بـ 3-4 حصص
- ✅ كل حصة منفصلة بمسافة واضحة
- ✅ لا يوجد تداخل في النصوص
- ✅ الخلية تتمدد تلقائياً

### سيناريو 3: خلية بـ 6+ حصص
- ✅ جميع الحصص ظاهرة
- ✅ المسافة بينها متساوية
- ✅ لا يوجد قص للمحتوى

## التطبيق على صفحات أخرى

هذا الحل يمكن تطبيقه على:
- ✅ `Schedule.tsx` (تم)
- ⏳ `GroupTimetables.tsx` (قادم)
- ⏳ `ProfessorWorkload.tsx` (قادم)
- ⏳ أي صفحة أخرى تعرض جداول بحصص متعددة

## الخلاصة

تم حل المشكلة بشكل جذري من خلال:
1. إزالة القيود على الجدول (`fixed` → `auto`, `hidden` → `visible`)
2. استخدام Flexbox بدلاً من dividers
3. إضافة تحكم ديناميكي في المسافة
4. تحسين التمييز البصري

**النتيجة**: جداول نظيفة، واضحة، وقابلة للتخصيص بدون أي تداخل! 🎉

---

**تاريخ التطبيق**: 5 نوفمبر 2025
**الإصدار**: 7.9.2025
