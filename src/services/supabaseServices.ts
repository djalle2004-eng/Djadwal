import { supabase, Tables, Inserts, Updates } from '../lib/supabase'

// Types
export type Professor = Tables<'professors'>
export type Course = Tables<'courses'>
export type Room = Tables<'rooms'>
export type Group = Tables<'groups'>
export type Session = Tables<'sessions'>

// ===== SERVICES PROFESSEURS =====
export const professorService = {
  // Récupérer tous les professeurs
  async getAll(): Promise<Professor[]> {
    const { data, error } = await supabase
      .from('professors')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Récupérer un professeur par ID
  async getById(id: string): Promise<Professor | null> {
    const { data, error } = await supabase
      .from('professors')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  // Créer un nouveau professeur
  async create(professor: Inserts<'professors'>): Promise<Professor> {
    const { data, error } = await supabase
      .from('professors')
      .insert(professor)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Mettre à jour un professeur
  async update(id: string, updates: Updates<'professors'>): Promise<Professor> {
    const { data, error } = await supabase
      .from('professors')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Supprimer un professeur
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('professors')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // Rechercher des professeurs
  async search(query: string): Promise<Professor[]> {
    const { data, error } = await supabase
      .from('professors')
      .select('*')
      .or(`academic_title.ilike.%${query}%,specialization.ilike.%${query}%,email.ilike.%${query}%`)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }
}

// ===== SERVICES COURS =====
export const courseService = {
  // Récupérer tous les cours
  async getAll(): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Récupérer un cours par ID
  async getById(id: string): Promise<Course | null> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  // Créer un nouveau cours
  async create(course: Inserts<'courses'>): Promise<Course> {
    const { data, error } = await supabase
      .from('courses')
      .insert(course)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Mettre à jour un cours
  async update(id: string, updates: Updates<'courses'>): Promise<Course> {
    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Supprimer un cours
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // Rechercher des cours
  async search(query: string): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
      .order('name', { ascending: true })
    
    if (error) throw error
    return data || []
  }
}

// ===== SERVICES SALLES =====
export const roomService = {
  // Récupérer toutes les salles
  async getAll(): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Récupérer une salle par ID
  async getById(id: string): Promise<Room | null> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  // Créer une nouvelle salle
  async create(room: Inserts<'rooms'>): Promise<Room> {
    const { data, error } = await supabase
      .from('rooms')
      .insert(room)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Mettre à jour une salle
  async update(id: string, updates: Updates<'rooms'>): Promise<Room> {
    const { data, error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Supprimer une salle
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // Vérifier la disponibilité d'une salle
  async checkAvailability(roomId: string, dayOfWeek: number, startTime: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('sessions')
      .select('id')
      .eq('room_id', roomId)
      .eq('day_of_week', dayOfWeek)
      .eq('start_time', startTime)
    
    if (error) throw error
    return !data || data.length === 0
  }
}

// ===== SERVICES GROUPES =====
export const groupService = {
  // Récupérer tous les groupes
  async getAll(): Promise<Group[]> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Récupérer un groupe par ID
  async getById(id: string): Promise<Group | null> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  // Créer un nouveau groupe
  async create(group: Inserts<'groups'>): Promise<Group> {
    const { data, error } = await supabase
      .from('groups')
      .insert(group)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Mettre à jour un groupe
  async update(id: string, updates: Updates<'groups'>): Promise<Group> {
    const { data, error } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Supprimer un groupe
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // Rechercher des groupes
  async search(query: string): Promise<Group[]> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .or(`name.ilike.%${query}%,specialization.ilike.%${query}%`)
      .order('name', { ascending: true })
    
    if (error) throw error
    return data || []
  }
}

// ===== SERVICES SESSIONS =====
export const sessionService = {
  // Récupérer toutes les sessions
  async getAll(): Promise<Session[]> {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        courses(name, code),
        professors(academic_title, specialization),
        rooms(name, capacity),
        groups(name, specialization)
      `)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Récupérer les sessions par groupe
  async getByGroup(groupId: string): Promise<Session[]> {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        courses(name, code),
        professors(academic_title, specialization),
        rooms(name, capacity)
      `)
      .eq('group_id', groupId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Récupérer les sessions par professeur
  async getByProfessor(professorId: string): Promise<Session[]> {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        courses(name, code),
        rooms(name, capacity),
        groups(name, specialization)
      `)
      .eq('professor_id', professorId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Créer une nouvelle session
  async create(session: Inserts<'sessions'>): Promise<Session> {
    const { data, error } = await supabase
      .from('sessions')
      .insert(session)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Mettre à jour une session
  async update(id: string, updates: Updates<'sessions'>): Promise<Session> {
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Supprimer une session
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // Vérifier les conflits de planning
  async checkConflicts(session: Inserts<'sessions'>): Promise<{
    roomConflict: boolean
    professorConflict: boolean
    groupConflict: boolean
  }> {
    const { data: roomConflict, error: roomError } = await supabase
      .from('sessions')
      .select('id')
      .eq('room_id', session.room_id)
      .eq('day_of_week', session.day_of_week)
      .eq('start_time', session.start_time)
    
    const { data: professorConflict, error: profError } = await supabase
      .from('sessions')
      .select('id')
      .eq('professor_id', session.professor_id)
      .eq('day_of_week', session.day_of_week)
      .eq('start_time', session.start_time)
    
    const { data: groupConflict, error: groupError } = await supabase
      .from('sessions')
      .select('id')
      .eq('group_id', session.group_id)
      .eq('day_of_week', session.day_of_week)
      .eq('start_time', session.start_time)
    
    if (roomError || profError || groupError) throw new Error('Erreur lors de la vérification des conflits')
    
    return {
      roomConflict: roomConflict && roomConflict.length > 0,
      professorConflict: professorConflict && professorConflict.length > 0,
      groupConflict: groupConflict && groupConflict.length > 0
    }
  }
}

// ===== SERVICE D'AUTHENTIFICATION =====
export const authService = {
  // Connexion avec email/mot de passe
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error
    return data
  },

  // Inscription
  async signUp(email: string, password: string, metadata?: any) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
    
    if (error) throw error
    return data
  },

  // Déconnexion
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  // Récupérer l'utilisateur actuel
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  },

  // Écouter les changements d'authentification
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Export des services
export default {
  professors: professorService,
  courses: courseService,
  rooms: roomService,
  groups: groupService,
  sessions: sessionService,
  auth: authService
}
