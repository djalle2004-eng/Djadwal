# التفويض على الخادم (RBAC) وسلامة سجل التدقيق غير القابل للعبث
## وثيقة المعمارية والأمان — P5 (Server Authorization & Tamper-Evident Audit Chain)

> **النظام:** Djadwal — نظام إدارة ومتابعة جداول التوقيت والمهام البيداغوجية  
> **المبدأ الحاكم:** «لا شيء يُكسر، ولا شيء يُحذف، ولا شيء يُوقف».  
> **معالجة الملاحظات الأمنية:** SEC-07, SEC-16, DATA-03, SEC-09

---

## 1. المعمارية العامة للتفويض (Server-Side RBAC)

تم عزل منطق التحقق من الصلاحيات بالكامل داخل طبقة وسيطة مركزية تعمل بعد مصادقة الهوية (Authentication Middleware) وقبل تنفيذ معالجات المسارات (Route Handlers).

```
                      [ Client Request ]
                              │
                              ▼
                 [ Authentication Middleware ]
              (Extracts & Validates JWT Token)
                              │
                              ▼
                   [ req.user Populated ]
           (e.g., id: 45, role: 'professor')
                              │
                              ▼
            ┌────────────────────────────────────┐
            │   authorize(resource, action)      │
            └────────────────────────────────────┘
                              │
      ┌───────────────────────┴───────────────────────┐
      ▼                                               ▼
[ FEATURE_RBAC = false? ]                   [ RBAC_EXEMPTIONS match? ]
      │ (Pass-through)                                │ (Emergency Bypass)
      │                                               │
      └───────────────────────┬───────────────────────┘
                              ▼
              [ server/authz/matrix.js Check ]
                              │
               ├── Role Normalization (lowercase)
               ├── Role Promotion Guard (Non-admin cannot elevate roles)
               └── Matrix Lookup: matrix[role][resource].includes(action)
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
      [ Allow: true ]                     [ Allow: false ]
            │                                   │
            ▼                                   ▼
    [ Route Handler ]                   [ 403 Forbidden ]
                                    { error: 'FORBIDDEN' }
```

### 1.1 مصفوفة الصلاحيات المركزية (`server/authz/matrix.js`)

تُعرّف المصفوفة الأدوار المعتمدة (`admin`, `schedule_manager`, `staff`, `professor`) والعمليات المسموح بها لكل مورد:

| المورد (Resource) | العمليات المتاحة | `admin` | `schedule_manager` | `staff` | `professor` |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `users` | view, create, update, delete, admin | ✅ الكل | ❌ | ❌ | ❌ (تعديل النفس فقط) |
| `departments` | view, create, update, delete | ✅ الكل | view فقط | view فقط | view فقط |
| `courses` | view, create, update, delete | ✅ الكل | ✅ الكل | view فقط | view فقط |
| `professors` | view, create, update, delete | ✅ الكل | ✅ الكل | view فقط | view فقط |
| `rooms` | view, create, update, delete | ✅ الكل | ✅ الكل | view فقط | view فقط |
| `groups` | view, create, update, delete | ✅ الكل | ✅ الكل | view فقط | view فقط |
| `sessions` | view, create, update, delete | ✅ الكل | ✅ الكل | view فقط | view فقط |
| `academic_years` | view, create, update, delete | ✅ الكل | view فقط | view فقط | view فقط |
| `semesters` | view, create, update, delete | ✅ الكل | view فقط | view فقط | view فقط |
| `backup` | export, import | ✅ الكل | ❌ | ❌ | ❌ |
| `app_config` | view, update | ✅ الكل | view فقط | view فقط | view فقط |
| `sandbox_snapshots` | view, create, delete | ✅ الكل | ✅ الكل | view فقط | ❌ |
| `audit_logs` | view, create, export, admin | ✅ الكل | create فقط | create فقط | ❌ |
| `email` | view, create, admin | ✅ الكل | view, create | view فقط | ❌ |
| `print_settings` | view, update | ✅ الكل | view, update | view فقط | view فقط |

> **حماية الأدوار غير المعرّفة (Default-Deny):** أي دور غير مسجل في المصفوفة يتم تحويله تلقائيًا إلى `'unknown'`، ويتم تسجيل تنبيه فوري `[RBAC-ALERT] Unrecognized role encountered: "..."` ورفض الطلب برمز `403`.

---

## 2. سلامة سجل التدقيق وسلسلة التجزئة المشفرة (Audit Hash Chain)

### 2.1 عزل الهوية ومنع تزوير المؤلف (Attribution Integrity)
- **السلوك السابق الثغري:** كان الخادم يقبل `x-user-id` و `body.currentUserId` كمعرّف للكاتب في التدقيق، مما يسمح لأي مستخدم بتزوير هوية الفاعل.
- **الحل المعتمد:**
  1. يُشتق معرّف الفاعل (`user_id`) **حصرًا** من `req.user.id` المشتق من توكن JWT الموقع مشفرًا.
  2. لا تُحذف ترويسة العميل `x-user-id` من `webClient.ts` لتفادي أي كسر في الواجهة، ولكن الخادم يحفظها كحقل معلوماتي منفصل `claimed_by: "x-user-id:..."` لأغراض الفحص الجنائي دون استخدامها في إسناد المسؤولية.

### 2.2 سلسلة التجزئة المتصلة (Cryptographic Hash Chain)
كل سجل تدقيق يرتبط بالسجل السابق برمز تجزئة SHA-256 قطعي:

$$\text{row\_hash}_i = \text{SHA256}(\text{prev\_hash}_i \parallel \text{user\_id} \parallel \text{action} \parallel \text{entity\_type} \parallel \text{entity\_id} \parallel \text{details} \parallel \text{ip\_address} \parallel \text{created\_at} \parallel \text{claimed\_by})$$

حيث:
- السجل الأول يبدأ بـ Genesis Hash: `0000000000000000000000000000000000000000000000000000000000000000`
- $\text{prev\_hash}_i = \text{row\_hash}_{i-1}$
- أي تعديل، حذف، أو تلاعب في أي سجل يؤدي إلى كسر السلسلة فورًا واكتشافه بواسطة محرك الفحص.

### 2.3 الصمود أمام انقطاع قاعدة البيانات (Resilient In-Memory Buffer)
في حال تعذر الاتصال المؤقت بقاعدة البيانات:
1. تُخزن أحداث التدقيق في مخزن دائري آمن في الذاكرة (`inMemoryAuditBuffer`) بحد أقصى 1000 سجل.
2. يتم إرسال تنبيه فوري عبر الخطاف البرمجي `METRICS_SINK`.
3. تُفرَّغ السجلات المتراكمة تلقائيًا عند عودة الاتصال بقاعدة البيانات مع الحفاظ على تسلسل التجزئة.

---

## 3. تصدير سجلات التدقيق بروابط موقعة قصيرة الأجل (Signed URLs)

- **المسار:** `POST /api/audit-logs/export-url`
- **الصلاحية:** مقيدة بدور `admin` حصرًا.
- **الآلية:**
  1. يقوم الخادم بتوليد رابط تنزيل يحتوي على طابع زمني للانتهاء (صلاحية 5 دقائق = 300 ثانية).
  2. يتم توقيع المعاملات باستخدام HMAC-SHA256 والمفتاح السري للخادم.
  3. يدعم التصدير صيغتين:
     - `jsonl`: Newline-Delimited JSON (الافتراضية، ومناسبة للأرشفة غير القابلة للتغيير).
     - `csv`: جدول بيانات متوافق مع أدوات التحليل وإكسل.
  4. يتضمن رأس الاستجابة `x-audit-chain-status: verified` لتأكيد سلامة السلسلة قبل التصدير.

---

## 4. سكربت التحقق الدوري (`scripts/verify-audit-chain.ts`)

يمكن تشغيل سكربت التحقق كأمر CLI أو مهمة دورية (Cron Job / Scheduled Task):

```bash
# تشغيل التحقق
npx tsx scripts/verify-audit-chain.ts

# النتيجة المتوقعة:
# ✅ AUDIT LOG CHAIN FULLY VERIFIED
# 📊 Total Records Verified: 135
# 🔒 Chain Head Hash: 38a0a23a...
# 🛡️ Status: All rows cryptographically verified & append-only intact.
```

---

## 5. مخطط التحصين في قاعدة البيانات (Staging DB Hardening Script)

> **تحذير:** تطبيقًا للميثاق («لا تُفعل قيود REVOKE على قاعدة الإنتاج قبل التحقق في staging أن كل الكتابات لا تزال تعمل»)، يُنفَّذ السكربت التالي على بيئة Staging أولاً:

```sql
-- ====================================================================
-- سكربت تقييد صلاحيات تطبيق Djadwal على جدول audit_log (Staging Verification)
-- ====================================================================

-- 1. التأكد من وجود أعمدة التحصين (تلقائي بواسطة ensureAuditLogHardening)
-- ALTER TABLE audit_log ADD COLUMN prev_hash TEXT;
-- ALTER TABLE audit_log ADD COLUMN row_hash TEXT;
-- ALTER TABLE audit_log ADD COLUMN claimed_by TEXT;

-- 2. في بيئات PostgreSQL / MySQL / SQLite ذات الصلاحيات المتعددة:
-- منح دور التطبيق صلاحيات القراءة والإضافة فقط على جدول التدقيق
GRANT SELECT, INSERT ON audit_log TO djadwal_app_user;

-- سحب أي صلاحية لتعديل أو حذف سجلات التدقيق
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM djadwal_app_user;

-- 3. في بيئة Turso / SQLite المحمية بواسطة Embedded Replica:
-- يتم ضمان الحظر على مستوى التطبيق عبر عدم تضمين أي استعلام UPDATE أو DELETE
-- في الشيفرة البرمجية باستثناء سكربتات الصيانة الطارئة المصادق عليها.
```

---

## 6. خطة التراجع السريع عند الطوارئ (Rollback Plan)

| السيناريو | آلية التراجع | زمن الاستجابة |
| :--- | :--- | :--- |
| عطل طارئ في سياسة تفويض مسار معين | إضافة المسار إلى متغير البيئة `RBAC_EXEMPTIONS=/api/troubled-route` وإعادة تشغيل الخادم دون إعادة بناء الكود | دقيقة واحدة |
| عطل شامل في نظام التفويض بالكامل | تعيين متغير البيئة `FEATURE_RBAC=false` | فوري |
| عطل في احتساب سلسلة التجزئة | تعيين متغير البيئة `FEATURE_AUDIT_HASH_CHAIN=false` | فوري |
| فشل في اتصال تخزين التدقيق | المخزن المؤقت في الذاكرة يحفظ حتى 1000 حدث تلقائيًا مع تنبيه `METRICS_SINK` | تلقائي |
