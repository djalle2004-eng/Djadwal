import { BackupHistory, BackupOptions, RestoreOptions, BackupSettings } from '../types/shared';

/**
 * إنشاء نسخة احتياطية
 */
export const createBackup = async (options: BackupOptions): Promise<BackupHistory> => {
  try {
    if (typeof window === 'undefined' || !window.db?.createBackup) {
      throw new Error('Backup service not available');
    }
    
    return await window.db.createBackup(options);
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
};

/**
 * استعادة من نسخة احتياطية
 */
export const restoreBackup = async (options: RestoreOptions): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db?.restoreBackup) {
      throw new Error('Restore service not available');
    }
    
    await window.db.restoreBackup(options);
  } catch (error) {
    console.error('Error restoring backup:', error);
    throw error;
  }
};

/**
 * جلب قائمة النسخ الاحتياطية
 */
export const listBackups = async (): Promise<BackupHistory[]> => {
  try {
    if (typeof window === 'undefined' || !window.db?.getBackupHistory) {
      throw new Error('Backup service not available');
    }
    
    return await window.db.getBackupHistory();
  } catch (error) {
    console.error('Error listing backups:', error);
    throw error;
  }
};

/**
 * حذف نسخة احتياطية
 */
export const deleteBackup = async (backupId: number): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db?.deleteBackup) {
      throw new Error('Backup service not available');
    }
    
    await window.db.deleteBackup(backupId);
  } catch (error) {
    console.error('Error deleting backup:', error);
    throw error;
  }
};

/**
 * تصدير البيانات بصيغة JSON
 */
export const exportToJSON = async (academicYearId?: number): Promise<any> => {
  try {
    if (typeof window === 'undefined' || !window.db?.exportToJSON) {
      throw new Error('Export service not available');
    }
    
    return await window.db.exportToJSON(academicYearId);
  } catch (error) {
    console.error('Error exporting to JSON:', error);
    throw error;
  }
};

/**
 * استيراد البيانات من JSON
 */
export const importFromJSON = async (jsonData: any, mode: 'replace' | 'merge'): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db?.importFromJSON) {
      throw new Error('Import service not available');
    }
    
    await window.db.importFromJSON(jsonData, mode);
  } catch (error) {
    console.error('Error importing from JSON:', error);
    throw error;
  }
};

/**
 * الحصول على إعدادات النسخ الاحتياطي
 */
export const getBackupSettings = async (): Promise<BackupSettings> => {
  try {
    if (typeof window === 'undefined' || !window.db?.getBackupSettings) {
      throw new Error('Backup settings service not available');
    }
    
    return await window.db.getBackupSettings();
  } catch (error) {
    console.error('Error getting backup settings:', error);
    throw error;
  }
};

/**
 * حفظ إعدادات النسخ الاحتياطي
 */
export const saveBackupSettings = async (settings: BackupSettings): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db?.saveBackupSettings) {
      throw new Error('Backup settings service not available');
    }
    
    await window.db.saveBackupSettings(settings);
  } catch (error) {
    console.error('Error saving backup settings:', error);
    throw error;
  }
};

/**
 * جدولة نسخ احتياطي تلقائي
 */
export const scheduleAutoBackup = async (settings: BackupSettings): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db?.scheduleAutoBackup) {
      throw new Error('Auto backup service not available');
    }
    
    await window.db.scheduleAutoBackup(settings);
  } catch (error) {
    console.error('Error scheduling auto backup:', error);
    throw error;
  }
};

/**
 * إيقاف النسخ الاحتياطي التلقائي
 */
export const stopAutoBackup = async (): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db?.stopAutoBackup) {
      throw new Error('Auto backup service not available');
    }
    
    await window.db.stopAutoBackup();
  } catch (error) {
    console.error('Error stopping auto backup:', error);
    throw error;
  }
};

/**
 * معاينة محتوى النسخة الاحتياطية
 */
export const previewBackup = async (backupId: number): Promise<any> => {
  try {
    if (typeof window === 'undefined' || !window.db?.previewBackup) {
      throw new Error('Backup preview service not available');
    }
    
    return await window.db.previewBackup(backupId);
  } catch (error) {
    console.error('Error previewing backup:', error);
    throw error;
  }
};

/**
 * التحقق من صحة النسخة الاحتياطية
 */
export const validateBackup = async (backupId: number): Promise<{ valid: boolean; errors?: string[] }> => {
  try {
    if (typeof window === 'undefined' || !window.db?.validateBackup) {
      throw new Error('Backup validation service not available');
    }
    
    return await window.db.validateBackup(backupId);
  } catch (error) {
    console.error('Error validating backup:', error);
    throw error;
  }
};