# 📘 دليل إعداد Djadwal بعد التثبيت

## 🚀 خطوات الإعداد الأولى

### 1. تشغيل التطبيق لأول مرة

عند تشغيل التطبيق لأول مرة، ستظهر لك صفحة **إعدادات قاعدة البيانات** تلقائياً.

### 2. اختيار نوع قاعدة البيانات

لديك خياران:

#### **الخيار 1: Neon PostgreSQL (موصى به للإنتاج)**

✅ **المزايا:**
- قاعدة بيانات سحابية serverless
- أداء عالي
- نسخ احتياطي تلقائي
- لا حاجة لإدارة الخادم

📝 **الخطوات:**
1. ✅ فعّل خيار **"استخدام Neon PostgreSQL"**
2. 📋 الصق **Neon Connection String** في الحقل المخصص
3. 💾 اضغط **"حفظ الإعدادات"**
4. 🔄 أعد تشغيل التطبيق

**مثال على Connection String:**
```
postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/Djadwal?sslmode=require
```

#### **الخيار 2: SQLite Cloud (للنسخ الاحتياطي أو التطوير)**

📝 **الخطوات:**
1. ✅ فعّل خيار **"استخدام SQLite Cloud"**
2. أدخل البيانات التالية:
   - **اسم المستخدم** (Username)
   - **كلمة المرور** (Password)
   - **Host** (مثال: example.sqlite.cloud)
   - **Port** (افتراضي: 8860)
   - **اسم قاعدة البيانات** (افتراضي: Djadwal)
3. 💾 اضغط **"حفظ الإعدادات"**
4. 🔄 أعد تشغيل التطبيق

---

## 📂 مواقع ملفات الإعدادات

### Windows
```
C:\Users\<YourUsername>\AppData\Roaming\djadwal_neon\config.json
```

### macOS
```
~/Library/Application Support/djadwal_neon/config.json
```

### Linux
```
~/.config/djadwal_neon/config.json
```

---

## 🔧 التعديل اليدوي للإعدادات

إذا كنت تفضل تعديل الإعدادات يدوياً:

1. أغلق التطبيق تماماً
2. افتح ملف `config.json` من المسار أعلاه
3. عدّل الإعدادات حسب الحاجة
4. احفظ الملف
5. أعد تشغيل التطبيق

**مثال على محتوى الملف:**
```json
{
  "database": {
    "useNeon": true,
    "neonConnectionString": "postgresql://...",
    "useSQLiteCloud": false,
    "sqliteCloud": {
      "username": "",
      "password": "",
      "host": "",
      "port": 8860,
      "database": "Djadwal"
    }
  },
  "app": {
    "language": "ar",
    "theme": "light"
  }
}
```

---

## ❓ الأسئلة الشائعة

### **س: كيف أحصل على Neon Connection String؟**

**ج:**
1. سجّل دخولك في [Neon Console](https://console.neon.tech)
2. اختر مشروعك (Project)
3. اذهب إلى **Dashboard** → **Connection Details**
4. انسخ **Connection String** الكامل
5. تأكد من وجود `?sslmode=require` في النهاية

---

### **س: التطبيق لا يتصل بقاعدة البيانات؟**

**ج:** تحقق من:
- ✅ صحة Connection String
- ✅ وجود اتصال بالإنترنت
- ✅ أن حساب Neon/SQLiteCloud نشط
- ✅ السماح للتطبيق في Firewall

---

### **س: كيف أغير قاعدة البيانات من Neon إلى SQLite Cloud؟**

**ج:**
1. أغلق التطبيق
2. احذف ملف `config.json`
3. أعد تشغيل التطبيق
4. اختر الإعدادات الجديدة

---

### **س: أين أجد مسار ملف الإعدادات بالضبط؟**

**ج:**
- افتح التطبيق
- اذهب لصفحة **إعدادات قاعدة البيانات**
- المسار مُعروض في المربع الأزرق في الأعلى

---

## 📞 الدعم الفني

إذا واجهت أي مشكلة:

1. **تحقق من الـ Logs:**
   - Windows: `C:\Users\<YourUsername>\AppData\Roaming\djadwal_neon\logs`
   - افتح DevTools في التطبيق (Ctrl+Shift+I)

2. **أعد تثبيت التطبيق** إذا استمرت المشكلة

3. **اتصل بالدعم الفني** مع إرفاق:
   - نسخة التطبيق
   - نوع نظام التشغيل
   - رسالة الخطأ (Screenshot)

---

## ✅ نصائح الأمان

- 🔒 لا تشارك Connection String مع أحد
- 🔐 استخدم كلمة مرور قوية لقاعدة البيانات
- 💾 احتفظ بنسخة احتياطية من البيانات بشكل دوري
- 🔄 غيّر كلمة المرور بانتظام

---

**تم إعداد هذا الدليل بواسطة:** Ali Hussain  
**تاريخ التحديث:** 26.10.2025  
**نسخة التطبيق:** 26.10.2025.Neon
