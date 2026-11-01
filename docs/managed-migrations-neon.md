# التوثيق المعماري والأمني للمهمة P6: ترحيلات المخطط المُدارة والانتقال إلى Neon PostgreSQL

- **المحرك الأساسي للإنتاج (Primary Engine):** Neon Serverless PostgreSQL 16
- **محرك النسخ الاحتياطي اللحظي (Secondary Backup):** Turso Cloud (libSQL)
- **إدارة المخطط (Schema Management):** Drizzle ORM (`packages/db`)
- **حالة الخدمة (Service Uptime):** بلا توقف (Zero Downtime) وبلا تغييرات تدميرية (Zero DDL on Boot)

---

## 1. الدافع التقني والمعماري (Architectural Drivers)

1. **استنفاد سقف القراءات على Turso:**
   بلغ حجم قراءات المنصة على Turso الحد الأقصى الشهري (500M Reads) نتيجة استعلامات الجداول المكثفة، مما استدعى **التحويل الفوري لكافة استعلامات القراءة (`SELECT`) إلى Neon PostgreSQL** مع الالتزام الصارم بـ **عدم تشغيل أي قراءات ظلية (Zero Shadow Reads)** على Turso لحماية الحصة المتبقية.

2. **القضاء على DDL العشوائي عند الإقلاع (Zero DDL on Startup):**
   كانت دوال `ensureSandboxTable` و `ensureSemesterPublicColumn` و `ensureAppConfigTable` تنفذ عبارات DDL عشوائية عند كل إقلاع للخادم مما قد يسبب أعطالاً أو تضاربات. تم إيقافها تماماً ونقل المخطط إلى ترحيلات مُرقّمة ومُحققة مشفّرة.

3. **حفظ استمرارية الخادم على استضافة Render دون منع Scale-to-Zero:**
   لتفادي سكون خادم Render (Free/Web tier) بعد 15 دقيقة خمول، تم توفير مسار نبض معزول `/api/ping` يعمل كلياً من الذاكرة دون استعلام قاعدة البيانات، مما يسمح لـ Neon بالدخول في وضع السكون التلقائي لتوفير ساعات الحوسبة (CU-hours).

---

## 2. متغيرات البيئة الجديدة وأعلام الميزات (Environment Flags)

| المتغير / العلم | النوع | القيمة الافتراضية | الوصف |
|---|---|---|---|
| `DATABASE_URL` | String (Secret) | - | رابط اتصال Neon المجمّع (Pooled Connection عبر PgBouncer) المستخدم في التطبيق اليومي. |
| `DIRECT_URL` | String (Secret) | - | رابط اتصال Neon المباشر (Direct Unpooled) المخصص حصرياً للترحيلات (`scripts/migrate.ts`) لدعم الأقفال الاستشارية. |
| `FEATURE_READ_SOURCE` | Enum (`postgres` \| `turso`) | `postgres` | يحدد مصدر توجيه كافة استعلامات `SELECT`. التبديل إلى `turso` يُعيد القراءة فوراً دون لمس الكود. |
| `FEATURE_DUAL_WRITE` | Boolean | `true` | تفعيل الكتابة المزدوجة المتوازية لجميع عمليات `INSERT`/`UPDATE`/`DELETE` إلى Turso كنسخة احتياطية حية. |

---

## 3. هندسة الترحيلات وقفل الأمان الموزع (Drizzle ORM & Advisory Lock)

### المخطط وحزمة `packages/db`
- مخطط الجداول مُعرّف بالكامل في `packages/db/src/schema.ts` ويشمل 27 جدولاً وفهارسها وقيودها.
- الترحيلات محفوظة في `packages/db/drizzle/`:
  - `0000_baseline.sql`: لقطة المخطط الأساسي المتوافق مع بيانات الإنتاج.
  - `0001_expand_safe_columns.sql`: إضافة الأعمدة الآمنة بنمط «وسّع ثم قلّص» (`is_public`, `version`, `audit_hashes`, `created_at`, `updated_at`).

### القفل الاستشاري الموزع (Distributed Advisory Lock)
لتجنب تضارب الترحيلات عند إقلاع نسختين متوازيتين من الخادم (Zero-Downtime Rolling Deployment)، تستخدم أداة `scripts/migrate.ts` القفل الاستشاري الموزع:
```sql
SELECT pg_try_advisory_lock(8847291);
```
عبر الاتصال المباشر `DIRECT_URL`. في حال كان القفل محجوزاً من نسخة أخرى، تتوقف العملية فوراً لمنع التضارب.

---

## 4. أوامر إدارة الترحيلات والبيانات (CLI Tooling)

تم دمج الأوامر في `package.json`:

```bash
# عرض حالة الترحيلات المنفذة والمعلقة
npm run db:migrate:status

# التخطيط وعرض الاستعلامات المقترحة
npm run db:migrate:plan

# المحاكاة الجافة داخل معاملة تجريبية تنتهي بـ ROLLBACK
npm run db:migrate:dry-run

# تطبيق الترحيلات المعلقة وتسجيلها في schema_migrations
npm run db:migrate:apply

# التحقق من مطابقة المخطط الفعلي للمخطط المتوقع
npm run db:migrate:verify

# استنساخ وتحقق كامل لبيانات الإنتاج من Turso إلى Neon (Topological FK Order)
npm run db:replatform

# المعالجة الخلفية التراكمية على دفعات مع نقاط حفظ
npm run db:backfill
```

---

## 5. مسار النبض المعزول لخدمة Cron الخارجي (`GET /api/ping`)

### الهدف
إبقاء خادم الويب مستيقظاً على موفري الاستضافة (مثل Render) عبر خدمة Cron Ping دورية (كل 5 إلى 10 دقائق) مع **منع إيقاظ قاعدة بيانات Neon من وضع السكون (Scale-to-Zero)** لتوفير التكاليف.

### المواصفات الفنية
- **المسار:** `GET /api/ping` و `GET /ping`
- **زمن الاستجابة:** أقل من 2ms (يُجيب مباشرة من ذاكرة Node.js V8).
- **استهلاك قاعدة البيانات:** 0 استعلامات، 0 اتصالات بمجمّع الاتصال (Zero Database Touch).
- **الاستجابة:**
  ```json
  HTTP/1.1 200 OK
  Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
  Content-Type: application/json

  {
    "status": "ok",
    "timestamp": "2026-11-01T15:50:00.000Z"
  }
  ```

---

## 6. إجراءات الطوارئ وخطة الرجوع (Disaster Recovery & Rollback)

إذا طرأ أي عطل على محرك Neon أو شبكة الاتصال السحابي:

1. **الرجوع الفوري للقراءة من Turso:**
   قم بتغيير متغير البيئة في لوحة الخادم:
   ```env
   FEATURE_READ_SOURCE=turso
   ```
   *يعود النظام فوراً لقراءة كل البيانات من Turso دون توقف.*

2. **سلامة البيانات المتطابقة:**
   نظراً لأن الكتابة المزدوجة كانت مفعّلة (`FEATURE_DUAL_WRITE=true`)، فإن Turso يحتوي بالفعل على أحدث البيانات المحدثة المتزامنة لحظياً، ويتم تسجيل أي تباعد طفيف في جدول `reconciliation_diffs` للمطابقة.

