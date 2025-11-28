import React, { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { read, utils, writeFile } from 'xlsx';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';
// import { db } from '../lib/firebase';
// import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { getCourses, addCourse, updateCourse, deleteCourse } from '../services/courseService';

interface Course {
  id: number;
  name: string;
  code: string;
  description: string;
  credits: number;
  coefficient: number;
  created_at?: string;
}

interface CourseFormData {
  name: string;
  code: string;
  description: string;
  credits: number;
  coefficient: number;
}

interface FormErrors {
  name?: string;
  code?: string;
  description?: string;
  credits?: string;
  coefficient?: string;
}

interface RowData {
  [key: string]: any;
}

type SortField = 'name' | 'code' | 'description' | 'credits' | 'coefficient';
type SortDirection = 'asc' | 'desc';

export default function Courses() {
  const { can } = usePermissions();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState<CourseFormData>({
    name: '',
    code: '',
    description: '',
    credits: 0,
    coefficient: 1,
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Search and filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const coursesData = await getCourses();
      setCourses(coursesData);
      setError(null);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setError('فشل في تحميل المواد');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'اسم المادة مطلوب';
    }
    
    if (!formData.code.trim()) {
      errors.code = 'رمز المادة مطلوب';
    }
    
    if (formData.credits <= 0) {
      errors.credits = 'الساعات المعتمدة يجب أن تكون أكبر من 0';
    }

    if (formData.coefficient <= 0) {
      errors.coefficient = 'المعامل يجب أن يكون أكبر من 0';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'credits' || name === 'coefficient' ? parseInt(value) || 0 : value
    }));
    // إزالة الخطأ عند تعديل الحقل
    setFormErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      code: course.code,
      description: course.description || '',
      credits: course.credits,
      coefficient: course.coefficient,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingCourse) {
        // تحديث مادة موجودة
        const updatedCourse = await updateCourse(editingCourse.id, formData);
        setCourses(courses.map(c => c.id === editingCourse.id ? updatedCourse : c));
      } else {
        // إضافة مادة جديدة
        const newCourse = await addCourse(formData);
        setCourses([...courses, newCourse]);
      }

      setIsModalOpen(false);
      setFormData({
        name: '',
        code: '',
        description: '',
        credits: 0,
        coefficient: 1
      });
      setEditingCourse(null);
      setFormErrors({});
    } catch (error) {
      console.error('Error saving course:', error);
      setError('فشل في حفظ المادة');
    } finally {
      setIsSubmitting(false);
    }
  };

  // قراءة ملف Excel
  const readExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          if (!e.target || !e.target.result) {
            reject(new Error('فشل قراءة الملف'));
            return;
          }
          
          const data = e.target.result;
          const workbook = read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = utils.sheet_to_json(worksheet);
          
          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = (err) => {
        reject(err);
      };
      
      reader.readAsArrayBuffer(file);
    });
  };

  // تصدير إلى Excel
  const handleExport = () => {
    const worksheet = utils.json_to_sheet(courses.map(course => ({
      'Name': course.name,
      'Code': course.code,
      'Description': course.description || '',
      'Credits': course.credits,
      'Coefficient': course.coefficient
    })));

    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Courses');
    writeFile(workbook, 'courses.xlsx');
  };

  // استيراد من Excel
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setUploadProgress(10);

    try {
      const jsonData = await readExcelFile(file);
      const total = jsonData.length;
      let importedCount = 0;
      const importedCourses: Course[] = [];

      for (const row of jsonData as RowData[]) {
        try {
          const courseData: CourseFormData = {
            name: String(row['Name'] || ''),
            code: String(row['Code'] || ''),
            description: String(row['Description'] || ''),
            credits: Number(row['Credits']) || 0,
            coefficient: Number(row['Coefficient']) || 1
          };

          // التحقق من البيانات المطلوبة
          if (!courseData.name || !courseData.code) {
            continue;
          }

          const newCourse = await addCourse(courseData);
          importedCourses.push(newCourse);
          importedCount++;
          setUploadProgress(Math.round((importedCount / total) * 90) + 10);
        } catch (err) {
          console.error('Error importing course:', err);
        }
      }

      setCourses([...courses, ...importedCourses]);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 2000);
    } catch (error) {
      console.error('Error importing courses:', error);
      setError('فشل في استيراد المواد');
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('هل أنت متأكد من حذف هذه المادة؟')) {
      try {
        await deleteCourse(id);
        setCourses(courses.filter(c => c.id !== id));
      } catch (error) {
        console.error('Error deleting course:', error);
        setError('فشل في حذف المادة');
      }
    }
  };

  const filteredCourses = useMemo(() => {
    const filtered = courses.filter(course => {
      const name = course.name.toLowerCase();
      const code = course.code.toLowerCase();
      const description = course.description?.toLowerCase() || '';
      const credits = String(course.credits);
      const coefficient = String(course.coefficient);

      return (
        name.includes(searchTerm.toLowerCase()) ||
        code.includes(searchTerm.toLowerCase()) ||
        description.includes(searchTerm.toLowerCase()) ||
        credits.includes(searchTerm.toLowerCase()) ||
        coefficient.includes(searchTerm.toLowerCase())
      );
    });

    return filtered.sort((a, b) => {
      if (sortField === 'name') {
        return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else if (sortField === 'code') {
        return sortDirection === 'asc' ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code);
      } else if (sortField === 'description') {
        return sortDirection === 'asc' ? a.description.localeCompare(b.description) : b.description.localeCompare(a.description);
      } else if (sortField === 'credits') {
        return sortDirection === 'asc' ? a.credits - b.credits : b.credits - a.credits;
      } else if (sortField === 'coefficient') {
        return sortDirection === 'asc' ? a.coefficient - b.coefficient : b.coefficient - a.coefficient;
      }

      return 0;
    });
  }, [courses, searchTerm, sortField, sortDirection]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">المواد الدراسية</h1>
          <p className="mt-2 text-sm text-gray-700">
            قائمة بجميع المواد الدراسية المتاحة
          </p>
        </div>
        {can('create', 'courses') && (
          <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
            >
              إضافة مادة
            </button>
          </div>
        )}
      </div>

      {/* شريط البحث */}
      <div className="mt-4 mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="search"
            value={searchTerm}
            onChange={handleSearch}
            placeholder="ابحث في المواد الدراسية..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {/* أزرار الاستيراد والتصدير */}
      <div className="mt-4 mb-6 flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleExport}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          تصدير إلى Excel
        </button>
        <label className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
          استيراد من Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            className="hidden"
          />
        </label>
        {uploadProgress > 0 && (
          <div className="w-full mt-2">
            <div className="bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{uploadProgress}% uploaded</p>
          </div>
        )}
      </div>

      {/* عرض رسالة الخطأ إن وجدت */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* قائمة المواد */}
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              {loading ? (
                <div className="px-4 py-5 sm:px-6 text-center">
                  جاري التحميل...
                </div>
              ) : filteredCourses.length === 0 ? (
                <div className="px-4 py-5 sm:px-6 text-center">
                  لا توجد مواد دراسية
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        <div className="flex items-center">
                          <span>الاسم</span>
                          <button
                            type="button"
                            onClick={() => handleSort('name')}
                            className="ml-2"
                          >
                            {sortField === 'name' ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )
                            ) : (
                              <Search size={16} />
                            )}
                          </button>
                        </div>
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        <div className="flex items-center">
                          <span>الرمز</span>
                          <button
                            type="button"
                            onClick={() => handleSort('code')}
                            className="ml-2"
                          >
                            {sortField === 'code' ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )
                            ) : (
                              <Search size={16} />
                            )}
                          </button>
                        </div>
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        <div className="flex items-center">
                          <span>الوصف</span>
                          <button
                            type="button"
                            onClick={() => handleSort('description')}
                            className="ml-2"
                          >
                            {sortField === 'description' ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )
                            ) : (
                              <Search size={16} />
                            )}
                          </button>
                        </div>
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        <div className="flex items-center">
                          <span>الساعات</span>
                          <button
                            type="button"
                            onClick={() => handleSort('credits')}
                            className="ml-2"
                          >
                            {sortField === 'credits' ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )
                            ) : (
                              <Search size={16} />
                            )}
                          </button>
                        </div>
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        <div className="flex items-center">
                          <span>المعامل</span>
                          <button
                            type="button"
                            onClick={() => handleSort('coefficient')}
                            className="ml-2"
                          >
                            {sortField === 'coefficient' ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )
                            ) : (
                              <Search size={16} />
                            )}
                          </button>
                        </div>
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredCourses.map((course) => (
                      <tr key={course.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {course.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {course.code}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {course.description}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {course.credits}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {course.coefficient}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          {can('update', 'courses') && (
                            <button
                              onClick={() => handleEdit(course)}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              تعديل
                            </button>
                          )}
                          {can('delete', 'courses') && (
                            <button
                              onClick={() => handleDelete(course.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              حذف
                            </button>
                          )}
                          {!can('update', 'courses') && !can('delete', 'courses') && (
                            <span className="text-gray-400">عرض فقط</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* نافذة إضافة/تعديل المادة */}
      {isModalOpen && (
        <div className="fixed inset-0 overflow-y-auto z-10">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {editingCourse ? 'تعديل المادة' : 'إضافة مادة جديدة'}
                </h3>
                <form onSubmit={handleSubmit} className="mt-5">
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        اسم المادة
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="name"
                          id="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                            formErrors.name ? 'border-red-300' : ''
                          }`}
                        />
                        {formErrors.name && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.name}</p>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                        رمز المادة
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="code"
                          id="code"
                          value={formData.code}
                          onChange={handleInputChange}
                          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                            formErrors.code ? 'border-red-300' : ''
                          }`}
                        />
                        {formErrors.code && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.code}</p>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-6">
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        وصف المادة
                      </label>
                      <div className="mt-1">
                        <textarea
                          name="description"
                          id="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          rows={3}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="credits" className="block text-sm font-medium text-gray-700">
                        الساعات المعتمدة
                      </label>
                      <div className="mt-1">
                        <input
                          type="number"
                          name="credits"
                          id="credits"
                          value={formData.credits}
                          onChange={handleInputChange}
                          min="0"
                          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                            formErrors.credits ? 'border-red-300' : ''
                          }`}
                        />
                        {formErrors.credits && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.credits}</p>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="coefficient" className="block text-sm font-medium text-gray-700">
                        المعامل
                      </label>
                      <div className="mt-1">
                        <input
                          type="number"
                          name="coefficient"
                          id="coefficient"
                          value={formData.coefficient}
                          onChange={handleInputChange}
                          min="0"
                          step="0.1"
                          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                            formErrors.coefficient ? 'border-red-300' : ''
                          }`}
                        />
                        {formErrors.coefficient && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.coefficient}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                    >
                      {isSubmitting ? 'جاري الحفظ...' : editingCourse ? 'حفظ التغييرات' : 'إضافة المادة'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setEditingCourse(null);
                        setFormData({
                          name: '',
                          code: '',
                          description: '',
                          credits: 0,
                          coefficient: 1
                        });
                        setFormErrors({});
                      }}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}