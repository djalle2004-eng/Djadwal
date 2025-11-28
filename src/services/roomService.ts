/**
 * واجهة القاعة الدراسية
 */
interface Room {
  id: number;
  name: string;
  capacity: number;
  description?: string;
  created_at?: string;
}

/**
 * نموذج بيانات القاعة للإضافة والتعديل
 */
interface RoomFormData {
  name: string;
  capacity: number;
  description?: string;
}

/**
 * جلب كل القاعات الدراسية من قاعدة البيانات
 */
export const getRooms = async (): Promise<Room[]> => {
  try {
    // التحقق من وجود window.db
    if (typeof window === 'undefined' || !window.db || typeof window.db.getRooms !== 'function') {
      console.warn('window.db is not available or getRooms is not a function, returning mock data');
      // إرجاع بيانات مثال إذا كان window.db غير موجود
      return [
        {
          id: 1,
          name: 'قاعة نموذجية 1',
          capacity: 50,
          description: 'وصف القاعة النموذجية 1'
        },
        {
          id: 2,
          name: 'قاعة نموذجية 2',
          capacity: 30,
          description: 'وصف القاعة النموذجية 2'
        }
      ];
    }
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const rooms = await window.db.getRooms();
    
    // تحويل البيانات من النموذج الأساسي إلى نموذج القاعات الدراسية الكامل
    return rooms.map((room: any) => {
      // استخراج البيانات الإضافية من الميتاداتا إذا كانت موجودة
      let metadata = {};
      try {
        metadata = room.metadata ? JSON.parse(room.metadata) : {};
      } catch (e) {
        console.warn('Failed to parse room metadata:', e);
      }
      
      return {
        id: room.id,
        name: room.name,
        capacity: Number(room.capacity) || 0,
        description: (metadata as any).description || '',
        created_at: room.created_at
      };
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    throw error;
  }
}; 