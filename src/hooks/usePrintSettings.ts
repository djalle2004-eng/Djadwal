/**
 * Hook موحد لإدارة إعدادات الطباعة
 * يوفر واجهة سهلة للوصول إلى إعدادات الطباعة مع قيم افتراضية
 */

import { useState, useEffect, useCallback } from 'react';
import type { PrintSettings, PrintOptions } from '../types/shared';

/**
 * القيم الافتراضية لإعدادات الطباعة
 */
const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  universityName: 'جامعة الشهيد حمه لخضر - الوادي',
  facultyName: 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير',
  departmentName: '',
  universityLogoUrl: '',
  facultyLogoUrl: '',
  headerFontSize: 16,
  titleFontSize: 16,
  subtitleFontSize: 14,
  cellContentFontSize: 10,
  footerFontSize: 10,
  logoSize: 80,
  cellPadding: 3,
  lineHeight: 1.2,
  marginBetweenLines: 2,
  sessionGap: 8,
  tableCellAlignment: 'center',
  tableBorderWidth: 1,
  tableBorderColor: '#000000',
  pageMarginTop: 5,
  pageMarginBottom: 5,
  pageMarginLeft: 5,
  pageMarginRight: 5,
  pageSize: 'A4',
  showPageNumbers: false,
  showPrintDate: true,
  watermarkText: '',
  watermarkOpacity: 0.1
};

interface UsePrintSettingsReturn {
  settings: PrintSettings;
  isLoading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
  saveSettings: (newSettings: PrintSettings) => Promise<void>;
  resetToDefaults: () => void;
  mergeWithDefaults: (partial: Partial<PrintSettings>) => PrintSettings;
}

/**
 * Hook لإدارة إعدادات الطباعة
 */
export function usePrintSettings(): UsePrintSettingsReturn {
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * تحميل إعدادات الطباعة من النظام
   */
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const savedSettings = await window.dataUtils.getPrintSettings();

      if (savedSettings) {
        // دمج الإعدادات المحفوظة مع القيم الافتراضية
        const mergedSettings: PrintSettings = {
          ...DEFAULT_PRINT_SETTINGS,
          ...savedSettings
        };

        setSettings(mergedSettings);
        console.log('✅ تم تحميل إعدادات الطباعة بنجاح:', mergedSettings);
      } else {
        setSettings(DEFAULT_PRINT_SETTINGS);
      }
    } catch (err) {
      console.error('❌ خطأ في تحميل إعدادات الطباعة:', err);
      setError(err instanceof Error ? err.message : 'فشل تحميل إعدادات الطباعة');
      setSettings(DEFAULT_PRINT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * حفظ إعدادات الطباعة
   */
  const saveSettings = useCallback(async (newSettings: PrintSettings) => {
    setIsLoading(true);
    setError(null);

    try {
      // تحويل الإعدادات إلى الصيغة المتوقعة
      await window.dataUtils.savePrintSettings(newSettings as any);
      setSettings(newSettings);
      console.log('✅ تم حفظ إعدادات الطباعة بنجاح');
    } catch (err) {
      console.error('❌ خطأ في حفظ إعدادات الطباعة:', err);
      setError(err instanceof Error ? err.message : 'فشل حفظ إعدادات الطباعة');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * إعادة تعيين الإعدادات إلى القيم الافتراضية
   */
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_PRINT_SETTINGS);
  }, []);

  /**
   * دمج إعدادات جزئية مع القيم الافتراضية
   */
  const mergeWithDefaults = useCallback((partial: Partial<PrintSettings>): PrintSettings => {
    return {
      ...DEFAULT_PRINT_SETTINGS,
      ...settings,
      ...partial
    };
  }, [settings]);

  // تحميل الإعدادات عند تحميل المكون
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    isLoading,
    error,
    loadSettings,
    saveSettings,
    resetToDefaults,
    mergeWithDefaults
  };
}

/**
 * دالة مساعدة لإنشاء خيارات طباعة كاملة من الإعدادات
 */
export function createPrintOptions(
  title: string,
  settings: PrintSettings,
  overrides?: Partial<PrintOptions>
): PrintOptions {
  return {
    ...settings,
    title,
    orientation: overrides?.orientation || 'portrait',
    fontSize: overrides?.fontSize || `${settings.cellContentFontSize || 10}pt`,
    hideAfterPrint: overrides?.hideAfterPrint ?? false,
    asPDF: overrides?.asPDF ?? false,
    showHeader: overrides?.showHeader ?? true,
    showFooter: overrides?.showFooter ?? true,
    ...overrides
  };
}

/**
 * دالة مساعدة للحصول على إعدادات الطباعة بشكل متزامن
 * (للاستخدام في المكونات التي لا تستطيع استخدام hooks)
 */
export async function getPrintSettingsWithDefaults(): Promise<PrintSettings> {
  try {
    const savedSettings = await window.dataUtils.getPrintSettings();
    return {
      ...DEFAULT_PRINT_SETTINGS,
      ...savedSettings
    };
  } catch (error) {
    console.error('خطأ في تحميل إعدادات الطباعة، استخدام القيم الافتراضية:', error);
    return DEFAULT_PRINT_SETTINGS;
  }
}

export { DEFAULT_PRINT_SETTINGS };
