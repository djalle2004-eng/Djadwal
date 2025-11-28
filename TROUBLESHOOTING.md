# 🔧 دليل حل المشاكل - Djadwal

## ❌ خطأ: Timeout في الاتصال بقاعدة البيانات

### **الأعراض:**
```
فشل الاتصال بقاعدة البيانات: timeout expired
Error: No handler registered for 'login'
```

---

## ✅ **الحلول:**

### **1. تحديث Connection String**

#### **المشكلة:**
Connection string يحتوي على `channel_binding=require` الذي قد يسبب timeout.

#### **الحل:**
افتح ملف الإعدادات:
```
C:\Users\Ali\AppData\Roaming\djadwal_neon\config.json
```

**قبل:**
```json
{
  "database": {
    "useNeon": true,
    "neonConnectionString": "postgresql://user:pass@host/db?sslmode=require&channel_binding=require"
  }
}
```

**بعد:** (احذف `&channel_binding=require`)
```json
{
  "database": {
    "useNeon": true,
    "neonConnectionString": "postgresql://user:pass@host/db?sslmode=require"
  }
}
```

---

### **2. التحقق من الاتصال بالإنترنت**

#### **الاختبار:**
```powershell
# في PowerShell
Test-NetConnection -ComputerName ep-spring-bread-ad44ylaf-pooler.c-2.us-east-1.aws.neon.tech -Port 5432
```

**النتيجة المتوقعة:**
```
TcpTestSucceeded : True
```

إذا كانت `False`:
- ✅ تحقق من Firewall
- ✅ تحقق من Antivirus
- ✅ تحقق من اتصال الإنترنت

---

### **3. تفعيل IP في Neon Dashboard**

1. اذهب إلى [Neon Console](https://console.neon.tech)
2. اختر مشروعك
3. اذهب إلى **Settings** → **IP Allow**
4. تأكد من:
   - ✅ إما تفعيل **Allow all IPs** مؤقتاً
   - ✅ أو إضافة IP الخاص بك

**للحصول على IP الخاص بك:**
```powershell
(Invoke-WebRequest -Uri "https://api.ipify.org").Content
```

---

### **4. استخدام Direct Connection بدلاً من Pooler**

#### **Connection String الحالي (Pooler):**
```
postgresql://user:pass@ep-xxx-pooler.c-2.us-east-1.aws.neon.tech/db
```

#### **جرب Direct Connection:**
```
postgresql://user:pass@ep-xxx.c-2.us-east-1.aws.neon.tech/db?sslmode=require
```

**الفرق:** احذف `-pooler` من الـ host

---

### **5. استخدام SQLite Cloud كبديل مؤقت**

إذا استمرت مشكلة Neon:

```json
{
  "database": {
    "useNeon": false,
    "neonConnectionString": "",
    "useSQLiteCloud": true,
    "sqliteCloud": {
      "username": "apikey",
      "password": "YOUR_API_KEY",
      "host": "cjh4w9vank.g4.sqlite.cloud",
      "port": 8860,
      "database": "Djadwal"
    }
  }
}
```

---

## 🔍 **فحص الـ Logs بالتفصيل**

### **1. افتح التطبيق**
```
شغّل Djadwal
```

### **2. افتح DevTools**
```
اضغط: Ctrl+Shift+I
```

### **3. اقرأ Console**
ابحث عن:

**✅ نجح:**
```javascript
✅ Neon connection established successfully
```

**❌ فشل:**
```javascript
❌ Database connection failed (Attempt 1/4): Connection timeout after 30 seconds
⏳ Retrying in 2 seconds...
```

---

## 📞 **إذا استمرت المشكلة**

### **معلومات مطلوبة:**

1. **Connection String** (بدون password):
   ```
   postgresql://user:***@host/db?params
   ```

2. **نتيجة Test-NetConnection**

3. **Screenshot من Console Logs**

4. **نسخة Windows:**
   ```powershell
   winver
   ```

5. **هل Firewall/Antivirus مفعّل؟**

---

## 🎯 **الحل السريع (Quick Fix):**

```json
// في config.json
{
  "database": {
    "useNeon": true,
    "neonConnectionString": "postgresql://neondb_owner:npg_KHo8vMgkc7Py@ep-spring-bread-ad44ylaf.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
  }
}
```

**التغييرات:**
1. ✅ حذف `&channel_binding=require`
2. ✅ حذف `-pooler` من الـ host
3. ✅ إعادة تشغيل التطبيق

---

**آخر تحديث:** 27.10.2025  
**النسخة:** 26.10.2025.Neon
