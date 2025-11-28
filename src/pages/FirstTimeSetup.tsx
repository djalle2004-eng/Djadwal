import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, AlertCircle } from 'lucide-react';

/**
 * صفحة التوجيه لإعدادات قاعدة البيانات
 * تظهر عندما يكون التطبيق غير مُهيأ
 */
export default function FirstTimeSetup() {
  const navigate = useNavigate();

  useEffect(() => {
    // توجيه تلقائي لصفحة الإعدادات بعد ثانية واحدة
    const timer = setTimeout(() => {
      navigate('/database-settings');
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="bg-blue-100 rounded-full p-6">
            <Settings className="w-16 h-16 text-blue-600 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          مرحباً بك في Djadwal! 👋
        </h1>

        {/* Message */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-right text-sm text-amber-800">
            <p className="font-semibold mb-1">الإعداد الأولي مطلوب</p>
            <p>يُرجى إعداد اتصال قاعدة البيانات للمتابعة.</p>
          </div>
        </div>

        {/* Loading */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-600 h-2 rounded-full animate-progress" style={{ 
              animation: 'progress 1s ease-out forwards' 
            }}></div>
          </div>
          <p className="text-gray-600 text-sm">جاري التوجيه لصفحة الإعدادات...</p>
        </div>

        {/* Manual Link */}
        <button
          onClick={() => navigate('/database-settings')}
          className="mt-6 text-blue-600 hover:text-blue-700 underline text-sm"
        >
          الانتقال مباشرة
        </button>
      </div>

      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
