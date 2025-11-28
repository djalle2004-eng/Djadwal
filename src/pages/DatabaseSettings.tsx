import React, { useState, useEffect } from 'react';
import { Database, Save, Check, X, AlertCircle, Info } from 'lucide-react';

interface DatabaseConfig {
  useTurso?: boolean;
  turso?: {
    url: string;
    authToken: string;
  };
  useNeon: boolean;
  neonConnectionString: string;
  useSQLiteCloud: boolean;
  sqliteCloud: {
    username: string;
    password: string;
    host: string;
    port: number;
    database: string;
  };
}

export default function DatabaseSettings() {
  const [config, setConfig] = useState<DatabaseConfig>({
    useTurso: true,
    turso: {
      url: '',
      authToken: ''
    },
    useNeon: false,
    neonConnectionString: '',
    useSQLiteCloud: false,
    sqliteCloud: {
      username: '',
      password: '',
      host: '',
      port: 8860,
      database: 'Djadwal'
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [configPath, setConfigPath] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    // Web Mode check
    if (!window.electron) {
      setLoading(false);
      return;
    }

    try {
      const dbConfig = await window.electron.invoke('get-database-config');
      const path = await window.electron.invoke('get-config-path');
      setConfig(dbConfig);
      setConfigPath(path);
      setLoading(false);
    } catch (error) {
      console.error('Error loading config:', error);
      setMessage({ type: 'error', text: 'فشل في تحميل الإعدادات' });
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Validation
      if (config.useTurso && (!config.turso?.url || !config.turso?.authToken)) {
        setMessage({ type: 'error', text: 'الرجاء إدخال Turso URL و Auth Token' });
        setSaving(false);
        return;
      }

      if (config.useNeon && !config.neonConnectionString) {
        setMessage({ type: 'error', text: 'الرجاء إدخال Neon Connection String' });
        setSaving(false);
        return;
      }

      if (config.useSQLiteCloud && (!config.sqliteCloud.username || !config.sqliteCloud.password)) {
        setMessage({ type: 'error', text: 'الرجاء إدخال اسم المستخدم وكلمة المرور لـ SQLite Cloud' });
        setSaving(false);
        return;
      }

      const result = await window.electron.invoke('update-database-config', config);

      if (result.success) {
        setMessage({ type: 'success', text: '✅ تم حفظ الإعدادات بنجاح! يُرجى إعادة تشغيل التطبيق.' });
      } else {
        setMessage({ type: 'error', text: `❌ فشل في حفظ الإعدادات: ${result.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `❌ خطأ: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <Database className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">إعدادات قاعدة البيانات</h1>
            <p className="text-sm text-gray-500">Database Connection Settings</p>
          </div>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">ملاحظة مهمة:</p>
            <p>يجب إعادة تشغيل التطبيق بعد حفظ الإعدادات لتفعيل الاتصال بقاعدة البيانات.</p>
            <p className="mt-2 text-xs text-blue-600">
              <strong>مسار ملف الإعدادات:</strong> <code className="bg-blue-100 px-1 rounded">{configPath}</code>
            </p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
            {message.type === 'success' ? (
              <Check className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p>{message.text}</p>
          </div>
        )}

        {/* Turso Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="useTurso"
              checked={config.useTurso}
              onChange={(e) => setConfig({ ...config, useTurso: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="useTurso" className="text-lg font-semibold text-gray-800 cursor-pointer">
              استخدام Turso (🚀 موصى به - Multi-user via HTTPS)
            </label>
          </div>

          {config.useTurso && (
            <div className="bg-gray-50 rounded-lg p-4 mr-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Turso Database URL
                </label>
                <input
                  type="text"
                  value={config.turso?.url || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    turso: { ...config.turso!, url: e.target.value }
                  })}
                  placeholder="libsql://your-db.region.turso.io"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-2">
                  مثال: libsql://djadwal-xxx.aws-eu-west-1.turso.io
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Auth Token
                </label>
                <textarea
                  value={config.turso?.authToken || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    turso: { ...config.turso!, authToken: e.target.value }
                  })}
                  placeholder="eyJhbGciOiJFZERTQSIs..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-2">
                  🔒 Token من Turso Dashboard
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>✅ مميزات Turso:</strong> Multi-user support, Port 443 (HTTPS), Edge computing, لا مشاكل Firewall
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Neon PostgreSQL Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="useNeon"
              checked={config.useNeon}
              onChange={(e) => setConfig({ ...config, useNeon: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="useNeon" className="text-lg font-semibold text-gray-800 cursor-pointer">
              استخدام Neon PostgreSQL (الإنتاج)
            </label>
          </div>

          {config.useNeon && (
            <div className="bg-gray-50 rounded-lg p-4 mr-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Neon Connection String
              </label>
              <input
                type="text"
                value={config.neonConnectionString}
                onChange={(e) => setConfig({ ...config, neonConnectionString: e.target.value })}
                placeholder="postgresql://user:password@host.neon.tech/dbname?sslmode=require"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                dir="ltr"
              />
              <p className="text-xs text-gray-500 mt-2">
                مثال: postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
              </p>
            </div>
          )}
        </div>

        {/* SQLite Cloud Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="useSQLiteCloud"
              checked={config.useSQLiteCloud}
              onChange={(e) => setConfig({ ...config, useSQLiteCloud: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="useSQLiteCloud" className="text-lg font-semibold text-gray-800 cursor-pointer">
              استخدام SQLite Cloud (النسخ الاحتياطي)
            </label>
          </div>

          {config.useSQLiteCloud && (
            <div className="bg-gray-50 rounded-lg p-4 mr-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اسم المستخدم
                  </label>
                  <input
                    type="text"
                    value={config.sqliteCloud.username}
                    onChange={(e) => setConfig({
                      ...config,
                      sqliteCloud: { ...config.sqliteCloud, username: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={config.sqliteCloud.password}
                      onChange={(e) => setConfig({
                        ...config,
                        sqliteCloud: { ...config.sqliteCloud, password: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Host
                  </label>
                  <input
                    type="text"
                    value={config.sqliteCloud.host}
                    onChange={(e) => setConfig({
                      ...config,
                      sqliteCloud: { ...config.sqliteCloud, host: e.target.value }
                    })}
                    placeholder="example.sqlite.cloud"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Port
                  </label>
                  <input
                    type="number"
                    value={config.sqliteCloud.port}
                    onChange={(e) => setConfig({
                      ...config,
                      sqliteCloud: { ...config.sqliteCloud, port: parseInt(e.target.value) }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم قاعدة البيانات
                </label>
                <input
                  type="text"
                  value={config.sqliteCloud.database}
                  onChange={(e) => setConfig({
                    ...config,
                    sqliteCloud: { ...config.sqliteCloud, database: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  dir="ltr"
                />
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>حفظ الإعدادات</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
