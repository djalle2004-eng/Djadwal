import { Group, GroupFormData } from '../types/shared';

/**
 * جلب كل المجموعات من قاعدة البيانات
 */
export const getGroups = async (): Promise<Group[]> => {
  try {
    // التحقق من وجود window.db
    if (typeof window === 'undefined' || !window.db || typeof window.db.getGroups !== 'function') {
      console.warn('window.db is not available or getGroups is not a function, returning mock data');
      // إرجاع بيانات مثال إذا كان window.db غير موجود
      return [
        {
          id: 1,
          name: 'علوم اقتصادية',
          group_type: 'department'
        },
        {
          id: 2,
          name: 'مجموعة نموذجية 1',
          specialization: 'علوم الحاسوب',
          department_id: 1,
          group_type: 'specialization'
        },
        {
          id: 3,
          name: 'الفوج 1 - علوم الحاسوب',
          specialization: 'علوم الحاسوب',
          parent_group_id: 2,
          department_id: 1,
          group_type: 'group',
          year: 'L2'
        }
      ];
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const groups = await window.db.getGroups();
    
    // تحويل البيانات من النموذج الأساسي إلى نموذج المجموعات الكامل
    return groups.map((group: any) => {
      return {
        id: group.id,
        name: group.name,
        specialization: group.specialization || '',
        parent_group_id: group.parent_group_id || null,
        department_id: group.department_id || null,
        department_name: group.department_name || '',
        group_type: group.group_type || 'group',
        year: group.year || '',
        created_at: group.created_at
      };
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    throw error;
  }
};

/**
 * جلب المجموعات حسب القسم
 */
export const getGroupsByDepartment = async (departmentId: number): Promise<Group[]> => {
  try {
    const allGroups = await getGroups();
    return allGroups.filter(group => group.department_id === departmentId);
  } catch (error) {
    console.error(`Error fetching groups for department ${departmentId}:`, error);
    throw error;
  }
};

/**
 * جلب المجموعات حسب التخصص (بالاسم)
 */
export const getGroupsBySpecialization = async (specialization: string): Promise<Group[]> => {
  try {
    const allGroups = await getGroups();
    return allGroups.filter(group => 
      group.specialization === specialization && 
      group.group_type === 'group'
    );
  } catch (error) {
    console.error(`Error fetching groups for specialization ${specialization}:`, error);
    throw error;
  }
};

/**
 * جلب المجموعات حسب ID التخصص
 */
export const getGroupsBySpecializationId = async (specializationId: number): Promise<Group[]> => {
  try {
    const allGroups = await getGroups();
    // البحث عن التخصص بالـ ID
    const specializationGroup = allGroups.find(g => g.id === specializationId && g.group_type === 'specialization');
    
    if (!specializationGroup) {
      console.warn(`No specialization found with ID ${specializationId}`);
      return [];
    }
    
    // إرجاع الأفواج التي تنتمي لهذا التخصص
    return allGroups.filter(group => 
      group.specialization === specializationGroup.name && 
      group.group_type === 'group'
    );
  } catch (error) {
    console.error(`Error fetching groups for specialization ID ${specializationId}:`, error);
    throw error;
  }
};

/**
 * جلب التخصصات حسب القسم
 */
export const getSpecializationsByDepartment = async (departmentId: number): Promise<Group[]> => {
  try {
    const allGroups = await getGroups();
    return allGroups.filter(group => 
      group.department_id === departmentId && 
      group.group_type === 'specialization'
    );
  } catch (error) {
    console.error(`Error fetching specializations for department ${departmentId}:`, error);
    throw error;
  }
};

/**
 * بناء الهيكل الشجري للمجموعات
 * يمكن تحديد departmentId لإظهار مجموعات قسم معين فقط
 */
export const buildGroupTree = (groups: Group[], departmentId?: number): Group[] => {
  // تصفية المجموعات حسب القسم إذا تم تحديده
  const filteredGroups = departmentId 
    ? groups.filter(g => g.department_id === departmentId)
    : groups;
    
  // نسخة من المجموعات للعمل عليها
  const groupsWithChildren = filteredGroups.map(g => ({ ...g, children: [] as Group[] }));
  
  // تصنيف المجموعات حسب النوع
  const departments = groupsWithChildren.filter(g => g.group_type === 'department');
  const specializations = groupsWithChildren.filter(g => g.group_type === 'specialization');
  const regularGroups = groupsWithChildren.filter(g => g.group_type === 'group' || g.group_type === 'lecture_group');
  
  // إنشاء قاموس للوصول السريع للمجموعات بواسطة المعرف
  const groupMap: Record<number, Group> = {};
  groupsWithChildren.forEach(g => {
    groupMap[g.id] = g;
  });

  // ربط المجموعات العادية بالتخصصات
  regularGroups.forEach(group => {
    if (group.parent_group_id && groupMap[group.parent_group_id]) {
      // إضافة المجموعة كطفل للمجموعة الأب (التخصص)
      if (!groupMap[group.parent_group_id].children) {
        groupMap[group.parent_group_id].children = [];
      }
      groupMap[group.parent_group_id].children!.push(group);
    }
  });

  // ربط التخصصات بالأقسام
  specializations.forEach(spec => {
    if (spec.department_id && departments.some(d => d.id === spec.department_id)) {
      const department = departments.find(d => d.id === spec.department_id);
      if (department) {
        if (!department.children) {
          department.children = [];
        }
        department.children.push(spec);
      }
    }
  });

  // إذا تم تحديد قسم، نعيد التخصصات المرتبطة به فقط
  if (departmentId) {
    return specializations.filter(s => s.department_id === departmentId);
  }

  // إرجاع الأقسام كجذور للشجرة، أو المجموعات التي ليس لها أب إذا لم تكن هناك أقسام
  return departments.length > 0 
    ? departments 
    : groupsWithChildren.filter(g => !g.parent_group_id && !departments.some(d => d.id === g.department_id));
};

/**
 * إضافة مجموعة جديدة
 */
export const addGroup = async (groupData: GroupFormData): Promise<Group> => {
  try {
    const { name, specialization, parent_group_id, department_id, group_type, year } = groupData;
    
    if (typeof window === 'undefined' || !window.db || typeof window.db.addGroup !== 'function') {
      console.warn('window.db is not available or addGroup is not a function');
      throw new Error('قاعدة البيانات غير متاحة');
    }
    
    // Convert department_id to number or undefined
    const departmentId = department_id ? Number(department_id) : undefined;
    
    // Convert parent_group_id to number or undefined
    const parentGroupId = parent_group_id ? Number(parent_group_id) : undefined;
    
    console.log('Adding group with data:', {
      name,
      specialization: specialization || '',
      parentGroupId,
      departmentId,
      group_type: group_type || 'group',
      year: year || ''
    });
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const newGroup = await window.db.addGroup(
      name, 
      specialization || '', 
      parentGroupId, 
      departmentId, 
      group_type || 'group', 
      year || ''
    );
    
    console.log('New group created:', newGroup);
    
    // إرجاع المجموعة الجديدة مع البيانات الكاملة
    return {
      id: newGroup.id,
      name,
      specialization: specialization || '',
      parent_group_id: parentGroupId,
      department_id: departmentId,
      group_type: group_type || 'group',
      year: year || '',
      created_at: newGroup.created_at
    };
  } catch (error) {
    console.error('Error adding group:', error);
    throw error;
  }
};

/**
 * تحديث بيانات مجموعة موجودة
 */
export const updateGroup = async (id: number, groupData: Partial<GroupFormData>): Promise<Group> => {
  try {
    // التحقق من وجود معرف صالح
    if (id === null || id === undefined) {
      throw new Error('Group ID is required for updating');
    }

    console.log(`بدء تحديث المجموعة بالمعرف: ${id}`);
    
    // الحصول على بيانات المجموعة الحالية
    const groups = await getGroups();
    console.log(`تم استرجاع ${groups.length} مجموعة، البحث عن المجموعة بالمعرف: ${id}`);
    
    const currentGroup = groups.find(g => g.id === id);
    
    if (!currentGroup) {
      console.error(`لم يتم العثور على المجموعة بالمعرف: ${id}`);
      console.log('المجموعات الموجودة:', groups.map(g => ({ id: g.id, name: g.name })));
      throw new Error(`Group with id ${id} not found`);
    }
    
    console.log(`تم العثور على المجموعة: ${currentGroup.name}`);
    
    // تحديث البيانات
    const updatedData = { ...currentGroup, ...groupData };
    const { name, specialization, parent_group_id, department_id, group_type, year } = updatedData;
    
    // Convert department_id to number or undefined
    const departmentId = department_id ? Number(department_id) : undefined;
    
    // Convert parent_group_id to number or undefined
    const parentGroupId = parent_group_id ? Number(parent_group_id) : undefined;
    
    if (typeof window === 'undefined' || !window.db || typeof window.db.updateGroup !== 'function') {
      console.warn('window.db is not available or updateGroup is not a function');
      throw new Error('قاعدة البيانات غير متاحة');
    }
    
    console.log(`تحديث المجموعة في قاعدة البيانات:
     - ID: ${id}
     - Name: ${name}
     - Specialization: ${specialization || ''}
     - Parent Group ID: ${parentGroupId}
     - Department ID: ${departmentId}
     - Group Type: ${group_type || 'group'}
     - Year: ${year || ''}`);
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const result = await window.db.updateGroup(
      id, 
      name, 
      specialization || '', 
      parentGroupId, 
      departmentId, 
      group_type || 'group', 
      year || ''
    );
    
    console.log(`تم تحديث المجموعة بنجاح: ID=${id}, النتيجة:`, result);
    
    // إرجاع البيانات المحدثة
    return {
      ...currentGroup,
      ...groupData,
      id
    };
  } catch (error) {
    console.error('Error updating group:', error);
    throw error;
  }
};

/**
 * حذف مجموعة من قاعدة البيانات
 */
export const deleteGroup = async (id: number): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db || typeof window.db.deleteGroup !== 'function') {
      console.warn('window.db is not available or deleteGroup is not a function');
      throw new Error('قاعدة البيانات غير متاحة');
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.deleteGroup(id);
  } catch (error) {
    console.error('Error deleting group:', error);
    throw error;
  }
};

/**
 * حذف كل المجموعات من قاعدة البيانات
 */
export const deleteAllGroups = async (): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db || typeof window.db.deleteAllGroups !== 'function') {
      console.warn('window.db is not available or deleteAllGroups is not a function');
      throw new Error('قاعدة البيانات غير متاحة');
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.deleteAllGroups();
  } catch (error) {
    console.error('Error deleting all groups:', error);
    throw error;
  }
};