import React, { useState, useEffect, useRef } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { read, utils, writeFile } from 'xlsx';
import { getProfessors, addProfessor, updateProfessor, deleteProfessor, deleteAllProfessors } from '../services/db';

interface Professor {
  id: number;
  first_name: string;
  last_name: string;
  academic_title: string;
  specialization: string;
  weekly_hours?: number; 
  email?: string; 
  phone: string;
  title: string; 
  created_at?: string;
}

interface ProfessorFormData {
  first_name: string;
  last_name: string;
  academic_title: string;
  specialization: string;
  weekly_hours?: number; 
  email?: string; 
  phone: string;
  title: string; 
}

interface FormErrors {
  first_name?: string;
  last_name?: string;
  academic_title?: string;
  specialization?: string;
  weekly_hours?: string;
  email?: string;
  phone?: string;
  title?: string; 
}

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

const exportToExcel = (data: any[], fileName: string) => {
  const formattedData = data.map(item => ({
    'First Name': item.first_name,
    'Last Name': item.last_name,
    'Academic Title': item.academic_title,
    'Title': item.title,  
    'Specialization': item.specialization,
    'Weekly Hours': item.weekly_hours,
    'Email': item.email,
    'Phone': item.phone
  }));
  
  const worksheet = utils.json_to_sheet(formattedData);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, 'Professors');
  writeFile(workbook, `${fileName}.xlsx`);
};

const translateAcademicTitle = (title: string): string => {
  const titleMap: { [key: string]: string } = {
    'Dr': 'د.',
    'Prof.Dr': 'أ.د.',
    'Prof': 'أ.'
  };
  return titleMap[title] || title;
};

const academicTitles = [
  { value: 'Dr', label: 'د.' },
  { value: 'Prof.Dr', label: 'أ.د.' },
  { value: 'Prof', label: 'أ.' }
];

export default function Professors() {
  const { can } = usePermissions();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null);
  const [formData, setFormData] = useState<ProfessorFormData>({
    first_name: '',
    last_name: '',
    academic_title: '',
    specialization: '',
    weekly_hours: 0,
    email: '',
    phone: '',
    title: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfessors();
  }, []);

  const fetchProfessors = async () => {
    setLoading(true);
    try {
      console.log("Récupération des professeurs...");
      const professorsData = await getProfessors();
      console.log("Données brutes des professeurs reçues:", JSON.stringify(professorsData));
      
      const adaptedProfessors: Professor[] = professorsData.map((prof: any) => {
        console.log("Traitement du professeur:", prof);
        const adapted = {
          id: prof.id,
          first_name: prof.first_name || '',
          last_name: prof.last_name || '',
          academic_title: prof.academic_title || '',
          specialization: prof.specialization || '',
          weekly_hours: prof.weekly_hours,
          email: prof.email,
          phone: prof.phone || '',
          title: prof.title || '', 
          created_at: prof.created_at
        };
        console.log("Professeur adapté:", adapted);
        return adapted;
      });
      
      console.log("Tous les professeurs adaptés:", adaptedProfessors);
      setProfessors(adaptedProfessors);
    } catch (error) {
      console.error('Error fetching professors:', error);
      setError('Failed to fetch professors');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;

    if (!formData.first_name.trim()) {
      errors.first_name = 'الاسم الأول مطلوب';
      isValid = false;
    }

    if (!formData.last_name.trim()) {
      errors.last_name = 'الاسم الأخير مطلوب';
      isValid = false;
    }

    if (!formData.academic_title.trim()) {
      errors.academic_title = 'اللقب الأكاديمي مطلوب';
      isValid = false;
    }
    
    // Le champ phone n'est pas validé car il est facultatif
    
    // Valider l'email seulement s'il est fourni
    if (formData.email && formData.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = 'صيغة البريد الإلكتروني غير صحيحة';
        isValid = false;
      }
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      if (editingProfessor) {
        // Update existing professor
        await updateProfessor(editingProfessor.id, formData);
        console.log('Professeur mis à jour avec succès');
      } else {
        // Add new professor
        await addProfessor(formData);
        console.log('Professeur ajouté avec succès');
      }
      
      // Reset form and fetch updated list
      setFormData({
        first_name: '',
        last_name: '',
        academic_title: '',
        specialization: '',
        weekly_hours: 0,
        email: '',
        phone: '',
        title: ''
      });
      setEditingProfessor(null);
      setIsModalOpen(false);
      
      // Force reload of professors data
      await fetchProfessors();
    } catch (err) {
      console.error('Error saving professor:', err);
      setError('Failed to save professor');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (professor: Professor) => {
    setEditingProfessor(professor);
    setFormData({
      first_name: professor.first_name,
      last_name: professor.last_name,
      academic_title: professor.academic_title,
      specialization: professor.specialization,
      weekly_hours: professor.weekly_hours,
      email: professor.email || '',
      phone: professor.phone || '',
      title: professor.title || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (professor: Professor) => {
    if (window.confirm(`Are you sure you want to delete ${professor.first_name} ${professor.last_name}?`)) {
      try {
        await deleteProfessor(professor.id);
        // Force reload of professors data
        await fetchProfessors();
      } catch (err) {
        console.error('Error deleting professor:', err);
        setError('Failed to delete professor');
      }
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm('Are you sure you want to delete ALL professors? This action cannot be undone!')) {
      try {
        setLoading(true);
        await deleteAllProfessors();
        // Reload the empty list
        await fetchProfessors();
        setError(null);
      } catch (err) {
        console.error('Error deleting all professors:', err);
        setError('Failed to delete all professors');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'weekly_hours' ? Number(value) : value
    }));
    setFormErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    if (!e.target.files || e.target.files.length === 0) {
      console.log('No file selected');
      return;
    }
    
    const file = e.target.files[0];
    console.log('Selected file:', file.name);
    
    try {
      const data = await readExcelFile(file);
      console.log('Excel data:', data);
      
      if (data.length === 0) {
        alert('ملف فارغ أو لا يحتوي على بيانات صالحة');
        return;
      }
      
      await handleImport(data);
      
    } catch (err) {
      console.error('Error processing file:', err);
      alert(`فشل في معالجة الملف: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    }
  };

  const handleExportTemplate = () => {
    const template = [
      {
        'First Name': 'أحمد',
        'Last Name': 'محمد',
        'Academic Title': 'Dr',
        'Title': 'أستاذ مساعد', 
        'Specialization': 'هندسة برمجيات',
        'Weekly Hours': 12,
        'Email': 'ahmed@example.com',
        'Phone': '012345678'
      }
    ];

    exportToExcel(template, 'professors-template');
  };

  const handleExportData = () => {
    exportToExcel(professors, 'professors-data');
  };

  const handleImport = async (data: any[]) => {
    setUploadProgress(0);
    setUploadError(null);
    
    try {
      console.log('Raw import data:', data);
      
      if (data.length === 0) {
        setUploadError('No data found in the file');
        return;
      }
      
      // Show progress
      setUploadProgress(10);
      
      const total = data.length;
      let processed = 0;
      
      // Process each row
      for (const row of data) {
        console.log('Processing row:', row);
        
        // Handle different possible column headers
        const firstName = row['First Name'] || row['FirstName'] || row['first_name'] || row['first name'] || row['Nom'] || '';
        const lastName = row['Last Name'] || row['LastName'] || row['last_name'] || row['last name'] || row['Prénom'] || '';
        
        let academicTitle = row['Academic Title'] || row['AcademicTitle'] || row['academic_title'] || row['academic title'] || '';
        let title = row['Title'] || row['title'] || '';
        let phone = row['Phone'] || row['phone'] || '';
        
        const email = row['Email'] || row['email'] || '';
        const specialization = row['Specialization'] || row['specialization'] || '';
        const weeklyHours = row['Weekly Hours'] || row['WeeklyHours'] || row['weekly_hours'] || row['weekly hours'] || 0;
        
        // Map arabic academic titles to their English counterparts if necessary
        if (academicTitle === 'د.') academicTitle = 'Dr';
        else if (academicTitle === 'أ.د.') academicTitle = 'Prof.Dr';
        else if (academicTitle === 'أ.') academicTitle = 'Prof';
        
        // Skip empty rows
        if (!firstName && !lastName) {
          processed++;
          setUploadProgress(Math.floor((processed / total) * 90)); // 90% is for processing
          continue;
        }
        
        // Create the professor object
        const professor: ProfessorFormData = {
          first_name: firstName,
          last_name: lastName,
          academic_title: academicTitle,
          specialization: specialization,
          weekly_hours: typeof weeklyHours === 'number' ? weeklyHours : parseFloat(weeklyHours) || 0,
          email: email || undefined,
          phone: phone,
          title: title
        };
        
        console.log('Adding professor:', professor);
        
        try {
          await addProfessor(professor);
        } catch (err) {
          console.error('Error adding professor during import:', err);
          // Continue with next record even if this one failed
        }
        
        processed++;
        setUploadProgress(Math.floor((processed / total) * 90)); // 90% is for processing
      }
      
      // Final update
      setUploadProgress(100);
      
      // Refresh the list
      await fetchProfessors();
      
    } catch (err) {
      console.error('Error during import:', err);
      setUploadError('Failed to import data');
      setUploadProgress(0);
    }
  };

  const filteredProfessors = professors.filter(prof => {
    const searchTermLower = searchTerm.toLowerCase();
    const fullName = `${prof.first_name} ${prof.last_name}`.toLowerCase();
    return (
      fullName.includes(searchTermLower) ||
      prof.academic_title.toLowerCase().includes(searchTermLower) ||
      prof.specialization.toLowerCase().includes(searchTermLower) ||
      (prof.email && prof.email.toLowerCase().includes(searchTermLower)) ||
      prof.phone.toLowerCase().includes(searchTermLower) ||
      prof.title.toLowerCase().includes(searchTermLower) 
    );
  });

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
          Professors
        </h1>
        <div>
          {can('delete', 'professors') && (
            <button
              onClick={handleDeleteAll}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Delete All
            </button>
          )}
          {can('create', 'professors') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="ml-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Add Professor
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 mb-6 flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleExportTemplate}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Download Template
        </button>
        <button
          onClick={handleExportData}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Export to Excel
        </button>
        <label className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
          Import from Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
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
        {uploadError && (
          <div className="text-red-500 text-sm mt-1">{uploadError}</div>
        )}
      </div>

      <div className="mt-6 mb-4">
        <label htmlFor="professor-search" className="block text-sm font-medium text-gray-700">
          Rechercher un professeur :
        </label>
        <input
          ref={searchInputRef}
          type="text"
          id="professor-search"
          name="professor-search"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
          placeholder="Entrez nom, titre, spécialisation, email, téléphone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

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

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              {loading ? (
                <div className="bg-white px-4 py-5 border-b border-gray-200 sm:px-6 text-center">
                  Loading professors...
                </div>
              ) : filteredProfessors.length === 0 ? (
                <div className="bg-white px-4 py-5 border-b border-gray-200 sm:px-6 text-center">
                  {searchTerm ? 'Aucun professeur trouvé pour votre recherche.' : 'No professors found.'}
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Title</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Academic Title</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Specialization</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Phone</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Hours</th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredProfessors.map((professor) => (
                      <tr key={professor.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {professor.first_name} {professor.last_name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {professor.title}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {translateAcademicTitle(professor.academic_title)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {professor.specialization}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {professor.email}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {professor.phone}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {professor.weekly_hours}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          {can('update', 'professors') && (
                            <button
                              onClick={() => handleEdit(professor)}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              Edit
                            </button>
                          )}
                          {can('delete', 'professors') && (
                            <button
                              onClick={() => handleDelete(professor)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          )}
                          {!can('update', 'professors') && !can('delete', 'professors') && (
                            <span className="text-gray-400">View Only</span>
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

      {isModalOpen && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {editingProfessor ? 'Edit Professor' : 'Add New Professor'}
                </h3>
                <form onSubmit={handleSubmit} className="mt-5">
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                        First name
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="first_name"
                          id="first_name"
                          value={formData.first_name}
                          onChange={handleInputChange}
                          autoComplete="given-name"
                          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                            formErrors.first_name ? 'border-red-300' : ''
                          }`}
                        />
                        {formErrors.first_name && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.first_name}</p>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                        Last name
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="last_name"
                          id="last_name"
                          value={formData.last_name}
                          onChange={handleInputChange}
                          autoComplete="family-name"
                          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                            formErrors.last_name ? 'border-red-300' : ''
                          }`}
                        />
                        {formErrors.last_name && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.last_name}</p>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="academic_title" className="block text-sm font-medium text-gray-700">
                        Academic Title
                      </label>
                      <div className="mt-1">
                        <select
                          id="academic_title"
                          name="academic_title"
                          value={formData.academic_title}
                          onChange={handleInputChange}
                          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                            formErrors.academic_title ? 'border-red-300' : ''
                          }`}
                        >
                          <option value="">Select a title</option>
                          {academicTitles.map(title => (
                            <option key={title.value} value={title.value}>
                              {title.label}
                            </option>
                          ))}
                        </select>
                        {formErrors.academic_title && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.academic_title}</p>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                        العنوان الوظيفي (Title)
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="title"
                          id="title"
                          value={formData.title}
                          onChange={handleInputChange}
                          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                            formErrors.title ? 'border-red-300' : ''
                          }`}
                        />
                        {formErrors.title && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.title}</p>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="specialization" className="block text-sm font-medium text-gray-700">
                        Specialization
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="specialization"
                          id="specialization"
                          value={formData.specialization}
                          onChange={handleInputChange}
                          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                            formErrors.specialization ? 'border-red-300' : ''
                          }`}
                        />
                        {formErrors.specialization && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.specialization}</p>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="weekly_hours" className="block text-sm font-medium text-gray-700">
                        Weekly Hours
                      </label>
                      <div className="mt-1">
                        <input
                          type="number"
                          name="weekly_hours"
                          id="weekly_hours"
                          value={formData.weekly_hours}
                          onChange={handleInputChange}
                          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                            formErrors.weekly_hours ? 'border-red-300' : ''
                          }`}
                          min="0"
                        />
                        {formErrors.weekly_hours && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.weekly_hours}</p>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <div className="mt-1">
                        <input
                          type="email"
                          name="email"
                          id="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          autoComplete="email"
                          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                            formErrors.email ? 'border-red-300' : ''
                          }`}
                        />
                        {formErrors.email && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.email}</p>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                        Phone
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="phone"
                          id="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          autoComplete="tel"
                          placeholder="123-456-7890"
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
                    >
                      {editingProfessor ? 'Save Changes' : 'Add Professor'}
                    </button>
                    <button
                      type="button"
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                      onClick={() => {
                        setIsModalOpen(false);
                        setEditingProfessor(null);
                        setFormData({
                          first_name: '',
                          last_name: '',
                          academic_title: '',
                          specialization: '',
                          weekly_hours: 0,
                          email: '',
                          phone: '',
                          title: ''
                        });
                        setFormErrors({});
                      }}
                    >
                      Cancel
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