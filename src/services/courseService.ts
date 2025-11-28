/**
 * واجهة المادة الدراسية
 */
interface Course {
  id: number;
  name: string;
  code: string;
  description: string;
  credits: number;
  coefficient: number;
  created_at?: string;
}

/**
 * نموذج بيانات المادة للإضافة والتعديل
 */
interface CourseFormData {
  name: string;
  code: string;
  description: string;
  credits: number;
  coefficient: number;
}

/**
 * جلب كل المواد الدراسية من قاعدة البيانات
 */
export const getCourses = async (): Promise<Course[]> => {
  try {
    // التحقق من وجود window.db
    if (typeof window === 'undefined' || !window.db || typeof window.db.getCourses !== 'function') {
      console.warn('window.db is not available or getCourses is not a function, returning mock data');
      // إرجاع بيانات مثال إذا كان window.db غير موجود
      return [
        {
          id: 1,
          name: 'مادة نموذجية 1',
          code: 'CS101',
          description: 'وصف المادة النموذجية 1',
          credits: 3,
          coefficient: 1
        },
        {
          id: 2,
          name: 'مادة نموذجية 2',
          code: 'CS102',
          description: 'وصف المادة النموذجية 2',
          credits: 3,
          coefficient: 1
        }
      ];
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const courses = await window.db.getCourses();
    
    // تحويل البيانات من النموذج الأساسي إلى نموذج المواد الدراسية الكامل
    return courses.map((course: any) => {
      // استخراج البيانات الإضافية من الميتاداتا إذا كانت موجودة
      let metadata = {};
      try {
        metadata = course.metadata ? JSON.parse(course.metadata) : {};
      } catch (e) {
        console.warn('Failed to parse course metadata:', e);
      }
      
      return {
        id: course.id,
        name: course.name,
        code: course.code,
        description: (metadata as any).description || '',
        credits: Number((metadata as any).credits) || 0,
        coefficient: Number((metadata as any).coefficient) || 1,
        created_at: course.created_at
      };
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    throw error;
  }
};

/**
 * إضافة مادة دراسية جديدة
 */
export const addCourse = async (courseData: CourseFormData): Promise<Course> => {
  try {
    const { name, code, description, credits, coefficient } = courseData;
    const metadata = JSON.stringify({ description, credits, coefficient });
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const newCourse = await window.db.addCourse(name, code, metadata);
    
    // إرجاع المادة الجديدة بالتنسيق المطلوب
    return {
      id: newCourse.id,
      name,
      code,
      description,
      credits,
      coefficient,
      created_at: newCourse.created_at
    };
  } catch (error) {
    console.error('Error adding course:', error);
    throw error;
  }
};

/**
 * تحديث بيانات مادة دراسية موجودة
 */
export const updateCourse = async (id: number, courseData: Partial<CourseFormData>): Promise<Course> => {
  try {
    // الحصول على بيانات المادة الحالية
    const courses = await getCourses();
    const currentCourse = courses.find(c => c.id === id);
    
    if (!currentCourse) {
      throw new Error(`Course with id ${id} not found`);
    }
    
    // تحديث البيانات
    const updatedData = { ...currentCourse, ...courseData };
    const { name, code, description, credits, coefficient } = updatedData;
    const metadata = JSON.stringify({ description, credits, coefficient });
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.updateCourse(id, name, code, metadata);
    
    // إرجاع البيانات المحدثة
    return {
      ...currentCourse,
      ...courseData
    };
  } catch (error) {
    console.error('Error updating course:', error);
    throw error;
  }
};

/**
 * حذف مادة دراسية من قاعدة البيانات
 */
export const deleteCourse = async (id: number): Promise<void> => {
  try {
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.deleteCourse(id);
  } catch (error) {
    console.error('Error deleting course:', error);
    throw error;
  }
};

/**
 * حذف كل المواد الدراسية
 */
export const deleteAllCourses = async (): Promise<void> => {
  try {
    const courses = await getCourses();
    
    // حذف كل المواد
    for (const course of courses) {
      await deleteCourse(course.id);
    }
  } catch (error) {
    console.error('Error deleting all courses:', error);
    throw error;
  }
}; 