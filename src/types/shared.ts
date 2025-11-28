/**
 * واجهات البيانات المشتركة بين المكونات المختلفة
 */

/**
 * واجهة القسم
 * تستخدم للتعامل مع بيانات الأقسام في الكلية
 */
export interface Department {
  id: number;
  name: string;
  code?: string;
  created_at?: string;
}

/**
 * واجهة المجموعة
 * تستخدم في كافة أنحاء التطبيق للتعامل مع المجموعات
 */
export interface Group {
  id: number;
  name: string;
  specialization?: string;
  year?: string;
  parent_group_id?: number;
  department_id?: number;
  department_name?: string;
  group_type?: 'department' | 'specialization' | 'group' | 'lecture_group';
  created_at?: string;
  children?: Group[]; // للعرض الشجري
  [key: string]: any; // Add index signature to allow string indexing
}

/**
 * نموذج بيانات المجموعة للإضافة والتعديل
 */
export interface GroupFormData {
  name: string;
  specialization?: string;
  year?: string;
  parent_group_id?: number;
  department_id?: number;
  group_type?: 'department' | 'specialization' | 'group' | 'lecture_group';
} 

/**
 * واجهة أخطاء النماذج
 * تستخدم للتحقق من صحة البيانات المدخلة في النماذج
 */
export interface FormErrors {
  [key: string]: string | undefined;
}

// ========================================
// Authentication & Authorization Types
// ========================================

/**
 * أنواع الأدوار في النظام
 */
export type UserRole = 'admin' | 'schedule_manager' | 'staff' | 'professor';

/**
 * أنواع الإجراءات التي يمكن تسجيلها
 */
export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'backup' | 'restore';

/**
 * أنواع النسخ الاحتياطي
 */
export type BackupType = 'full' | 'partial' | 'auto' | 'manual';

/**
 * صيغ النسخ الاحتياطي
 */
export type BackupFormat = 'sqlite' | 'sql' | 'json';

/**
 * واجهة المستخدم
 */
export interface User {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  role: UserRole;
  professor_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  last_login?: string;
  customPermissions?: RolePermissions | null;
}

/**
 * بيانات تسجيل الدخول
 */
export interface LoginCredentials {
  username: string;
  password: string;
  remember_me?: boolean;
}

/**
 * بيانات إضافة/تعديل مستخدم
 */
export interface UserFormData {
  username: string;
  password?: string;
  full_name: string;
  email?: string;
  role: UserRole;
  professor_id?: number;
  is_active: boolean;
}

/**
 * واجهة الصلاحية
 */
export interface Permission {
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

/**
 * صلاحيات الدور
 */
export interface RolePermissions {
  academic_years: Permission;
  professors: Permission;
  courses: Permission;
  rooms: Permission;
  groups: Permission;
  departments: Permission;
  sessions: Permission;
  extra_sessions: Permission;
  reports: Permission;
  users: Permission;
  settings: Permission;
  backup: Permission;
}

/**
 * سجل الأنشطة
 */
export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  action: AuditAction;
  entity_type: string;
  entity_id?: number;
  details?: string;
  ip_address?: string;
  created_at: string;
}

/**
 * سجل النسخ الاحتياطي
 */
export interface BackupHistory {
  id: number;
  backup_name: string;
  backup_path: string;
  backup_type: BackupType;
  backup_format: BackupFormat;
  file_size?: number;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  notes?: string;
}

/**
 * إعدادات النسخ الاحتياطي
 */
export interface BackupSettings {
  auto_backup_enabled: boolean;
  backup_frequency: 'daily' | 'weekly' | 'monthly';
  backup_time: string; // '02:00'
  backup_location: string;
  max_backups: number;
  backup_format: BackupFormat;
  include_users: boolean;
}

/**
 * خيارات إنشاء نسخة احتياطية
 */
export interface BackupOptions {
  type: BackupType;
  format: BackupFormat;
  academic_year_id?: number; // للنسخ الجزئية
  notes?: string;
}

/**
 * خيارات الاستعادة
 */
export interface RestoreOptions {
  backup_id: number;
  mode: 'replace' | 'merge';
  backup_password?: string; // للنسخ المشفرة
}

// ========================================
// Print Settings & Options Types
// ========================================

/**
 * أحجام الصفحات المدعومة
 */
export type PageSize = 'A4' | 'A3' | 'Letter' | 'Legal';

/**
 * اتجاه الصفحة
 */
export type PageOrientation = 'portrait' | 'landscape';

/**
 * محاذاة النص
 */
export type TextAlignment = 'left' | 'center' | 'right';

/**
 * إعدادات الطباعة الأساسية
 */
export interface PrintSettings {
  // معلومات المؤسسة
  universityName?: string;
  facultyName?: string;
  departmentName?: string;
  
  // الشعارات
  universityLogoUrl?: string;
  facultyLogoUrl?: string;
  
  // أحجام الخطوط
  headerFontSize?: number;      // حجم خط الترويسة (افتراضي: 16)
  titleFontSize?: number;        // حجم خط العنوان (افتراضي: 16)
  subtitleFontSize?: number;     // حجم خط العنوان الفرعي (افتراضي: 14)
  cellContentFontSize?: number;  // حجم خط محتوى الخلايا (افتراضي: 10)
  footerFontSize?: number;       // حجم خط التذييل (افتراضي: 10)
  
  // حجم الشعار
  logoSize?: number;             // حجم الشعار بالبكسل (افتراضي: 80)
  
  // تنسيق الجداول
  cellPadding?: number;          // المسافة الداخلية للخلايا (افتراضي: 3)
  lineHeight?: number;           // ارتفاع السطر (افتراضي: 1.2)
  marginBetweenLines?: number;   // المسافة بين الأسطر (افتراضي: 2)
  sessionGap?: number;           // المسافة بين الحصص في نفس الخلية (افتراضي: 8)
  tableCellAlignment?: TextAlignment; // محاذاة محتوى الخلايا (افتراضي: center)
  tableBorderWidth?: number;     // عرض حدود الجدول (افتراضي: 1)
  tableBorderColor?: string;     // لون حدود الجدول (افتراضي: #000000)
  
  // هوامش الصفحة (بالملم)
  pageMarginTop?: number;        // الهامش العلوي (افتراضي: 5)
  pageMarginBottom?: number;     // الهامش السفلي (افتراضي: 5)
  pageMarginLeft?: number;       // الهامش الأيسر (افتراضي: 5)
  pageMarginRight?: number;      // الهامش الأيمن (افتراضي: 5)
  
  // إعدادات الصفحة
  pageSize?: PageSize;           // حجم الصفحة (افتراضي: A4)
  showPageNumbers?: boolean;     // إظهار أرقام الصفحات (افتراضي: false)
  showPrintDate?: boolean;       // إظهار تاريخ الطباعة (افتراضي: true)
  
  // علامة مائية
  watermarkText?: string;        // نص العلامة المائية
  watermarkOpacity?: number;     // شفافية العلامة المائية (0-1)
}

/**
 * خيارات الطباعة الموسعة
 */
export interface PrintOptions extends PrintSettings {
  // خيارات أساسية
  title: string;                 // عنوان المستند
  orientation?: PageOrientation; // اتجاه الصفحة
  fontSize?: string;             // حجم الخط العام (مثل: '12pt')
  
  // خيارات متقدمة
  hideAfterPrint?: boolean;      // إخفاء النافذة بعد الطباعة
  asPDF?: boolean;               // حفظ كـ PDF بدلاً من الطباعة العادية
  marginBottom?: string;         // الهامش السفلي للعناصر
  
  // ترويسة وتذييل مخصصة
  showHeader?: boolean;          // إظهار الترويسة
  showFooter?: boolean;          // إظهار التذييل
  headerContent?: string;        // محتوى HTML للترويسة
  footerContent?: string;        // محتوى HTML للتذييل
  
  // CSS مخصص
  customCSS?: string;            // CSS إضافي
  
  // علامة مائية
  watermark?: string;            // نص العلامة المائية
}

/**
 * قوالب الطباعة المحددة مسبقاً
 */
export type PrintPreset = 'schedule' | 'certificate' | 'report' | 'announcement' | 'custom';

/**
 * خيارات قالب الطباعة
 */
export interface PrintPresetOptions {
  preset: PrintPreset;
  settings: PrintSettings;
  customizations?: Partial<PrintOptions>;
}