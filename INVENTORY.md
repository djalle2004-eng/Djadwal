# 📋 تقرير جرد نظام Djadwal الحي (INVENTORY.md)

**التاريخ:** 11 أكتوبر 2026  
**النظام:** Djadwal Production (Vite 1.3 / React 18 / Express 5 / Electron / Turso LibSQL)  
**الغرض:** توثيق شامل للأسطح البرمجية الحية (APIs، الجداول والبيانات، واجهات المستخدم) كخط أساس قبل أي تعديل معماري.

---

## 1. مسارات واجهة برمجة التطبيقات (API Endpoints Inventory)

المجموع الكلي: **77 مسارًا نشطًا** (75 مسارًا عبر `server/routes.js` + مساران عبر `server/server.js`).

| # | المسار (Path) | الطريقة (Method) | المصدر | الوصف والتوقيع (Signature / Parameters) |
|---|---|---|---|---|
| 1 | `/api/status` | GET | `server.js:101` | فحص صحة الخادم وحالة خدمة PDF |
| 2 | `/api/generate-pdf` | POST | `server.js:36` | توليد ملف PDF عبر Puppeteer (`html`, `options`) |
| 3 | `/api/auth/signup` | POST | `routes.js:79` | إنشاء حساب في البوابة (`username`, `email`, `password`, `full_name`) |
| 4 | `/api/auth/signin` | POST | `routes.js:126` | تسجيل دخول بوابة الأساتذة (`email`, `password`) |
| 5 | `/api/auth/signout` | POST | `routes.js:157` | تسجيل خروج ومسح ملفات تعريف الارتباط |
| 6 | `/api/auth/me` | GET | `routes.js:162` | التحقق من جلسة المستخدم الحالي واسترجاع الملف |
| 7 | `/api/auth/forgot-password` | POST | `routes.js:173` | طلب إعادة تعيين كلمة المرور عبر البريد (`email`) |
| 8 | `/api/auth/login` | POST | `routes.js:967` | تسجيل دخول المشرفين والمستخدمين الأساسيين (`username`, `password`) |
| 9 | `/api/profile` | GET | `routes.js:217` | استرجاع ملف الأستاذ الشخصي عبر التوكن |
| 10 | `/api/profile` | POST | `routes.js:233` | تحديث بيانات ملف الأستاذ (`phone`, `office`, `bio`) |
| 11 | `/api/preferences` | GET | `routes.js:272` | استرجاع تفضيلات تدريس الأستاذ |
| 12 | `/api/preferences` | POST | `routes.js:288` | حفظ وتحديث تفضيلات الأستاذ (الأيام، الفترات) |
| 13 | `/api/departments` | GET | `routes.js:327` | قائمة الأقسام الأكاديمية |
| 14 | `/api/departments` | POST | `routes.js:336` | إنشاء قسم جديد (`name`, `code`) |
| 15 | `/api/departments/:id` | PUT | `routes.js:347` | تعديل قسم (`name`, `code`) |
| 16 | `/api/departments/:id` | DELETE | `routes.js:359` | حذف قسم بمعرفه |
| 17 | `/api/professors` | GET | `routes.js:371` | قائمة جميع الأساتذة |
| 18 | `/api/professors` | POST | `routes.js:380` | إضافة أستاذ جديد (`name`, `email`, `phone`, `title`, `academic_title`) |
| 19 | `/api/professors/:id` | PUT | `routes.js:399` | تحديث بيانات أستاذ |
| 20 | `/api/professors/:id` | DELETE | `routes.js:419` | حذف أستاذ |
| 21 | `/api/rooms` | GET | `routes.js:431` | قائمة القاعات والقاعات المخصصة |
| 22 | `/api/rooms` | POST | `routes.js:440` | إضافة قاعة (`name`, `capacity`, `type`) |
| 23 | `/api/rooms/:id` | PUT | `routes.js:451` | تحديث بيانات قاعة |
| 24 | `/api/rooms/:id` | DELETE | `routes.js:463` | حذف قاعة |
| 25 | `/api/courses` | GET | `routes.js:475` | استرجاع المقاييس والمقررات |
| 26 | `/api/courses` | POST | `routes.js:484` | إنشاء مقياس جديد (`name`, `code`, `credits`, `hours`) |
| 27 | `/api/courses/:id` | PUT | `routes.js:495` | تعديل مقياس |
| 28 | `/api/courses/:id` | DELETE | `routes.js:507` | حذف مقياس |
| 29 | `/api/groups` | GET | `routes.js:519` | استرجاع الأفواج والتخصصات |
| 30 | `/api/groups` | POST | `routes.js:528` | إنشاء فوج جديد (`name`, `department_id`, `group_type`, `specialization`, `year`) |
| 31 | `/api/groups/:id` | PUT | `routes.js:542` | تحديث بيانات فوج |
| 32 | `/api/groups/:id` | DELETE | `routes.js:557` | حذف فوج |
| 33 | `/api/assignments` | GET | `routes.js:569` | استرجاع الحصص والإسنادات مع فلترة اختيارية (`academic_year`, `semester`, `specialization`) |
| 34 | `/api/assignments` | POST | `routes.js:616` | إضافة إسناد حصة (`group_id`, `course_id`, `professor_id`, `room_id`, `day_of_week`, `start_time`, `end_time`) |
| 35 | `/api/assignments/:id` | PUT | `routes.js:635` | تعديل إسناد حصة |
| 36 | `/api/assignments/:id` | DELETE | `routes.js:655` | حذف إسناد حصة |
| 37 | `/api/academic-years` | GET | `routes.js:667` | استرجاع كافة السنوات الدراسية |
| 38 | `/api/academic-years/active` | GET | `routes.js:676` | استرجاع السنة الدراسية الحالية النشطة |
| 39 | `/api/academic-years` | POST | `routes.js:685` | إضافة سنة دراسية (`year_name`, `is_current`) |
| 40 | `/api/academic-years/:id/activate` | POST | `routes.js:704` | تنشيط سنة دراسية وإلغاء تنشيط البقية |
| 41 | `/api/academic-years/:id` | DELETE | `routes.js:716` | حذف سنة دراسية |
| 42 | `/api/semesters` | GET | `routes.js:728` | استرجاع الفصول الدراسية (`academic_year_id`) |
| 43 | `/api/semesters/active` | GET | `routes.js:747` | استرجاع الفصل الدراسي النشط |
| 44 | `/api/semesters` | POST | `routes.js:766` | إضافة فصل دراسي (`academic_year_id`, `semester_name`, `start_date`, `end_date`, `is_current`, `is_public`) |
| 45 | `/api/semesters/:id` | PUT | `routes.js:785` | تحديث فصل دراسي |
| 46 | `/api/semesters/:id/activate` | POST | `routes.js:812` | تنشيط فصل دراسي |
| 47 | `/api/semesters/:id` | DELETE | `routes.js:824` | حذف فصل دراسي |
| 48 | `/api/extra-sessions` | GET | `routes.js:836` | استرجاع الحصص الإضافية والتعويضية وامتحانات المداومة |
| 49 | `/api/extra-sessions/archive` | POST | `routes.js:859` | أرشفة الحصص السابقة لتاريخ اليوم |
| 50 | `/api/extra-sessions` | POST | `routes.js:872` | إضافة حصة إضافية (`room_id`, `professor_id`, `group_id`, `course_id`, `session_date`, ...) |
| 51 | `/api/extra-sessions/:id` | PUT | `routes.js:913` | تعديل حصة إضافية |
| 52 | `/api/extra-sessions/:id` | DELETE | `routes.js:950` | حذف حصة إضافية |
| 53 | `/api/users` | GET | `routes.js:1007` | استرجاع قائمة المستخدمين المشرفين والموظفين |
| 54 | `/api/users` | POST | `routes.js:1016` | إنشاء مستخدم جديد وتشفير كلمة المرور |
| 55 | `/api/users/:id` | PUT | `routes.js:1038` | تعديل مستخدم |
| 56 | `/api/users/:id` | DELETE | `routes.js:1059` | حذف مستخدم |
| 57 | `/api/users/:id/permissions` | GET | `routes.js:1075` | استرجاع صلاحيات المستخدم المخصصة بصيغة JSON |
| 58 | `/api/users/:id/permissions` | PUT | `routes.js:1090` | حفظ وتحديث صلاحيات المستخدم |
| 59 | `/api/audit-logs` | GET | `routes.js:1110` | استرجاع سجل الأنشطة والعمليات مع التصفية (`user_id`, `action`, `entity_type`, `limit`) |
| 60 | `/api/audit-logs` | POST | `routes.js:1151` | تسجيل حدث جديد يدويًا |
| 61 | `/api/time-slots` | GET | `routes.js:1162` | الفترات الزمنية المعتمدة للحصص اليومية |
| 62 | `/api/upload-logo` | POST | `routes.js:1222` | رفع شعار الجامعة أو الكلية وتخزينه كـ Base64 Data URI |
| 63 | `/api/print-settings` | GET | `routes.js:1260` | استرجاع إعدادات رأس وتذييل جداول الطباعة |
| 64 | `/api/print-settings` | PUT | `routes.js:1299` | حفظ وتحديث إعدادات الطباعة |
| 65 | `/api/export/data` | GET | `routes.js:1336` | تصدير كامل بيانات الجداول بصيغة JSON احتياطية |
| 66 | `/api/gmail-auth-url` | GET | `routes.js:1387` | استخراج رابط مصادقة Google OAuth للمراسلة |
| 67 | `/api/email/oauth2callback` | GET | `routes.js:1419` | مسار رد الاتصال واستقبال رمز OAuth وحفظ refresh_token |
| 68 | `/api/gmail-auth-code` | POST | `routes.js:1484` | تبادل الرمز برمز التحديث وحفظه |
| 69 | `/api/gmail-auth-status` | GET | `routes.js:1516` | فحص حالة ربط وتفويض حساب Gmail |
| 70 | `/api/send-professor-schedule` | POST | `routes.js:1528` | إرسال جدول الأستاذ بصيغة PDF عبر بريد Gmail |
| 71 | `/api/debug/email-settings` | GET | `routes.js:1603` | فحص إعدادات البريد الإلكتروني المحفوظة |
| 72 | `/api/sandbox/save` | POST | `routes.js:1618` | حفظ لقطة تجريبية لحالة الجداول (Draft Snapshot) |
| 73 | `/api/sandbox/list` | GET | `routes.js:1647` | استرجاع قائمة المسودات المحفوظة |
| 74 | `/api/sandbox/load/:id` | GET | `routes.js:1660` | استرجاع بيانات مسودة تجريبية محددة |
| 75 | `/api/sandbox/:id` | DELETE | `routes.js:1682` | حذف مسودة تجريبية |
| 76 | `/api/app-config` | GET | `routes.js:1700` | استرجاع التكوين العام للتطبيق |
| 77 | `/*` (Static Fallback) | GET | `server.js:109` | توجيه كافة الطلبات الأخرى لـ `dist/index.html` (SPA Routing) |

---

## 2. جرد جداول قاعدة البيانات الحية (Turso Cloud LibSQL)

تم فحص قاعدة البيانات الإنتاجية عبر اتصال مباشر؛ الجداول وعدد السجلات الفعلية:

| # | اسم الجدول (Table Name) | السجلات الحالية (Live Rows) | دور الجدول وملاحظات السلامة |
|---|---|---|---|
| 1 | `academic_years` | 4 | السنوات الدراسية وحالة التفعيل (`is_current`) |
| 2 | `app_config` | 3 | إعدادات وتكوينات النظام الرئيسية |
| 3 | `assignments` | 4,989 | **الجدول الحرج الأكبر**: جداول الحصص والتوزيع الأسبوعي |
| 4 | `audit_log` | 29 | سجل الأنشطة والتدقيق والتعديلات مع هوية المستخدم |
| 5 | `backup_history` | 1 | تاريخ النسخ الاحتياطية المنفذة |
| 6 | `courses` | 255 | المقاييس والمقررات والوحدات التعليمية |
| 7 | `departments` | 5 | الأقسام البيداغوجية للكلية |
| 8 | `email_logs` | 17 | سجلات مراسلات جداول الأساتذة |
| 9 | `email_settings` | 1 | إعدادات Gmail OAuth2 وتوكن التحديث |
| 10 | `extra_sessions` | 475 | حصص التعويض والمداومة والامتحانات الإضافية |
| 11 | `groups` | 193 | الأفواج الطلابية والدفعات والتخصصات |
| 12 | `modules` | 0 | جدول وحدات قديم (غير مستخدم حاليًا) |
| 13 | `password_reset_tokens` | 0 | رموز استعادة كلمات المرور للبوابة |
| 14 | `preferences` | 0 | رغبات الأساتذة الزمنية في البوابة |
| 15 | `print_settings` | 31 | إعدادات الطباعة، الشعارات، والنصوص الرسمية |
| 16 | `professors` | 305 | بيانات الأساتذة الدائمين والمؤقتين |
| 17 | `rooms` | 32 | القاعات والمدرجات وطاقتها الاستيعابية |
| 18 | `sandbox_snapshots` | 2 | مسودات صندوق التجارب المستقلة |
| 19 | `semesters` | 5 | الفصول السداسية وحالة الرؤية العامة |
| 20 | `specializations` | 0 | التخصصات (تدار حاليًا عبر حقل في `groups`) |
| 21 | `users` | 11 | حسابات المشرفين والمستخدمين مع كلمات المرور والصلاحيات |

**إجمالي السجلات الحية:** 6,368 سجلاً.

---

## 3. جرد مسارات الواجهة الأمامية وتبعياتها (Frontend Routes & Dependencies)

المسارات المعرفة في [`src/App.tsx`](file:///c:/perso/suivie%20online%20130425/suivie29092025/hyper-V/suivie/suivie/src/App.tsx):

| المسار (Route) | المكون (Page Component) | نوع الحماية والصلاحية | المزودات والتبعيات الحيوية (Contexts & Services) |
|---|---|---|---|
| `/` | `Dashboard` | `ProtectedRoute` | `AuthContext`, `AcademicYearContext`, `AssignmentContext`, `SandboxContext` |
| `/academic-years` | `AcademicYears` | `ProtectedRoute` | `AcademicYearContext`, `webClient.getAcademicYears` |
| `/professors` | `Professors` | `ProtectedRoute` | `webClient.getProfessors`, `DepartmentContext` |
| `/courses` | `Courses` | `ProtectedRoute` | `webClient.getCourses`, `DepartmentContext` |
| `/course-assignments` | `CourseAssignments` | `ProtectedRoute` | `AssignmentContext`, `Professors`, `Courses`, `Groups` |
| `/rooms` | `Rooms` | `ProtectedRoute` | `webClient.getRooms`, `RoomCapacity` |
| `/groups` | `Groups` | `ProtectedRoute` | `webClient.getGroups`, `Departments` |
| `/sessions` | `Sessions` | `ProtectedRoute` | `AssignmentContext`, `TimeSlots`, `ConflictChecker` |
| `/available-rooms` | `AvailableRooms` | `ProtectedRoute` | `AssignmentContext`, `webClient.getRooms` |
| `/professor-workload` | `ProfessorWorkload` | `ProtectedRoute` | `AssignmentContext`, `Professors`, `ExtraSessions` |
| `/schedule` | `Schedule` | `ProtectedRoute` | `AssignmentContext`, `PrintSettings`, DnD Kit |
| `/group-schedules` | `GroupSchedules` | `ProtectedRoute` | `AssignmentContext`, `Groups`, PDF Exporters |
| `/session-swap` | `SessionSwap` | `ProtectedRoute` | `AssignmentContext`, `ConflictChecker` |
| `/session-move` | `SessionMove` | `ProtectedRoute` | `AssignmentContext`, `ConflictChecker` |
| `/print-settings` | `PrintSettingsNew` | `ProtectedRoute` | `webClient.getPrintSettings`, Logo uploader |
| `/users` | `UsersPage` | `ProtectedRoute` (adminOnly) | `webClient.getUsers`, `PermissionMatrix` |
| `/backup` | `BackupRestore` | `ProtectedRoute` (adminOnly) | `webClient.exportData`, FileSaver |
| `/audit-log` | `AuditLog` | `ProtectedRoute` (adminOnly) | `webClient.getAuditLogs`, User Filter |
| `/database-settings` | `DatabaseSettings` | عام (مباشر) | Local config storage |
| `/login` | `Login` | عام | `AuthContext.signIn`, `localStorage` |
| `/portal/login` | `PortalLogin` | عام | Portal auth API |
| `/portal/register` | `PortalRegister` | عام | Portal auth API |
| `/portal` | `PortalLayout` | عام / داخلي | Child sub-routes: `profile`, `preferences` |
| `/portal/profile` | `PortalProfile` | داخل البوابة | Portal API profile fetch/save |
| `/portal/preferences` | `PortalPreferences` | داخل البوابة | Portal API preferences matrix |
| `*` | `<Navigate to="/" />` | توجيه تلقائي | للتعامل مع أي رابط غير معرف |
