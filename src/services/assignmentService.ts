/**
 * واجهة التكليف
 */
interface Assignment {
  id: number;
  group_id: number;
  course_id: number;
  professor_id: number;
  room_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  academic_year?: string;
  semester?: string;
  specialization?: string;
  created_at?: string;
  // بيانات مستخرجة من جداول أخرى
  group_name?: string;
  course_name?: string;
  professor_name?: string;
  room_name?: string;
}

/**
 * نموذج بيانات التكليف للإضافة والتعديل
 */
interface AssignmentFormData {
  group_id: number;
  course_id: number;
  professor_id: number;
  room_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  academic_year?: string;
  semester?: string;
  specialization?: string;
}

/**
 * جلب كل التكاليف من قاعدة البيانات
 */
export const getAssignments = async (): Promise<Assignment[]> => {
  try {
    // التحقق من وجود window.db
    if (typeof window === 'undefined' || !window.db || typeof window.db.getAssignments !== 'function') {
      console.warn('window.db is not available or getAssignments is not a function, returning mock data');
      // إرجاع بيانات مثال إذا كان window.db غير موجود
      return [
        {
          id: 1,
          group_id: 1,
          course_id: 1,
          professor_id: 1,
          room_id: 1,
          day_of_week: 1,
          start_time: '08:00',
          end_time: '09:30',
          academic_year: '2023-2024',
          semester: '1',
          specialization: 'علوم الحاسوب',
          group_name: 'مجموعة نموذجية 1',
          course_name: 'مادة نموذجية 1',
          professor_name: 'أستاذ نموذجي 1',
          room_name: 'قاعة نموذجية 1'
        },
        {
          id: 2,
          group_id: 2,
          course_id: 2,
          professor_id: 2,
          room_id: 2,
          day_of_week: 2,
          start_time: '10:00',
          end_time: '11:30',
          academic_year: '2023-2024',
          semester: '1',
          specialization: 'هندسة البرمجيات',
          group_name: 'مجموعة نموذجية 2',
          course_name: 'مادة نموذجية 2',
          professor_name: 'أستاذ نموذجي 2',
          room_name: 'قاعة نموذجية 2'
        }
      ];
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const assignments = await window.db.getAssignments();
    
    // تحويل البيانات من النموذج الأساسي إلى نموذج التكاليف الكامل
    return assignments.map((assignment: any) => {
      return {
        id: assignment.id,
        group_id: assignment.group_id,
        course_id: assignment.course_id,
        professor_id: assignment.professor_id,
        room_id: assignment.room_id,
        day_of_week: assignment.day_of_week,
        start_time: assignment.start_time,
        end_time: assignment.end_time,
        academic_year: assignment.academic_year || '',
        semester: assignment.semester || '',
        specialization: assignment.specialization || '',
        created_at: assignment.created_at,
        group_name: assignment.group_name,
        course_name: assignment.course_name,
        professor_name: assignment.professor_name,
        room_name: assignment.room_name
      };
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    throw error;
  }
};

/**
 * إضافة تكليف جديد
 */
export const addAssignment = async (assignmentData: AssignmentFormData): Promise<Assignment> => {
  try {
    // التحقق من وجود window.db
    if (typeof window === 'undefined' || !window.db || typeof window.db.addAssignment !== 'function') {
      console.warn('window.db is not available or addAssignment is not a function, returning mock data');
      // إرجاع بيانات مثال إذا كان window.db غير موجود
      return {
        id: Date.now(), // استخدام الوقت الحالي كمعرف مؤقت
        ...assignmentData,
        created_at: new Date().toISOString()
      };
    }

    // التحقق من التعارضات قبل الإضافة إذا كانت الدالة متاحة
    if (typeof window.db.checkConflicts === 'function') {
      // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
      const conflicts = await window.db.checkConflicts(assignmentData);
      if (conflicts && conflicts.count > 0) {
        throw new Error('يوجد تعارض في الجدول الزمني. الرجاء اختيار وقت آخر.');
      }
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const newAssignment = await window.db.addAssignment(assignmentData);
    
    // إرجاع التكليف الجديد مع المعرف
    return {
      id: newAssignment.id || newAssignment,
      ...assignmentData,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error adding assignment:', error);
    throw error;
  }
};

/**
 * تحديث بيانات تكليف موجود
 */
export const updateAssignment = async (id: number, assignmentData: Partial<AssignmentFormData>): Promise<Assignment> => {
  try {
    // التحقق من وجود window.db
    if (typeof window === 'undefined' || !window.db || typeof window.db.updateAssignment !== 'function') {
      console.warn('window.db is not available or updateAssignment is not a function, returning mock data');
      // إرجاع بيانات مثال محدثة
      return {
        id,
        group_id: assignmentData.group_id || 1,
        course_id: assignmentData.course_id || 1,
        professor_id: assignmentData.professor_id || 1,
        room_id: assignmentData.room_id || 1,
        day_of_week: assignmentData.day_of_week || 1,
        start_time: assignmentData.start_time || '08:00',
        end_time: assignmentData.end_time || '09:30',
        academic_year: assignmentData.academic_year || '2023-2024',
        semester: assignmentData.semester || '1',
        specialization: assignmentData.specialization || 'علوم الحاسوب',
        created_at: new Date().toISOString()
      };
    }
    
    // الحصول على بيانات التكليف الحالية
    const assignments = await getAssignments();
    const currentAssignment = assignments.find(a => a.id === id);
    
    if (!currentAssignment) {
      throw new Error(`Assignment with id ${id} not found`);
    }
    
    // تحديث البيانات
    const updatedData = { ...currentAssignment, ...assignmentData };
    
    // التحقق من التعارضات قبل التحديث إذا كانت الدالة متاحة
    if (typeof window.db.checkConflicts === 'function') {
      // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
      const conflicts = await window.db.checkConflicts({ ...updatedData, id });
      if (conflicts && conflicts.count > 0) {
        throw new Error('يوجد تعارض في الجدول الزمني. الرجاء اختيار وقت آخر.');
      }
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.updateAssignment(id, updatedData);
    
    // إرجاع البيانات المحدثة
    return {
      ...currentAssignment,
      ...assignmentData
    };
  } catch (error) {
    console.error('Error updating assignment:', error);
    throw error;
  }
};

/**
 * حذف تكليف من قاعدة البيانات
 */
export const deleteAssignment = async (id: number): Promise<void> => {
  try {
    // التحقق من وجود window.db
    if (typeof window === 'undefined' || !window.db || typeof window.db.deleteAssignment !== 'function') {
      console.warn('window.db is not available or deleteAssignment is not a function');
      // عدم القيام بأي عملية في حالة عدم وجود window.db
      return;
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.deleteAssignment(id);
  } catch (error) {
    console.error('Error deleting assignment:', error);
    throw error;
  }
};

/**
 * التحقق من وجود تعارضات في الجدول الزمني
 */
export const checkConflicts = async (assignmentData: AssignmentFormData, assignmentId?: number): Promise<{count: number}> => {
  try {
    // التحقق من وجود window.db
    if (typeof window === 'undefined' || !window.db || typeof window.db.checkConflicts !== 'function') {
      console.warn('window.db is not available or checkConflicts is not a function, returning no conflicts');
      // إرجاع عدم وجود تعارضات في حالة عدم وجود window.db
      return { count: 0 };
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    return await window.db.checkConflicts({ ...assignmentData, id: assignmentId || 0 });
  } catch (error) {
    console.error('Error checking conflicts:', error);
    throw error;
  }
}; 