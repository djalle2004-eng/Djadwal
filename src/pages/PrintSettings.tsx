import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PrintSettings as IPrintSettings, PageSize } from '../types/shared';

// واجهة محلية موسعة للإعدادات
interface PrintSettings extends IPrintSettings {
  // جميع الحقول موروثة من IPrintSettings
}

export default function PrintSettings() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [settings, setSettings] = useState<PrintSettings>({
    universityName: '',
    facultyName: '',
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
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const savedSettings = await window.dataUtils.getPrintSettings();
        console.log('📥 Loaded print settings:', savedSettings);
        if (savedSettings) {
          const updatedSettings: PrintSettings = {
            universityName: savedSettings.universityName || '',
            facultyName: savedSettings.facultyName || '',
            universityLogoUrl: savedSettings.universityLogoUrl || '',
            facultyLogoUrl: savedSettings.facultyLogoUrl || '',
            headerFontSize: savedSettings.headerFontSize ?? 16,
            titleFontSize: savedSettings.titleFontSize ?? 16,
            subtitleFontSize: savedSettings.subtitleFontSize ?? 14,
            cellContentFontSize: savedSettings.cellContentFontSize ?? 10,
            logoSize: savedSettings.logoSize ?? 80,
            cellPadding: (savedSettings as any).cellPadding ?? 3,
            lineHeight: (savedSettings as any).lineHeight ?? 1.2,
            marginBetweenLines: (savedSettings as any).marginBetweenLines ?? 2,
            tableCellAlignment: (savedSettings as any).tableCellAlignment || 'center',
            pageMarginTop: (savedSettings as any).pageMarginTop ?? 5,
            pageMarginBottom: (savedSettings as any).pageMarginBottom ?? 5,
            pageMarginLeft: (savedSettings as any).pageMarginLeft ?? 5,
            pageMarginRight: (savedSettings as any).pageMarginRight ?? 5
          };
          setSettings(updatedSettings);
        }
        setIsLoading(false);
      } catch (err) {
        console.error('خطأ في تحميل إعدادات الطباعة:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setSettings(prev => ({
        ...prev,
        [name]: numValue
      }));
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'university' | 'faculty') => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      try {
        setIsLoading(true);
        const result = await window.dataUtils.uploadLogo(file, type);

        if (type === 'university') {
          setSettings(prev => ({
            ...prev,
            universityLogoUrl: result.url
          }));
        } else {
          setSettings(prev => ({
            ...prev,
            facultyLogoUrl: result.url
          }));
        }
        setIsLoading(false);
      } catch (err) {
        console.error('Logo upload failed:', err);
        setError(err instanceof Error ? err : new Error('Logo upload failed'));
        setIsLoading(false);
      }
    }
  };

  const saveSettings = async () => {
    try {
      setIsLoading(true);
      console.log('💾 Saving print settings:', settings);
      await window.dataUtils.savePrintSettings(settings);
      setIsLoading(false);
      alert('تم حفظ إعدادات الطباعة بنجاح');
      navigate(-1);
    } catch (err) {
      console.error('خطأ في حفظ إعدادات الطباعة:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }
  };

  const resetToDefaults = () => {
    if (confirm('هل أنت متأكد من إعادة تعيين جميع الإعدادات إلى القيم الافتراضية؟')) {
      setSettings({
        universityName: '',
        facultyName: '',
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
      });
    }
  };

  const handleFloatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const floatValue = parseFloat(value);
    if (!isNaN(floatValue)) {
      setSettings(prev => ({
        ...prev,
        [name]: floatValue
      }));
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-center">إعدادات الطباعة</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>حدث خطأ: {error.message}</p>
          <button
            className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
            onClick={() => setError(null)}
          >
            إغلاق
          </button>
        </div>
      )}

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">معلومات المؤسسة</h2>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="universityName">
              اسم الجامعة
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="universityName"
              name="universityName"
              type="text"
              placeholder="أدخل اسم الجامعة"
              value={settings.universityName}
              onChange={handleInputChange}
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="facultyName">
              اسم الكلية
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="facultyName"
              name="facultyName"
              type="text"
              placeholder="أدخل اسم الكلية"
              value={settings.facultyName}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">الشعارات</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="universityLogo">
                شعار الجامعة
              </label>
              <div className="flex flex-col items-center">
                {settings.universityLogoUrl && (
                  <div className="mb-2">
                    <img
                      src={settings.universityLogoUrl}
                      alt="شعار الجامعة"
                      className="max-w-xs max-h-32 object-contain"
                    />
                  </div>
                )}
                <input
                  className="hidden"
                  id="universityLogo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoChange(e, 'university')}
                />
                <label
                  htmlFor="universityLogo"
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer"
                >
                  تحميل شعار الجامعة
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="facultyLogo">
                شعار الكلية
              </label>
              <div className="flex flex-col items-center">
                {settings.facultyLogoUrl && (
                  <div className="mb-2">
                    <img
                      src={settings.facultyLogoUrl}
                      alt="شعار الكلية"
                      className="max-w-xs max-h-32 object-contain"
                    />
                  </div>
                )}
                <input
                  className="hidden"
                  id="facultyLogo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoChange(e, 'faculty')}
                />
                <label
                  htmlFor="facultyLogo"
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer"
                >
                  تحميل شعار الكلية
                </label>
              </div>
            </div>
          </div>

          <div className="mb-4 mt-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="logoSize">
              حجم الشعارات (بالبكسل)
            </label>
            <div className="flex items-center">
              <input
                className="shadow appearance-none border rounded w-24 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="logoSize"
                name="logoSize"
                type="number"
                min="40"
                max="200"
                value={settings.logoSize}
                onChange={handleNumberChange}
              />
              <span className="ml-2">بكسل</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">القيمة المستحسنة: 80 بكسل</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">أحجام الخطوط</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="headerFontSize">
                حجم خط العنوان الرئيسي (اسم الجامعة/الكلية)
              </label>
              <div className="flex items-center">
                <input
                  className="shadow appearance-none border rounded w-24 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="headerFontSize"
                  name="headerFontSize"
                  type="number"
                  min="8"
                  max="24"
                  value={settings.headerFontSize}
                  onChange={handleNumberChange}
                />
                <span className="ml-2">بكسل</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">القيمة المستحسنة: 16 بكسل</p>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="titleFontSize">
                حجم خط العنوان (عنوان الجدول)
              </label>
              <div className="flex items-center">
                <input
                  className="shadow appearance-none border rounded w-24 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="titleFontSize"
                  name="titleFontSize"
                  type="number"
                  min="8"
                  max="24"
                  value={settings.titleFontSize}
                  onChange={handleNumberChange}
                />
                <span className="ml-2">بكسل</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">القيمة المستحسنة: 16 بكسل</p>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="subtitleFontSize">
                حجم خط العنوان الفرعي (تفاصيل الجدول)
              </label>
              <div className="flex items-center">
                <input
                  className="shadow appearance-none border rounded w-24 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="subtitleFontSize"
                  name="subtitleFontSize"
                  type="number"
                  min="8"
                  max="20"
                  value={settings.subtitleFontSize}
                  onChange={handleNumberChange}
                />
                <span className="ml-2">بكسل</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">القيمة المستحسنة: 14 بكسل</p>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="cellContentFontSize">
                حجم خط محتوى الخلايا (داخل الجدول)
              </label>
              <div className="flex items-center">
                <input
                  className="shadow appearance-none border rounded w-24 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="cellContentFontSize"
                  name="cellContentFontSize"
                  type="number"
                  min="6"
                  max="14"
                  value={settings.cellContentFontSize}
                  onChange={handleNumberChange}
                />
                <span className="ml-2">بكسل</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">القيمة المستحسنة: 10 بكسل</p>
            </div>
          </div>

          <div className="mt-6 bg-gray-100 p-4 rounded">
            <h3 className="text-lg font-bold mb-2">معاينة أحجام الخطوط</h3>
            <div className="border border-gray-300 bg-white p-4 rounded">
              <p style={{ fontSize: `${settings.headerFontSize}px`, fontWeight: 'bold', marginBottom: '8px' }}>
                اسم الجامعة/الكلية (حجم: {settings.headerFontSize}px)
              </p>
              <p style={{ fontSize: `${settings.titleFontSize}px`, fontWeight: 'bold', marginBottom: '6px' }}>
                عنوان الجدول (حجم: {settings.titleFontSize}px)
              </p>
              <p style={{ fontSize: `${settings.subtitleFontSize}px`, marginBottom: '12px' }}>
                تفاصيل الجدول الفرعية (حجم: {settings.subtitleFontSize}px)
              </p>
              <div className="border border-gray-300 p-2">
                <p style={{ fontSize: `${settings.cellContentFontSize}px` }}>
                  محتوى خلية الجدول (حجم: {settings.cellContentFontSize}px)
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">إعدادات تنسيق الجداول</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="cellPadding">
                المسافة الداخلية للخلايا (بكسل)
              </label>
              <div className="flex items-center">
                <input
                  className="shadow appearance-none border rounded w-24 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="cellPadding"
                  name="cellPadding"
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={settings.cellPadding}
                  onChange={handleNumberChange}
                />
                <span className="ml-2">بكسل</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">القيمة المستحسنة: 3 بكسل</p>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="lineHeight">
                ارتفاع السطر (line-height)
              </label>
              <div className="flex items-center">
                <input
                  className="shadow appearance-none border rounded w-24 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="lineHeight"
                  name="lineHeight"
                  type="number"
                  min="1"
                  max="2"
                  step="0.1"
                  value={settings.lineHeight}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                      setSettings(prev => ({ ...prev, lineHeight: value }));
                    }
                  }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">القيمة المستحسنة: 1.2 (1 = ضيق، 2 = واسع)</p>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="marginBetweenLines">
                المسافة بين الأسطر داخل الخلية (بكسل)
              </label>
              <div className="flex items-center">
                <input
                  className="shadow appearance-none border rounded w-24 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="marginBetweenLines"
                  name="marginBetweenLines"
                  type="number"
                  min="0"
                  max="10"
                  value={settings.marginBetweenLines}
                  onChange={handleNumberChange}
                />
                <span className="ml-2">بكسل</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">القيمة المستحسنة: 2 بكسل</p>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="tableCellAlignment">
                محاذاة محتوى الخلايا
              </label>
              <select
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="tableCellAlignment"
                name="tableCellAlignment"
                value={settings.tableCellAlignment}
                onChange={(e) => setSettings(prev => ({ ...prev, tableCellAlignment: e.target.value as 'left' | 'center' | 'right' }))}
              >
                <option value="right">يمين</option>
                <option value="center">وسط</option>
                <option value="left">يسار</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">القيمة المستحسنة: وسط</p>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-3">هوامش الصفحة (مم)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="pageMarginTop">
                  الأعلى
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="pageMarginTop"
                  name="pageMarginTop"
                  type="number"
                  min="0"
                  max="50"
                  value={settings.pageMarginTop}
                  onChange={handleNumberChange}
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="pageMarginBottom">
                  الأسفل
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="pageMarginBottom"
                  name="pageMarginBottom"
                  type="number"
                  min="0"
                  max="50"
                  value={settings.pageMarginBottom}
                  onChange={handleNumberChange}
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="pageMarginLeft">
                  اليسار
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="pageMarginLeft"
                  name="pageMarginLeft"
                  type="number"
                  min="0"
                  max="50"
                  value={settings.pageMarginLeft}
                  onChange={handleNumberChange}
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="pageMarginRight">
                  اليمين
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="pageMarginRight"
                  name="pageMarginRight"
                  type="number"
                  min="0"
                  max="50"
                  value={settings.pageMarginRight}
                  onChange={handleNumberChange}
                />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">القيم المستحسنة: 5 مم لجميع الجوانب</p>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="button"
              onClick={saveSettings}
              disabled={isLoading}
            >
              {isLoading ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
            </button>
            <button
              className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="button"
              onClick={resetToDefaults}
              disabled={isLoading}
            >
              🔄 استعادة الافتراضي
            </button>
          </div>
          <button
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="button"
            onClick={() => navigate(-1)}
          >
            ✖️ إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
