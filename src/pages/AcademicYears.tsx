import { useState, useEffect } from 'react';
import { 
  getAcademicYears, 
  addAcademicYear, 
  setActiveAcademicYear,
  getSemesters,
  addSemester,
  updateSemester,
  setActiveSemester,
  importDataFromPreviousYear
} from '../services/academicYearService';
import { useAcademicYear } from '../context/AcademicYearContext';
import { AcademicYear, Semester, ImportOptions } from '../types/academicYear';
import { Plus, Check, Download, Edit2, Save, X } from 'lucide-react';

export default function AcademicYears() {
  const { currentYear, setCurrentYear, setCurrentSemester } = useAcademicYear();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [newYearName, setNewYearName] = useState('');
  const [newSemesterName, setNewSemesterName] = useState('');
  const [newSemesterStartDate, setNewSemesterStartDate] = useState('');
  const [newSemesterEndDate, setNewSemesterEndDate] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [sourceYearId, setSourceYearId] = useState<number | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    importSpecializations: true,
    importGroups: true,
    importCourses: true
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSemesterId, setEditingSemesterId] = useState<number | null>(null);
  const [editedSemesterName, setEditedSemesterName] = useState('');
  const [editedSemesterStartDate, setEditedSemesterStartDate] = useState('');
  const [editedSemesterEndDate, setEditedSemesterEndDate] = useState('');

  useEffect(() => {
    loadAcademicYears();
  }, []);

  useEffect(() => {
    if (selectedYearId) {
      loadSemesters(selectedYearId);
    }
  }, [selectedYearId]);

  const loadAcademicYears = async () => {
    try {
      setLoading(true);
      const yearsList = await getAcademicYears();
      setYears(yearsList);
      
      // If we have a current year, select it
      if (currentYear) {
        setSelectedYearId(currentYear.id);
      } else if (yearsList.length > 0) {
        // Otherwise select the first one
        setSelectedYearId(yearsList[0].id);
      }
      
      setLoading(false);
    } catch (err) {
      setError('فشل في تحميل السنوات الدراسية');
      setLoading(false);
      console.error(err);
    }
  };

  const loadSemesters = async (yearId: number) => {
    try {
      const semestersList = await getSemesters(yearId);
      setSemesters(semestersList);
    } catch (err) {
      console.error('فشل في تحميل الفصول الدراسية:', err);
    }
  };

  const handleAddYear = async () => {
    if (!newYearName.trim()) return;
    
    try {
      await addAcademicYear(newYearName);
      setNewYearName('');
      await loadAcademicYears();
    } catch (err) {
      setError('فشل في إضافة السنة الدراسية');
      console.error(err);
    }
  };

  const handleSetActiveYear = async (yearId: number) => {
    try {
      await setActiveAcademicYear(yearId);
      
      // Update the context with the new current year
      const updatedYear = years.find(y => y.id === yearId);
      if (updatedYear) {
        setCurrentYear({...updatedYear, is_current: true});
      }
      
      // Refresh the list
      await loadAcademicYears();
    } catch (err) {
      setError('فشل في تعيين السنة الدراسية الحالية');
      console.error(err);
    }
  };

  const handleAddSemester = async () => {
    if (!selectedYearId || !newSemesterName.trim() || !newSemesterStartDate || !newSemesterEndDate) return;
    
    try {
      await addSemester(
        selectedYearId,
        newSemesterName,
        newSemesterStartDate,
        newSemesterEndDate
      );
      
      setNewSemesterName('');
      setNewSemesterStartDate('');
      setNewSemesterEndDate('');
      await loadSemesters(selectedYearId);
    } catch (err) {
      setError('فشل في إضافة الفصل الدراسي');
      console.error(err);
    }
  };

  const handleSetActiveSemester = async (semesterId: number) => {
    try {
      await setActiveSemester(semesterId);
      
      // Update the context with the new current semester
      const updatedSemester = semesters.find(s => s.id === semesterId);
      if (updatedSemester) {
        setCurrentSemester({...updatedSemester, is_current: true});
      }
      
      // Refresh the list
      if (selectedYearId) {
        await loadSemesters(selectedYearId);
      }
    } catch (err) {
      setError('فشل في تعيين الفصل الدراسي الحالي');
      console.error(err);
    }
  };

  const handleImportData = async () => {
    if (!sourceYearId || !selectedYearId) return;
    
    try {
      await importDataFromPreviousYear(
        sourceYearId,
        selectedYearId,
        importOptions
      );
      
      setShowImportModal(false);
      // Optionally reload data after import
    } catch (err) {
      setError('فشل في استيراد البيانات من السنة السابقة');
      console.error(err);
    }
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div className="min-h-full">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">إدارة السنوات الدراسية</h1>
        </div>
      </header>

      <main>
        <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {/* Add New Academic Year */}
          <div className="bg-white p-6 shadow rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">إضافة سنة دراسية جديدة</h2>
            <div className="flex gap-4">
              <input 
                type="text"
                value={newYearName}
                onChange={e => setNewYearName(e.target.value)}
                placeholder="مثال: 2025-2026"
                className="border border-gray-300 rounded-md px-3 py-2 flex-1"
              />
              <button
                onClick={handleAddYear}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                <Plus className="h-5 w-5 mr-1 inline" />
                إضافة
              </button>
            </div>
          </div>

          {/* Academic Years List */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-1 bg-white p-6 shadow rounded-lg">
              <h2 className="text-xl font-semibold mb-4">السنوات الدراسية</h2>
              {years.length === 0 ? (
                <p>لا توجد سنوات دراسية</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {years.map(year => (
                    <li key={year.id} className="py-3 flex justify-between items-center">
                      <div
                        className={`flex-1 cursor-pointer ${selectedYearId === year.id ? 'font-bold' : ''}`}
                        onClick={() => setSelectedYearId(year.id)}
                      >
                        {year.year_name}
                        {year.is_current && (
                          <span className="mr-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            حالية
                          </span>
                        )}
                      </div>
                      {!year.is_current && (
                        <button
                          onClick={() => handleSetActiveYear(year.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="تعيين كسنة حالية"
                        >
                          <Check className="h-5 w-5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Semesters Management */}
            <div className="md:col-span-2 bg-white p-6 shadow rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">الفصول الدراسية</h2>
                {selectedYearId && (
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm"
                  >
                    <Download className="h-4 w-4 mr-1 inline" />
                    استيراد بيانات
                  </button>
                )}
              </div>

              {!selectedYearId ? (
                <p>اختر سنة دراسية لعرض الفصول</p>
              ) : (
                <>
                  {/* Add New Semester */}
                  <div className="mb-4 p-4 border border-gray-200 rounded-md">
                    <h3 className="text-lg font-medium mb-2">إضافة فصل دراسي جديد</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <input 
                        type="text"
                        value={newSemesterName}
                        onChange={e => setNewSemesterName(e.target.value)}
                        placeholder="اسم الفصل الدراسي"
                        className="border border-gray-300 rounded-md px-3 py-2"
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">تاريخ البداية</label>
                          <input 
                            type="date"
                            value={newSemesterStartDate}
                            onChange={e => setNewSemesterStartDate(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">تاريخ النهاية</label>
                          <input 
                            type="date"
                            value={newSemesterEndDate}
                            onChange={e => setNewSemesterEndDate(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 w-full"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleAddSemester}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      <Plus className="h-5 w-5 mr-1 inline" />
                      إضافة الفصل
                    </button>
                  </div>

                  {/* Semesters List */}
                  {semesters.length === 0 ? (
                    <p>لا توجد فصول دراسية</p>
                  ) : (
                    <ul className="divide-y divide-gray-200">
                      {semesters.map(semester => (
                        <li key={semester.id} className="py-3 flex justify-between items-center">
                          {editingSemesterId === semester.id ? (
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                              <input 
                                type="text"
                                value={editedSemesterName}
                                onChange={e => setEditedSemesterName(e.target.value)}
                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                                placeholder="اسم الفصل"
                              />
                              <input 
                                type="date"
                                value={editedSemesterStartDate}
                                onChange={e => setEditedSemesterStartDate(e.target.value)}
                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                              />
                              <input 
                                type="date"
                                value={editedSemesterEndDate}
                                onChange={e => setEditedSemesterEndDate(e.target.value)}
                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                              />
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium">{semester.semester_name}</span>
                              <div className="text-sm text-gray-500">
                                {new Date(semester.start_date).toLocaleDateString()} - 
                                {new Date(semester.end_date).toLocaleDateString()}
                              </div>
                              {semester.is_current && (
                                <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  حالي
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex gap-2">
                            {editingSemesterId === semester.id ? (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      await updateSemester(
                                        editingSemesterId,
                                        editedSemesterName,
                                        editedSemesterStartDate,
                                        editedSemesterEndDate
                                      );
                                      setEditingSemesterId(null);
                                      setEditedSemesterName('');
                                      setEditedSemesterStartDate('');
                                      setEditedSemesterEndDate('');
                                      if (selectedYearId) {
                                        await loadSemesters(selectedYearId);
                                      }
                                    } catch (err) {
                                      setError('فشل في تعديل الفصل الدراسي');
                                      console.error(err);
                                    }
                                  }}
                                  className="text-green-600 hover:text-green-800"
                                  title="حفظ التعديلات"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingSemesterId(null);
                                    setEditedSemesterName('');
                                    setEditedSemesterStartDate('');
                                    setEditedSemesterEndDate('');
                                  }}
                                  className="text-red-600 hover:text-red-800"
                                  title="إلغاء التعديل"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                {!semester.is_current && (
                                  <button
                                    onClick={() => handleSetActiveSemester(semester.id)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="تعيين كفصل حالي"
                                  >
                                    <Check className="h-5 w-5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingSemesterId(semester.id);
                                    setEditedSemesterName(semester.semester_name);
                                    setEditedSemesterStartDate(semester.start_date);
                                    setEditedSemesterEndDate(semester.end_date);
                                  }}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="تعديل الفصل"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Import Data Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">استيراد بيانات من سنة سابقة</h2>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">السنة المصدر</label>
              <select
                value={sourceYearId?.toString() || ''}
                onChange={e => setSourceYearId(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
              >
                <option value="">اختر السنة المصدر</option>
                {years.filter(y => y.id !== selectedYearId).map(year => (
                  <option key={year.id} value={year.id}>{year.year_name}</option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <h3 className="text-md font-medium mb-2">خيارات الاستيراد</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={importOptions.importSpecializations}
                    onChange={e => setImportOptions({...importOptions, importSpecializations: e.target.checked})}
                    className="mr-2"
                  />
                  استيراد التخصصات
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={importOptions.importGroups}
                    onChange={e => setImportOptions({...importOptions, importGroups: e.target.checked})}
                    className="mr-2"
                  />
                  استيراد الأفواج
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={importOptions.importCourses}
                    onChange={e => setImportOptions({...importOptions, importCourses: e.target.checked})}
                    className="mr-2"
                  />
                  استيراد المقاييس
                </label>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="ml-3 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleImportData}
                disabled={!sourceYearId}
                className={`px-4 py-2 rounded-md text-white ${!sourceYearId ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                استيراد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
