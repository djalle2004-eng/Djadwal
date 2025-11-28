// واجهة تمثل بيانات الأستاذ من قاعدة البيانات
interface Professor {
  id: number;
  first_name: string;
  last_name: string;
  academic_title: string;
  specialization: string;
  weekly_hours?: number;
  email?: string;
  phone?: string;
  title?: string;
  created_at?: string;
}

/**
 * جلب كل الأساتذة من قاعدة البيانات
 */
export const getProfessors = async (): Promise<Professor[]> => {
  try {
    if (typeof window !== 'undefined' && window.db && typeof window.db.getProfessors === 'function') {
      console.log("Récupération des professeurs via l'API Electron...");
      // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
      const professorsData = await window.db.getProfessors();
      
      console.log("Données brutes des professeurs reçues:", JSON.stringify(professorsData));
      
      // Conversion explicite des données reçues en objets Professor
      return professorsData.map((prof: any) => {
        console.log("Traitement du professeur brut:", JSON.stringify(prof));
        
        // Construction du nom complet du professeur
        const nameParts = prof.name ? prof.name.split(' ') : ['', ''];
        const first_name = nameParts[0] || '';
        const last_name = nameParts.slice(1).join(' ') || '';
        
        // Récupération des champs email, title et phone
        const email = prof.email || '';
        
        // Vérifier explicitement chaque propriété possible
        let title = '';
        if (prof.title !== undefined) title = prof.title;
        else if (prof.Title !== undefined) title = prof.Title;
        
        let phone = '';
        if (prof.phone !== undefined) phone = prof.phone;
        else if (prof.Phone !== undefined) phone = prof.Phone;
        
        // Récupérer academic_title (à partir de la colonne Academic Title ou du champ academic_title)
        let academic_title = '';
        if (prof.academic_title !== undefined) academic_title = prof.academic_title;
        else if (prof["Academic Title"] !== undefined) academic_title = prof["Academic Title"];
        
        // Log explicite de chaque propriété pour aider au débogage
        console.log(`Propriétés brutes: 
          title=${prof.title}, 
          Title=${prof.Title}, 
          phone=${prof.phone}, 
          Phone=${prof.Phone},
          academic_title=${prof.academic_title},
          Academic Title=${prof["Academic Title"]}`
        );
        
        console.log(`Professeur traité: ${first_name} ${last_name}, title=${title}, phone=${phone}, academic_title=${academic_title}`);
        
        // Construction de l'objet Professor avec tous les champs
        return {
          id: prof.id,
          first_name,
          last_name,
          email,
          academic_title,
          specialization: prof.specialization || '',
          weekly_hours: prof.weekly_hours || 0,
          title,
          phone,
          created_at: prof.created_at
        };
      });
    } else {
      console.error("L'API Electron n'est pas disponible pour récupérer les professeurs");
      return [];
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des professeurs:', error);
    throw error;
  }
};

/**
 * إضافة أستاذ جديد
 */
export const addProfessor = async (professorData: Omit<Professor, 'id' | 'created_at'>): Promise<Professor> => {
  try {
    // تجهيز البيانات لتناسب القاعدة
    const { first_name, last_name, email, title, phone, academic_title, ...otherMetadata } = professorData;
    const trimmedFirstName = first_name?.trim() ?? '';
    const trimmedLastName = last_name?.trim() ?? '';
    const name = `${trimmedFirstName} ${trimmedLastName}`.trim();

    if (!name) {
      throw new Error('Professor name is required');
    }
    
    // استخدام null للبريد الإلكتروني الفارغ أو undefined لتجنب مشكلة UNIQUE constraint
    // التأكد من أن البريد ليس فارغاً أو undefined فقط، بل أيضاً ليس نصاً فارغاً بعد إزالة المسافات
    const hasValidEmail = email !== undefined && email !== null && email.trim() !== '';
    const emailValue = hasValidEmail ? email.trim() : null;
    
    console.log(`إضافة أستاذ: ${name}, البريد الإلكتروني:`, emailValue === null ? 'بدون بريد' : emailValue);
    
    // Créer un objet de métadonnées pour stocker les champs supplémentaires
    const metadata = {
      ...otherMetadata,
      title: (title || '').trim(),
      phone: (phone || '').trim(),
      academic_title: (academic_title || '').trim()
    };
    
    console.log('Métadonnées pour addProfessor:', metadata);
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const newProfessor = await window.db.addProfessor(name, emailValue, JSON.stringify(metadata));
    
    // إعادة تنسيق البيانات المرجعة
    return {
      id: newProfessor.id,
      first_name: trimmedFirstName,
      last_name: trimmedLastName,
      email: emailValue || undefined,
      academic_title: metadata.academic_title,
      specialization: professorData.specialization,
      weekly_hours: professorData.weekly_hours,
      phone: metadata.phone,
      title: metadata.title,
      created_at: newProfessor.created_at
    };
  } catch (error) {
    console.error('Error adding professor:', error);
    throw error;
  }
};

/**
 * تحديث بيانات أستاذ موجود
 */
export const updateProfessor = async (id: number, professorData: Partial<Omit<Professor, 'id' | 'created_at'>>): Promise<Professor> => {
  try {
    // الحصول على بيانات الأستاذ الحالية
    const professors = await getProfessors();
    const currentProfessor = professors.find(p => p.id === id);
    
    if (!currentProfessor) {
      throw new Error(`Professor with id ${id} not found`);
    }
    
    // تحديث البيانات
    const updatedData = { ...currentProfessor, ...professorData };
    const { first_name, last_name, email, title, phone, academic_title, ...otherMetadata } = updatedData;
    const trimmedFirstName = first_name?.trim() ?? '';
    const trimmedLastName = last_name?.trim() ?? '';
    const name = `${trimmedFirstName} ${trimmedLastName}`.trim();

    if (!name) {
      throw new Error('Professor name is required');
    }
    
    // استخدام null للبريد الإلكتروني الفارغ أو undefined لتجنب مشكلة UNIQUE constraint
    const hasValidEmail = email !== undefined && email !== null && email.trim() !== '';
    const emailValue = hasValidEmail ? email.trim() : null;
    
    console.log(`تحديث أستاذ: ${id} - ${name}, البريد الإلكتروني:`, emailValue === null ? 'بدون بريد' : emailValue);
    
    // Créer un objet de métadonnées pour stocker les champs supplémentaires
    const metadata = {
      ...otherMetadata,
      title: (title || '').trim(),
      phone: (phone || '').trim(),
      academic_title: (academic_title || '').trim()
    };
    
    console.log('Métadonnées pour updateProfessor:', metadata);
    
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.updateProfessor(id, name, emailValue, JSON.stringify(metadata));
    
    // إعادة البيانات المحدثة
    return {
      ...currentProfessor,
      ...professorData,
      first_name: trimmedFirstName,
      last_name: trimmedLastName,
      email: emailValue || undefined,
      title: metadata.title || currentProfessor.title || '',
      phone: metadata.phone || currentProfessor.phone || '',
      academic_title: metadata.academic_title || currentProfessor.academic_title || ''
    };
  } catch (error) {
    console.error('Error updating professor:', error);
    throw error;
  }
};

/**
 * حذف أستاذ من قاعدة البيانات
 */
export const deleteProfessor = async (id: number): Promise<void> => {
  try {
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.deleteProfessor(id);
  } catch (error) {
    console.error('Error deleting professor:', error);
    throw error;
  }
};

/**
 * حذف كل الأساتذة من قاعدة البيانات
 */
export const deleteAllProfessors = async (): Promise<void> => {
  try {
    const professors = await getProfessors();
    
    // حذف كل أستاذ
    for (const professor of professors) {
      await deleteProfessor(professor.id);
    }
  } catch (error) {
    console.error('Error deleting all professors:', error);
    throw error;
  }
}; 