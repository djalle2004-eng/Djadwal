import { Department } from '../types/shared';

/**
 * جلب كل الأقسام من قاعدة البيانات
 */
export const getDepartments = async (): Promise<Department[]> => {
  try {
    // التحقق من وجود window.db
    if (typeof window === 'undefined' || !window.db || typeof window.db.getDepartments !== 'function') {
      console.warn('window.db is not available or getDepartments is not a function, returning mock data');
      // إرجاع بيانات مثال إذا كان window.db غير موجود
      return [
        {
          id: 1,
          name: 'علوم اقتصادية',
          code: 'ECO'
        },
        {
          id: 2,
          name: 'علوم التسيير',
          code: 'MGT'
        },
        {
          id: 3,
          name: 'علوم تجارية',
          code: 'COM'
        },
        {
          id: 4,
          name: 'علوم مالية ومحاسبية',
          code: 'FIN'
        },
        {
          id: 5,
          name: 'الجذع المشترك',
          code: 'TC'
        }
      ];
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const departments = await window.db.getDepartments();
    
    // تحويل البيانات من النموذج الأساسي إلى نموذج الأقسام الكامل
    return departments.map((department: any) => {
      return {
        id: department.id,
        name: department.name,
        code: department.code || '',
        created_at: department.created_at
      };
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    // إرجاع بيانات مثال في حالة الخطأ
    return [
      {
        id: 1,
        name: 'علوم اقتصادية',
        code: 'ECO'
      },
      {
        id: 2,
        name: 'علوم التسيير',
        code: 'MGT'
      },
      {
        id: 3,
        name: 'علوم تجارية',
        code: 'COM'
      },
      {
        id: 4,
        name: 'علوم مالية ومحاسبية',
        code: 'FIN'
      },
      {
        id: 5,
        name: 'الجذع المشترك',
        code: 'TC'
      }
    ];
  }
};

/**
 * إضافة قسم جديد
 */
export const addDepartment = async (department: Partial<Department>): Promise<Department> => {
  try {
    const { name, code } = department;
    
    if (!name) {
      throw new Error('اسم القسم مطلوب');
    }
    
    if (typeof window === 'undefined' || !window.db || typeof window.db.addDepartment !== 'function') {
      console.warn('window.db is not available or addDepartment is not a function');
      throw new Error('قاعدة البيانات غير متاحة');
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const newDepartment = await window.db.addDepartment(name, code);
    
    // إرجاع القسم الجديد مع البيانات الكاملة
    return {
      id: newDepartment.id,
      name,
      code,
      created_at: newDepartment.created_at
    };
  } catch (error) {
    console.error('Error adding department:', error);
    throw error;
  }
};

/**
 * تحديث بيانات قسم موجود
 */
export const updateDepartment = async (id: number, departmentData: Partial<Department>): Promise<Department> => {
  try {
    // التحقق من وجود معرف صالح
    if (id === undefined || id === null) {
      throw new Error('Department ID is required for updating');
    }

    const { name, code } = departmentData;
    
    if (typeof window === 'undefined' || !window.db || typeof window.db.updateDepartment !== 'function') {
      console.warn('window.db is not available or updateDepartment is not a function');
      throw new Error('قاعدة البيانات غير متاحة');
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.updateDepartment(id, name, code);
    
    // إرجاع البيانات المحدثة
    return {
      id,
      name,
      code
    };
  } catch (error) {
    console.error('Error updating department:', error);
    throw error;
  }
};

/**
 * حذف قسم من قاعدة البيانات
 */
export const deleteDepartment = async (id: number): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db || typeof window.db.deleteDepartment !== 'function') {
      console.warn('window.db is not available or deleteDepartment is not a function');
      throw new Error('قاعدة البيانات غير متاحة');
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.deleteDepartment(id);
  } catch (error) {
    console.error('Error deleting department:', error);
    throw error;
  }
}; 