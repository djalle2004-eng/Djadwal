export interface DatabaseErrorAlertProps {
  error: Error;
  onRetry?: () => Promise<void>;
  onClose?: () => void;
}

export default function DatabaseErrorAlert({ error, onRetry, onClose }: DatabaseErrorAlertProps) {
  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
      <strong className="font-bold">خطأ في قاعدة البيانات!</strong>
      <span className="block sm:inline"> {error.message || 'حدث خطأ أثناء الوصول إلى قاعدة البيانات.'}</span>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm mr-2"
        >
          إعادة المحاولة
        </button>
      )}
      {onClose && (
        <button 
          onClick={onClose}
          className="mt-2 bg-gray-500 hover:bg-gray-700 text-white font-bold py-1 px-2 rounded text-sm"
        >
          إغلاق
        </button>
      )}
    </div>
  );
}