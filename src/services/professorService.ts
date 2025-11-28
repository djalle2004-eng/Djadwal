import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const COLLECTION_NAME = 'professors';

/**
 * واجهة الأستاذ
 */
export interface Professor {
  id: string;
  first_name: string;
  last_name: string;
  academic_title: string;
  specialization: string;
  weekly_hours: number;
  email: string;
  created_at: string;
}

/**
 * نموذج بيانات الأستاذ للإضافة والتعديل
 */
export interface ProfessorFormData {
  name: string;
  email: string;
  academic_title?: string;
  specialization?: string;
}

export const professorService = {
  async getProfessors() {
    try {
      // التحقق من وجود window.db
      if (typeof window !== 'undefined' && window.db && typeof window.db.getProfessors === 'function') {
        // استخدام Electron API إذا كان متاحاً
        // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
        const professors = await window.db.getProfessors();
        
        // تحويل البيانات إذا لزم الأمر
        return professors.map((prof: any) => {
          // استخراج البيانات الإضافية من الميتاداتا إذا كانت موجودة
          let metadata = {};
          try {
            metadata = prof.metadata ? JSON.parse(prof.metadata) : {};
          } catch (e) {
            console.warn('Failed to parse professor metadata:', e);
          }
          
          return {
            id: prof.id,
            first_name: prof.name?.split(' ')[0] || '',
            last_name: prof.name?.split(' ').slice(1).join(' ') || '',
            email: prof.email || '',
            academic_title: (metadata as any).academic_title || '',
            specialization: (metadata as any).specialization || '',
            weekly_hours: (metadata as any).weekly_hours || 0,
            created_at: prof.created_at
          };
        });
      } else {
        // استخدام Firebase إذا كان window.db غير متاح
        console.log('Using Firebase for getProfessors');
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Professor[];
      }
    } catch (error) {
      console.error('Error fetching professors:', error);
      throw error;
    }
  },

  async addProfessor(professor: Omit<Professor, 'id' | 'created_at'>) {
    // محاولة استخدام Electron API أولاً إذا كان متاحاً
    if (typeof window !== 'undefined' && window.db && typeof window.db.addProfessor === 'function') {
      try {
        // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
        const fullName = `${professor.first_name} ${professor.last_name}`.trim();
        const result = await window.db.addProfessor(fullName, professor.email || '');
        return result.id || result;
      } catch (error) {
        console.error('Error adding professor with Electron API, falling back to Firebase:', error);
      }
    }
    
    // استخدام Firebase كبديل
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...professor,
      created_at: new Date().toISOString()
    });
    return docRef.id;
  },

  async updateProfessor(id: string, professor: Partial<Professor>) {
    // محاولة استخدام Electron API أولاً إذا كان متاحاً
    if (typeof window !== 'undefined' && window.db && typeof window.db.updateProfessor === 'function') {
      try {
        // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
        if (professor.first_name || professor.last_name) {
          const fullName = `${professor.first_name || ''} ${professor.last_name || ''}`.trim();
          await window.db.updateProfessor(id, fullName, professor.email || '');
          return;
        }
      } catch (error) {
        console.error('Error updating professor with Electron API, falling back to Firebase:', error);
      }
    }
    
    // استخدام Firebase كبديل
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, professor);
  },

  async deleteProfessor(id: string) {
    // محاولة استخدام Electron API أولاً إذا كان متاحاً
    if (typeof window !== 'undefined' && window.db && typeof window.db.deleteProfessor === 'function') {
      try {
        // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
        await window.db.deleteProfessor(id);
        return;
      } catch (error) {
        console.error('Error deleting professor with Electron API, falling back to Firebase:', error);
      }
    }
    
    // استخدام Firebase كبديل
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }
};
