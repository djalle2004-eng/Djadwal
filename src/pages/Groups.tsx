import React, { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { read, utils, writeFile } from 'xlsx';
import { getGroups, addGroup, updateGroup, deleteGroup, buildGroupTree, getSpecializationsByDepartment } from '../services/groupService';
import { getDepartments } from '../services/departmentService';
import { Department, Group, GroupFormData, FormErrors } from '../types/shared';
import { useAcademicYear } from '../context/AcademicYearContext';

interface RowData {
  [key: string]: any;
}

// Interface for specialized form data
interface SpecializationFormData {
  name: string;
  groupCount: number;
  departmentId: string | number;
  year: string;
  useExistingSpecialization: boolean;
  selectedSpecializationId?: number;
}

export default function Groups() {
  const { can } = usePermissions();
  const [groups, setGroups] = useState<Group[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutomatedModalOpen, setIsAutomatedModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState<GroupFormData>({
    name: '',
    year: 'L1',
    specialization: '',
    group_type: 'group',
    department_id: undefined,
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [autoFormErrors, setAutoFormErrors] = useState<FormErrors>({});
  const [specializationData, setSpecializationData] = useState<SpecializationFormData>({
    name: '',
    groupCount: 1,
    departmentId: '',
    year: 'L1',
    useExistingSpecialization: false
  });
  const [departmentSpecializations, setDepartmentSpecializations] = useState<Group[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: string } | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<number>>(new Set());

  const { currentYear } = useAcademicYear();

  // Debug logging
  useEffect(() => {
    console.log('[Groups] Current year:', currentYear);
    console.log('[Groups] All groups:', groups);
    console.log('[Groups] Groups years:', groups.map(g => g.year));
  }, [currentYear, groups]);

  // Filter groups by current academic year with fallback
  const currentYearGroups = useMemo(() => {
    if (!currentYear) {
      console.log('[Groups] No current year set, showing all groups');
      return groups;
    }
    
    const filtered = groups.filter(group => {
      const matches = group.year === currentYear.year_name;
      if (!matches) {
        console.log(`[Groups] Group "${group.name}" year "${group.year}" doesn't match current year "${currentYear.year_name}"`);
      }
      return matches;
    });
    
    console.log(`[Groups] Filtered ${filtered.length} groups out of ${groups.length} for year "${currentYear.year_name}"`);
    
    // If no groups match current year, show all groups as fallback
    if (filtered.length === 0 && groups.length > 0) {
      console.log('[Groups] No groups found for current year, showing all groups as fallback');
      return groups;
    }
    
    return filtered;
  }, [groups, currentYear]);

  const sortedGroups = useMemo(() => {
    let sortableGroups = [...currentYearGroups];
    if (sortConfig !== null) {
      sortableGroups.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? '';
        const bValue = b[sortConfig.key] ?? '';

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableGroups;
  }, [currentYearGroups, sortConfig]);

  // Detect duplicates based on name, specialization, and year (only for current year)
  const duplicateGroups = useMemo(() => {
    const groupMap = new Map<string, Group[]>();
    
    currentYearGroups.forEach(group => {
      // Create a key based on name, specialization, year, and group_type
      const key = `${group.name?.toLowerCase()}-${group.specialization?.toLowerCase()}-${group.year}-${group.group_type}`;
      
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(group);
    });

    // Return only groups that have duplicates
    const duplicates: Group[] = [];
    groupMap.forEach((groupList) => {
      if (groupList.length > 1) {
        duplicates.push(...groupList);
      }
    });

    return duplicates;
  }, [currentYearGroups]);

  // Toggle duplicate selection
  const toggleDuplicateSelection = (groupId: number) => {
    const newSelected = new Set(selectedDuplicates);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedDuplicates(newSelected);
  };

  // Select all duplicates
  const selectAllDuplicates = () => {
    const allDuplicateIds = new Set(duplicateGroups.map(g => g.id).filter(id => id !== undefined));
    setSelectedDuplicates(allDuplicateIds);
  };

  // Clear duplicate selection
  const clearDuplicateSelection = () => {
    setSelectedDuplicates(new Set());
  };

  // Delete selected duplicates
  const deleteSelectedDuplicates = async () => {
    if (selectedDuplicates.size === 0) return;

    const confirmMessage = `هل أنت متأكد من حذف ${selectedDuplicates.size} مجموعة مكررة؟`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const deletePromises = Array.from(selectedDuplicates).map(id => deleteGroup(id));
      await Promise.all(deletePromises);
      
      // Refresh groups list
      const updatedGroups = await getGroups();
      setGroups(updatedGroups);
      setSelectedDuplicates(new Set());
      setError(null);
    } catch (error) {
      console.error('Error deleting duplicates:', error);
      setError('فشل في حذف المجموعات المكررة');
    }
  };

  const handleSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const fetchedGroups = await getGroups();
        const fetchedDepartments = await getDepartments();
        setGroups(fetchedGroups);
        setDepartments(fetchedDepartments);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('فشل في تحميل البيانات');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const normalizeYear = (year: unknown): string => {
    const normalized = String(year).trim().toUpperCase();
    return normalized;
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'اسم المجموعة مطلوب';
    }

    const validYears = ['L1', 'L2', 'L3', 'M1', 'M2'];
    if (formData.year && !validYears.includes(normalizeYear(formData.year))) {
      errors.year = 'السنة يجب أن تكون إحدى القيم التالية: ' + validYears.join(', ');
    }

    if (formData.group_type === 'group' && (!formData.specialization || !formData.specialization.trim())) {
      errors.specialization = 'التخصص مطلوب للأفواج';
    }

    if (formData.group_type === 'specialization' && (!formData.department_id)) {
      errors.department_id = 'اختيار القسم مطلوب للتخصصات';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setFormErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleEdit = (group: Group) => {
    console.log('تعديل المجموعة:', group);
    if (group.id === undefined || group.id === null) {
      console.error('خطأ: معرف المجموعة غير محدد', group);
      setError('خطأ: لا يمكن تعديل هذه المجموعة لأن المعرف غير محدد');
      return;
    }

    console.log('المعرف الصحيح للمجموعة:', group.id, typeof group.id);
    setEditingGroup(group);
    setFormData({
      name: group.name,
      year: group.year,
      specialization: group.specialization,
      department_id: group.department_id,
      parent_group_id: group.parent_group_id,
      group_type: group.group_type || 'group',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare form data with proper type conversions
      const processedFormData: GroupFormData = {
        ...formData,
        department_id: formData.department_id ? Number(formData.department_id) : undefined,
        parent_group_id: formData.parent_group_id ? Number(formData.parent_group_id) : undefined,
        specialization: formData.specialization || '',
        group_type: formData.group_type || 'group',
        year: formData.year || ''
      };

      console.log('Processed form data:', processedFormData);

      if (editingGroup) {
        // تأكد من أن المعرف موجود
        if (editingGroup.id === undefined || editingGroup.id === null) {
          throw new Error('معرف المجموعة غير محدد');
        }
        
        console.log('جاري تحديث المجموعة بالمعرف:', editingGroup.id, typeof editingGroup.id);
        
        // تحديث مجموعة موجودة
        const updatedGroup = await updateGroup(editingGroup.id, processedFormData);
        console.log('تم تحديث المجموعة:', updatedGroup);
        setGroups(groups.map(g => g.id === editingGroup.id ? updatedGroup : g));
      } else {
        // إضافة مجموعة جديدة
        const newGroup = await addGroup(processedFormData);
        console.log('تم إضافة مجموعة جديدة:', newGroup);
        setGroups([...groups, newGroup]);
      }

      setIsModalOpen(false);
      setFormData({
        name: '',
        year: 'L1',
        specialization: '',
        group_type: 'group',
        department_id: undefined,
      });
      setEditingGroup(null);
      setFormErrors({});
    } catch (error) {
      console.error('Error saving group:', error);
      setError(`فشل في ${editingGroup ? 'تحديث' : 'إضافة'} المجموعة: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('هل أنت متأكد من حذف هذه المجموعة؟')) {
      try {
        console.log(`[Groups UI] محاولة حذف المجموعة ${id}`);
        await deleteGroup(id);
        
        // Always refresh the groups list after deletion attempt
        console.log(`[Groups UI] تحديث قائمة المجموعات بعد محاولة الحذف`);
        const updatedGroups = await getGroups();
        setGroups(updatedGroups);
        setError(null);
        
        console.log(`[Groups UI] تم تحديث القائمة - العدد الجديد: ${updatedGroups.length}`);
      } catch (error) {
        console.error('Error deleting group:', error);
        setError('فشل في حذف المجموعة');
        
        // Refresh groups list even on error to sync UI with database
        try {
          const updatedGroups = await getGroups();
          setGroups(updatedGroups);
          console.log(`[Groups UI] تم تحديث القائمة بعد الخطأ - العدد: ${updatedGroups.length}`);
        } catch (refreshError) {
          console.error('Error refreshing groups after failed deletion:', refreshError);
        }
      }
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
    const worksheet = utils.json_to_sheet(groups.map(group => ({
      'Name': group.name,
      'Year': group.year,
      'Specialization': group.specialization,
    })));

    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Groups');
    writeFile(workbook, 'groups.xlsx');
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
      const importedGroups: Group[] = [];

      for (const row of jsonData as RowData[]) {
        try {
          const groupData: GroupFormData = {
            name: String(row['Name'] || '').trim(),
            year: normalizeYear(row['Year']) || 'L1',
            specialization: String(row['Specialization'] || '').trim(),
          };

          // التحقق من البيانات المطلوبة
          if (!groupData.name || !groupData.specialization) {
            continue;
          }

          const newGroup = await addGroup(groupData);
          importedGroups.push(newGroup);
          importedCount++;
          setUploadProgress(Math.round((importedCount / total) * 90) + 10);
        } catch (err) {
          console.error('Error importing group:', err);
        }
      }

      setGroups([...groups, ...importedGroups]);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 2000);
    } catch (error) {
      console.error('Error importing groups:', error);
      setError('فشل في استيراد المجموعات');
      setUploadProgress(0);
    }
  };

  // التحقق من صحة نموذج إنشاء الأفواج
  const validateAutoForm = (): boolean => {
    const errors: { name?: string, groupCount?: string, departmentId?: string, year?: string } = {};

    if (!specializationData.departmentId) {
      errors.departmentId = 'اختيار القسم مطلوب';
    }

    if (!specializationData.useExistingSpecialization && !specializationData.name.trim()) {
      errors.name = 'اسم التخصص مطلوب';
    }

    if (specializationData.useExistingSpecialization && !specializationData.selectedSpecializationId) {
      errors.name = 'اختيار التخصص مطلوب';
    }

    if (specializationData.groupCount < 1) {
      errors.groupCount = 'يجب أن يكون عدد الأفواج 1 على الأقل';
    }

    if (!specializationData.year) {
      errors.year = 'اختيار السنة الدراسية مطلوب';
    }

    setAutoFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // معالجة تغيير المدخلات في نموذج إنشاء الأفواج
  const handleAutoInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log(`حقل التخصص - تغيير في ${name}: "${value}"`);

    setSpecializationData(prev => {
      const newData = {
        ...prev,
        [name]: name === 'groupCount' ? parseInt(value) || 0 : 
                name === 'useExistingSpecialization' ? value === 'true' : value
      };
      console.log('بيانات التخصص الجديدة:', newData);
      return newData;
    });

    setAutoFormErrors(prev => ({ ...prev, [name]: undefined }));
  };

  // معالجة تغيير القسم في نموذج إنشاء الأفواج
  const handleDepartmentChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    
    setSpecializationData(prev => ({
      ...prev,
      departmentId: value,
      selectedSpecializationId: undefined
    }));
    
    setAutoFormErrors(prev => ({ ...prev, departmentId: undefined }));
    
    // جلب التخصصات الموجودة للقسم المحدد
    if (value) {
      try {
        const specializations = await getSpecializationsByDepartment(parseInt(value));
        setDepartmentSpecializations(specializations);
      } catch (error) {
        console.error('Error fetching specializations:', error);
        setDepartmentSpecializations([]);
      }
    } else {
      setDepartmentSpecializations([]);
    }
  };

  // معالجة تغيير التخصص المحدد
  const handleSpecializationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    const selectedSpecialization = departmentSpecializations.find(s => s.id === parseInt(value));
    
    setSpecializationData(prev => ({
      ...prev,
      selectedSpecializationId: parseInt(value),
      name: selectedSpecialization?.name || prev.name
    }));
  };

  // إنشاء الأفواج آلياً
  const handleCreateGroups = async () => {
    if (!validateAutoForm()) {
      return;
    }

    setIsAutoSubmitting(true);

    try {
      const departmentId = parseInt(specializationData.departmentId.toString());
      const selectedDepartment = departments.find(d => d.id === departmentId);
      if (!selectedDepartment) throw new Error('لم يتم العثور على القسم');

      let specializationGroup: Group;
      
      // استخدام تخصص موجود أو إنشاء تخصص جديد
      if (specializationData.useExistingSpecialization && specializationData.selectedSpecializationId) {
        // استخدام تخصص موجود
        const existingSpecialization = departmentSpecializations.find(
          s => s.id === specializationData.selectedSpecializationId
        );
        
        if (!existingSpecialization) {
          throw new Error('لم يتم العثور على التخصص المحدد');
        }
        
        specializationGroup = existingSpecialization;
      } else {
        // إنشاء مجموعة تخصص جديدة
        specializationGroup = await addGroup({
          name: specializationData.name,
          specialization: specializationData.name,
          department_id: departmentId,
          group_type: 'specialization',
          year: specializationData.year
        });
      }

      // إنشاء الأفواج
      for (let i = 1; i <= specializationData.groupCount; i++) {
        const groupName = `الفوج ${i} - ${specializationGroup.name}`;
        await addGroup({
          name: groupName,
          specialization: specializationGroup.name,
          parent_group_id: specializationGroup.id,
          department_id: departmentId,
          group_type: 'group',
          year: specializationData.year
        });
      }

      // تحديث قائمة المجموعات
      const updatedGroups = await getGroups();
      setGroups(updatedGroups);

      setIsAutomatedModalOpen(false);
      setIsAutoSubmitting(false);
      setSpecializationData({
        name: '',
        groupCount: 1,
        departmentId: '',
        year: 'L1',
        useExistingSpecialization: false
      });
      setAutoFormErrors({});
    } catch (error) {
      console.error('Error creating groups:', error);
      setError(error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء المجموعات');
      setIsAutoSubmitting(false);
    }
  };

  // Build tree structure for current year groups only
  const treeData = useMemo(() => {
    return buildGroupTree(currentYearGroups);
  }, [currentYearGroups]);

  // Generate suggested group name based on existing groups pattern
  const generateSuggestedGroupName = (specialization: Group): string => {
    const existingGroups = groups.filter(g => 
      g.parent_group_id === specialization.id && 
      g.group_type === 'group'
    );
    
    const nextNumber = existingGroups.length + 1;
    return `الفوج ${nextNumber} - ${specialization.name}`;
  };

  // Handle adding new group to existing specialization
  const handleAddGroupToSpecialization = async (specialization: Group) => {
    try {
      const suggestedName = generateSuggestedGroupName(specialization);
      
      const newGroupData: GroupFormData = {
        name: suggestedName,
        specialization: specialization.name,
        parent_group_id: specialization.id,
        department_id: specialization.department_id,
        group_type: 'group',
        year: specialization.year
      };

      const newGroup = await addGroup(newGroupData);
      setGroups([...groups, newGroup]);
    } catch (error) {
      console.error('Error adding group to specialization:', error);
      setError('فشل في إضافة الفوج للتخصص');
    }
  };

  // Render tree view of groups
  const renderTreeNode = (node: Group, level = 0) => {
    const paddingLeft = level * 20; // Increase padding for each level
    const isSpecialization = node.group_type === 'specialization';
    const isGroup = node.group_type === 'group';
    const isLectureGroup = node.group_type === 'lecture_group';

    // Determine background color based on node type
    let bgColor = 'bg-white';
    if (isSpecialization) bgColor = 'bg-blue-50';
    if (isGroup) bgColor = 'bg-green-50';
    if (isLectureGroup) bgColor = 'bg-yellow-50';

    // Use a safe key that handles undefined IDs
    const nodeKey = node.id || `${node.name}-${level}-${Math.random()}`;

    return (
      <div key={nodeKey} className="mb-2">
        <div
          className={`p-3 border rounded-md ${bgColor} flex justify-between items-center`}
          style={{ marginLeft: `${paddingLeft}px` }}
        >
          <div>
            <span className="font-medium">{node.name}</span>
            {node.year && <span className="ml-2 text-sm text-gray-500">({node.year})</span>}
            {isSpecialization && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                تخصص
              </span>
            )}
            {isGroup && (
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                فوج
              </span>
            )}
            {isLectureGroup && (
              <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                فوج محاضرات
              </span>
            )}
          </div>
          <div className="flex space-x-2">
            {isSpecialization && (
              <button
                onClick={() => handleAddGroupToSpecialization(node)}
                className="text-green-600 hover:text-green-900 text-sm"
                title={`إضافة فوج جديد: ${generateSuggestedGroupName(node)}`}
              >
                إضافة فوج
              </button>
            )}
            {can('update', 'groups') && (
              <button
                onClick={() => node.id ? handleEdit(node) : console.warn('Cannot edit group without ID:', node)}
                className="text-indigo-600 hover:text-indigo-900 text-sm mr-2"
                disabled={!node.id}
              >
                تعديل
              </button>
            )}
            {can('delete', 'groups') && (
              <button
                onClick={() => node.id ? handleDelete(node.id) : console.warn('Cannot delete group without ID:', node)}
                className="text-red-600 hover:text-red-900 text-sm mr-2"
                disabled={!node.id}
              >
                حذف
              </button>
            )}
            {!can('update', 'groups') && !can('delete', 'groups') && (
              <span className="text-gray-400 text-sm">عرض فقط</span>
            )}
          </div>
        </div>

        {node.children && node.children.length > 0 && (
          <div className="ml-4">
            {node.children.map((child) => 
              renderTreeNode(child, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">المجموعات</h1>
          <p className="mt-2 text-sm text-gray-700">
            قائمة بجميع المجموعات الدراسية
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex">
          {can('create', 'groups') && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto ml-2"
            >
              إضافة مجموعة
            </button>
          )}
          {can('create', 'groups') && (
            <button
              type="button"
              onClick={() => setIsAutomatedModalOpen(true)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:w-auto"
            >
              إنشاء أفواج آلياً
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowDuplicates(!showDuplicates)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-yellow-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 sm:w-auto"
          >
            {showDuplicates ? 'إخفاء المكررات' : `إظهار المكررات (${duplicateGroups.length})`}
          </button>
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

        {/* Toggle view mode buttons */}
        <div className="ml-auto flex">
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 border text-sm font-medium rounded-l-md ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}
          >
            جدول
          </button>
          <button
            onClick={() => setViewMode('tree')}
            className={`px-4 py-2 border text-sm font-medium rounded-r-md ${viewMode === 'tree' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}
          >
            هيكل شجري
          </button>
        </div>
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

      {/* قائمة المجموعات */}
      <div className="mt-8 flex flex-col">
        {loading ? (
          <div className="px-4 py-5 sm:px-6 text-center">
            جاري التحميل...
          </div>
        ) : groups.length === 0 ? (
          <div className="px-4 py-5 sm:px-6 text-center">
            لا توجد مجموعات
          </div>
        ) : viewMode === 'tree' ? (
          // Tree view display
          <div className="bg-white shadow overflow-hidden sm:rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">هيكل المجموعات</h3>
            <div className="space-y-2">
              {treeData.map(group => renderTreeNode(group))}
            </div>
          </div>
        ) : (
          // Table view display
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 cursor-pointer"
                        onClick={() => handleSort('name')}
                      >
                        الاسم
                        {sortConfig?.key === 'name' && (
                          <span>{sortConfig.direction === 'ascending' ? ' ↑' : ' ↓'}</span>
                        )}
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                        onClick={() => handleSort('year')}
                      >
                        السنة
                        {sortConfig?.key === 'year' && (
                          <span>{sortConfig.direction === 'ascending' ? ' ↑' : ' ↓'}</span>
                        )}
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                        onClick={() => handleSort('specialization')}
                      >
                        التخصص
                        {sortConfig?.key === 'specialization' && (
                          <span>{sortConfig.direction === 'ascending' ? ' ↑' : ' ↓'}</span>
                        )}
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                        onClick={() => handleSort('group_type')}
                      >
                        النوع
                        {sortConfig?.key === 'group_type' && (
                          <span>{sortConfig.direction === 'ascending' ? ' ↑' : ' ↓'}</span>
                        )}
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {sortedGroups.map((group) => (
                      <tr key={group.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {group.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {group.year}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {group.specialization}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {group.group_type === 'specialization' ? 'تخصص' :
                            group.group_type === 'group' ? 'فوج' :
                              group.group_type === 'lecture_group' ? 'فوج محاضرات' :
                                group.group_type}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          {can('update', 'groups') && (
                            <button
                              onClick={() => handleEdit(group)}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              تعديل
                            </button>
                          )}
                          {can('delete', 'groups') && (
                            <button
                              onClick={() => handleDelete(group.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              حذف
                            </button>
                          )}
                          {!can('update', 'groups') && !can('delete', 'groups') && (
                            <span className="text-gray-400">عرض فقط</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Duplicate groups list */}
      {showDuplicates && (
        <div className="mt-8 flex flex-col">
          <h3 className="text-lg font-medium text-gray-900 mb-4">المجموعات المكررة</h3>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg p-4">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                    الاسم
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    السنة
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    التخصص
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    النوع
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {duplicateGroups.map((group) => (
                  <tr key={group.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                      {group.name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {group.year}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {group.specialization}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {group.group_type === 'specialization' ? 'تخصص' :
                        group.group_type === 'group' ? 'فوج' :
                          group.group_type === 'lecture_group' ? 'فوج محاضرات' :
                            group.group_type}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <button
                        onClick={() => toggleDuplicateSelection(group.id)}
                        className={`text-indigo-600 hover:text-indigo-900 mr-4 ${selectedDuplicates.has(group.id) ? 'bg-indigo-100' : ''}`}
                      >
                        {selectedDuplicates.has(group.id) ? 'إلغاء تحديد' : 'تحديد'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end">
              <button
                onClick={selectAllDuplicates}
                className="text-indigo-600 hover:text-indigo-900 mr-4"
              >
                تحديد الكل
              </button>
              <button
                onClick={clearDuplicateSelection}
                className="text-indigo-600 hover:text-indigo-900 mr-4"
              >
                إلغاء التحديد
              </button>
              <button
                onClick={deleteSelectedDuplicates}
                className="text-red-600 hover:text-red-900"
              >
                حذف المحدد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة/تعديل المجموعة */}
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
                  {editingGroup ? 'تعديل المجموعة' : 'إضافة مجموعة جديدة'}
                </h3>
                <form onSubmit={handleSubmit} className="mt-5">
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-6">
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        اسم المجموعة
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
                      <label htmlFor="group_type" className="block text-sm font-medium text-gray-700">
                        نوع المجموعة
                      </label>
                      <div className="mt-1">
                        <select
                          id="group_type"
                          name="group_type"
                          value={formData.group_type}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        >
                          <option value="group">فوج</option>
                          <option value="specialization">تخصص</option>
                          <option value="lecture_group">فوج محاضرات</option>
                        </select>
                      </div>
                    </div>

                    {formData.group_type === 'specialization' && (
                      <div className="sm:col-span-3">
                        <label htmlFor="department_id" className="block text-sm font-medium text-gray-700">
                          القسم
                        </label>
                        <div className="mt-1">
                          <select
                            id="department_id"
                            name="department_id"
                            value={formData.department_id || ''}
                            onChange={handleInputChange}
                            className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                              formErrors.department_id ? 'border-red-300' : ''
                            }`}
                          >
                            <option value="">اختر القسم</option>
                            {departments.map(dept => (
                              <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                          </select>
                          {formErrors.department_id && (
                            <p className="mt-2 text-sm text-red-600">{formErrors.department_id}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {(formData.group_type === 'group' || formData.group_type === 'lecture_group') && (
                      <>
                        <div className="sm:col-span-3">
                          <label htmlFor="parent_group_id" className="block text-sm font-medium text-gray-700">
                            التخصص
                          </label>
                          <div className="mt-1">
                            <select
                              id="parent_group_id"
                              name="parent_group_id"
                              value={formData.parent_group_id || ''}
                              onChange={handleInputChange}
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            >
                              <option value="">اختر التخصص</option>
                              {groups
                                .filter(g => g.group_type === 'specialization')
                                .map(group => (
                                  <option key={group.id} value={group.id}>{group.name}</option>
                                ))
                              }
                            </select>
                          </div>
                        </div>

                        <div className="sm:col-span-3">
                          <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                            السنة الدراسية
                          </label>
                          <div className="mt-1">
                            <select
                              id="year"
                              name="year"
                              value={formData.year || ''}
                              onChange={handleInputChange}
                              className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                                formErrors.year ? 'border-red-300' : ''
                              }`}
                            >
                              <option value="">اختر السنة</option>
                              <option value="L1">L1</option>
                              <option value="L2">L2</option>
                              <option value="L3">L3</option>
                              <option value="M1">M1</option>
                              <option value="M2">M2</option>
                            </select>
                            {formErrors.year && (
                              <p className="mt-2 text-sm text-red-600">{formErrors.year}</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-6 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                    >
                      {isSubmitting ? 'جاري الحفظ...' : editingGroup ? 'حفظ التغييرات' : 'إضافة المجموعة'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setEditingGroup(null);
                        setFormData({
                          name: '',
                          year: 'L1',
                          specialization: '',
                          group_type: 'group',
                          department_id: undefined,
                        });
                        setFormErrors({});
                      }}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
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

      {/* نافذة إنشاء الأفواج آلياً */}
      {isAutomatedModalOpen && (
        <div className="fixed inset-0 overflow-y-auto z-10">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  إنشاء أفواج آلياً
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  سيتم إنشاء مجموعة رئيسية باسم التخصص، ثم إنشاء عدد من الأفواج المرتبطة بها
                </p>

                <form onSubmit={(e) => e.preventDefault()} className="mt-5 space-y-6">
                  <div>
                    <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700">
                      القسم <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="departmentId"
                      name="departmentId"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={specializationData.departmentId}
                      onChange={handleDepartmentChange}
                      required
                    >
                      <option value="">اختر القسم</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                    {autoFormErrors.departmentId && (
                      <p className="mt-2 text-sm text-red-600">{autoFormErrors.departmentId}</p>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      التخصص <span className="text-red-500">*</span>
                    </label>
                    
                    <div className="flex items-center space-x-4 mb-3">
                      <div className="flex items-center">
                        <input
                          id="new-specialization"
                          name="useExistingSpecialization"
                          type="radio"
                          value="false"
                          checked={!specializationData.useExistingSpecialization}
                          onChange={handleAutoInputChange}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <label htmlFor="new-specialization" className="mr-2 block text-sm font-medium text-gray-700">
                          إنشاء تخصص جديد
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="existing-specialization"
                          name="useExistingSpecialization"
                          type="radio"
                          value="true"
                          checked={specializationData.useExistingSpecialization}
                          onChange={handleAutoInputChange}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                          disabled={departmentSpecializations.length === 0}
                        />
                        <label htmlFor="existing-specialization" className="mr-2 block text-sm font-medium text-gray-700">
                          استخدام تخصص موجود
                        </label>
                      </div>
                    </div>
                    
                    {specializationData.useExistingSpecialization ? (
                      <div>
                        <select
                          id="selectedSpecializationId"
                          name="selectedSpecializationId"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          value={specializationData.selectedSpecializationId || ''}
                          onChange={handleSpecializationChange}
                          required
                        >
                          <option value="">اختر التخصص</option>
                          {departmentSpecializations.map((spec) => (
                            <option key={spec.id} value={spec.id}>
                              {spec.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="text"
                          id="auto-name"
                          name="name"
                          dir="rtl"
                          value={specializationData.name}
                          onChange={handleAutoInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="مثال: هندسة معلوماتية"
                          required
                        />
                      </div>
                    )}
                    
                    {autoFormErrors.name && (
                      <p className="mt-2 text-sm text-red-600">{autoFormErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                      السنة الدراسية <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="year"
                      name="year"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={specializationData.year}
                      onChange={handleAutoInputChange}
                      required
                    >
                      <option value="L1">السنة الأولى ليسانس (L1)</option>
                      <option value="L2">السنة الثانية ليسانس (L2)</option>
                      <option value="L3">السنة الثالثة ليسانس (L3)</option>
                      <option value="M1">السنة الأولى ماستر (M1)</option>
                      <option value="M2">السنة الثانية ماستر (M2)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="groupCount" className="block text-sm font-medium text-gray-700">
                      عدد الأفواج <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="groupCount"
                      id="groupCount"
                      min="1"
                      value={specializationData.groupCount}
                      onChange={handleAutoInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                    {autoFormErrors.groupCount && (
                      <p className="mt-2 text-sm text-red-600">{autoFormErrors.groupCount}</p>
                    )}
                  </div>

                  <div className="mt-6 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm"
                      onClick={handleCreateGroups}
                      disabled={isAutoSubmitting}
                    >
                      {isAutoSubmitting ? 'جاري الإنشاء...' : 'إنشاء المجموعات'}
                    </button>
                    <button
                      type="button"
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                      onClick={() => {
                        setIsAutomatedModalOpen(false);
                        setAutoFormErrors({});
                      }}
                      disabled={isAutoSubmitting}
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