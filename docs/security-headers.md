# توثيق ترويسات الأمان ومحيط HTTP (Security Headers & HTTP Perimeter)

> **المبدأ الحاكم:** تقوية المحيط الخارجي للخادم دون المساس بأي استعلام أو سلوك وظيفي للأعمال.
> تخضع كافة طبقات الحماية لمتغير البيئة `FEATURE_HTTP_HARDENING=true` مع إمكانية التعطيل الفوري للرجوع.

---

## 1. ترويسات الأمان (HTTP Security Headers)

تم ضبط الترويسات عبر مكتبة `helmet` وmiddleware مخصص لتحقيق تقييم **A+** على أدوات الفحص الأمنية:

| الترويسة (Header) | القيمة المضبوطة | السبب والهدف الأمني (Security Rationale) |
| :--- | :--- | :--- |
| **`Content-Security-Policy-Report-Only`** | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' ...; frame-ancestors 'none'; object-src 'none'` | **تطبيق سياسة عدم الكسر (Red Line 1):** تعمل بصيغة Report-Only لمدة أسبوع كامل لمراقبة سلوك التطبيق والمكتبات الخارجية قبل الانتقال للفرض التام. |
| **`X-Frame-Options`** | `DENY` | منع تضمين صفحات النظام داخل أطر (`<iframe>` أو `<frame>`) لمنع هجمات سرقة النقرات (Clickjacking). |
| **`Strict-Transport-Security (HSTS)`** | `max-age=31536000; includeSubDomains; preload` | إجبار المتصفحات على الاتصال عبر بروتوكول HTTPS المشفر فقط لمدة عام كامل في بيئة الإنتاج لمنع هجمات تخفيض البروتوكول (SSL Stripping). |
| **`Referrer-Policy`** | `strict-origin-when-cross-origin` | حماية خصوصية المستخدمين ومنع تسريب مسارات الـ URL الداخلية عند الانتقال لروابط خارجية. |
| **`X-Content-Type-Options`** | `nosniff` | منع المتصفحات من تخمين نوع الملف (MIME-sniffing) وتنفيذ ملفات ضارة كـ JavaScript. |
| **`Permissions-Policy`** | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | تعطيل الوصول لكافة أجهزة واستشعارات العتاد غير المطلوبة في نظام الجداول الجامعية. |

---

## 2. سياسة مشاركة الموارد عبر الأصول (CORS Whitelist)

تم استبدال `cors()` المفتوح بقائمة بيضاء صارمة ومحددة:
- **الأصول المسموحة افتراضيًا:**
  - `https://djadwal.onrender.com` (بيئة الإنتاج)
  - `http://localhost:3001` (خادم الـ API المحلي)
  - `http://localhost:5173` (خادم تطوير Vite)
  - `http://localhost:5000` و `http://localhost:5050` (بيئات Staging و Docker)
  - أي نطاقات إضافية يتم تمريرها عبر `ALLOWED_ORIGINS` أو `CORS_ORIGIN`.
- **الطلبات بلا أصل (No-Origin):** يُسمح بها لتطبيقات Electron وتطبيقات الهاتف والاستدعاءات الداخلية (`curl`, `healthcheck`).
- **الأصول المجهولة:** يتم رفضها فورًا برمز `403 Forbidden` (`CORS_FORBIDDEN`).
- **`credentials: true`**: للسماح بإرسال واستقبال الكوكيز المؤمنة.
- **`maxAge: 86400` (24 ساعة)**: تخزين مسبق لطلبات `OPTIONS` (Preflight Caching) لخفض استهلاك موارد الشبكة.

---

## 3. تحديد معدل الطلبات (Two-Tier Rate Limiting)

تم تقسيم حدود الطلبات إلى طبقتين لمنع هجمات حجب الخدمة والتخمين:

1. **الطبقة العامة (General Tier):**
   - **الحد:** 300 طلب لكل دقيقة لكل عنوان IP.
   - **النطاق:** كافة مسارات الخادم العامة.
   - **الاستجابة عند التجاوز:** `429 Too Many Requests` مع رسالة عربية توضيحية.

2. **الطبقة الحساسة (Sensitive Tier):**
   - **الحد:** 10 طلبات لكل دقيقة لكل عنوان IP.
   - **النطاق:** مسارات المصادقة `/api/auth/*` وتوليد الـ PDF المستهلك للموارد `/api/generate-pdf`.
   - **الاستجابة عند التجاوز:** `429 Too Many Requests` تطلب الانتظار لمدة دقيقة كاملة.

---

## 4. حدود الحمولات وحجم الملفات (Payload Limits)

تم تقليص الحدود القديمة (50MB) لمنع استنزاف ذاكرة الخادم (RAM Exhaustion):
- **حجم أجسام JSON:** أقصى حد **256KB** (كافٍ تماماً لكافة عمليات الجداول والتسجيل).
- **حجم البيانات المرمزة (URL-encoded):** أقصى حد **256KB**.
- **رفع الملفات (Multer):** أقصى حد **5MB** مع فحص نوع الامتداد للصور.
- **معالج الأخطاء الموحد:** يتم التقاط `entity.too.large` و `LIMIT_FILE_SIZE` وإرجاع رمز `413 Payload Too Large` برسالة واضحة.

---

## 5. الحماية المزدوجة ضد التزوير (Double-Submit CSRF)

- يرسل الخادم كوكي `csrf_token` غير مشفرة (قابلة للقراءة من JavaScript) بخصائص `SameSite=Lax; Path=/`.
- يقوم عميل الويب (`src/api/webClient.ts`) بقراءة الكوكي تلقائيًا وإرسالها في ترويسة `x-csrf-token` لكافة العمليات المعدلة للحالة (`POST`, `PUT`, `DELETE`, `PATCH`).
- يتحقق الـ Middleware من تطابق القيمة بين الكوكي والترويسة، ويرفض أي طلب غير مطابق برمز `403 Forbidden`.
- **المسارات المستثناة:** مسار callback الخاص بـ OAuth (`/api/email/oauth2callback`) والمسار العام `/api/status`.

---

## 6. تأمين كوكيز الجلسات (Hardened Session Cookies)

- **في بيئة الإنتاج:** يتم إصدار كوكي الجلسة بالبادئة المقيدة `__Host-token` بخصائص:
  - `HttpOnly: true` (حماية من XSS)
  - `Secure: true` (إرسال عبر HTTPS فقط)
  - `SameSite: Strict` (حماية من هجمات CSRF)
  - `Path: /` (مقيدة بأصل النطاق)
- **مسار الدعم المؤقت (Red Line 2):**
  - تفعيل `LEGACY_COOKIE_FALLBACK=true` لدعم الكوكي السابقة `token` لمدة إصدار كامل لضمان بقاء المستخدمين الحاليين في جلساتهم دون أي تسجيل خروج مفاجئ.
