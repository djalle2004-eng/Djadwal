/**
 * معالج أخطاء Firebase
 * يوفر هذا الملف وظائف لمعالجة أخطاء Firebase وتقديم رسائل خطأ مفيدة للمستخدم
 */

// أنواع الأخطاء المعروفة
export enum FirebaseErrorType {
  NETWORK = 'network',
  PERMISSION = 'permission',
  AUTHENTICATION = 'authentication',
  BLOCKED = 'blocked',
  UNKNOWN = 'unknown'
}

// واجهة لخطأ Firebase
export interface FirebaseErrorInfo {
  type: FirebaseErrorType;
  message: string;
  technicalDetails?: string;
  solutions: string[];
}

/**
 * تحليل خطأ Firebase وإرجاع معلومات مفيدة
 * @param error كائن الخطأ من Firebase
 * @returns معلومات الخطأ مع الحلول المقترحة
 */
export function parseFirebaseError(error: any): FirebaseErrorInfo {
  // التحقق من وجود كائن خطأ صالح
  if (!error) {
    return {
      type: FirebaseErrorType.UNKNOWN,
      message: 'حدث خطأ غير معروف',
      solutions: ['حاول مرة أخرى لاحقًا', 'تحقق من اتصالك بالإنترنت']
    };
  }

  // استخراج رمز الخطأ ورسالته
  const errorCode = error.code || '';
  const errorMessage = error.message || 'حدث خطأ غير معروف';

  // أخطاء الشبكة
  if (
    errorCode.includes('network-request-failed') ||
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('ERR_BLOCKED_BY_CLIENT')
  ) {
    return {
      type: FirebaseErrorType.NETWORK,
      message: 'حدث خطأ في الاتصال بالخادم',
      technicalDetails: errorMessage,
      solutions: [
        'تحقق من اتصالك بالإنترنت',
        'تعطيل برامج حظر الإعلانات مؤقتًا',
        'إضافة استثناء للموقع في إعدادات برنامج حظر الإعلانات',
        'تحقق من إعدادات جدار الحماية على جهازك'
      ]
    };
  }

  // أخطاء الصلاحيات
  if (
    errorCode.includes('permission-denied') ||
    errorCode.includes('unauthorized') ||
    errorMessage.includes('permission')
  ) {
    return {
      type: FirebaseErrorType.PERMISSION,
      message: 'ليس لديك صلاحية للوصول إلى هذه البيانات',
      technicalDetails: errorMessage,
      solutions: [
        'تسجيل الخروج وإعادة تسجيل الدخول',
        'التحقق من صلاحياتك مع مسؤول النظام'
      ]
    };
  }

  // أخطاء المصادقة
  if (
    errorCode.includes('auth/') ||
    errorMessage.includes('auth') ||
    errorMessage.includes('login')
  ) {
    return {
      type: FirebaseErrorType.AUTHENTICATION,
      message: 'حدث خطأ في المصادقة',
      technicalDetails: errorMessage,
      solutions: [
        'تسجيل الخروج وإعادة تسجيل الدخول',
        'التحقق من بيانات تسجيل الدخول الخاصة بك',
        'إعادة تحميل الصفحة'
      ]
    };
  }

  // أخطاء الحظر
  if (
    errorMessage.includes('blocked') ||
    errorMessage.includes('ERR_BLOCKED_BY_CLIENT')
  ) {
    return {
      type: FirebaseErrorType.BLOCKED,
      message: 'تم حظر الاتصال بالخادم',
      technicalDetails: errorMessage,
      solutions: [
        'تعطيل برامج حظر الإعلانات مؤقتًا',
        'إضافة استثناء للموقع في إعدادات برنامج حظر الإعلانات',
        'تحقق من إعدادات جدار الحماية على جهازك',
        'استخدام متصفح آخر'
      ]
    };
  }

  // أخطاء غير معروفة
  return {
    type: FirebaseErrorType.UNKNOWN,
    message: 'حدث خطأ غير معروف',
    technicalDetails: errorMessage,
    solutions: [
      'إعادة تحميل الصفحة',
      'تسجيل الخروج وإعادة تسجيل الدخول',
      'مسح ذاكرة التخزين المؤقت للمتصفح',
      'حاول مرة أخرى لاحقًا'
    ]
  };
}

/**
 * عرض رسالة خطأ للمستخدم مع الحلول المقترحة
 * @param error كائن الخطأ من Firebase
 * @returns رسالة خطأ مناسبة للعرض للمستخدم
 */
export function getFirebaseErrorMessage(error: any): string {
  const errorInfo = parseFirebaseError(error);
  return errorInfo.message;
}

/**
 * التحقق مما إذا كان الخطأ بسبب حظر الاتصال
 * @param error كائن الخطأ من Firebase
 * @returns true إذا كان الخطأ بسبب حظر الاتصال
 */
export function isBlockedByClientError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || '';
  return errorMessage.includes('ERR_BLOCKED_BY_CLIENT');
}

/**
 * الحصول على الحلول المقترحة لخطأ Firebase
 * @param error كائن الخطأ من Firebase
 * @returns مصفوفة من الحلول المقترحة
 */
export function getFirebaseErrorSolutions(error: any): string[] {
  const errorInfo = parseFirebaseError(error);
  return errorInfo.solutions;
} 