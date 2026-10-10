import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Types pour les tables Supabase
export interface Database {
  public: {
    Tables: {
      professors: {
        Row: {
          id: string
          academic_title: string
          specialization: string
          weekly_hours: number
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          academic_title: string
          specialization: string
          weekly_hours: number
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          academic_title?: string
          specialization?: string
          weekly_hours?: number
          email?: string
          created_at?: string
          updated_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          name: string
          code: string
          description?: string
          credits: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          description?: string
          credits: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string
          credits?: number
          created_at?: string
          updated_at?: string
        }
      }
      rooms: {
        Row: {
          id: string
          name: string
          capacity: number
          building: string
          floor: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          capacity: number
          building: string
          floor: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          capacity?: number
          building?: string
          floor?: number
          created_at?: string
          updated_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          year: number
          specialization: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          year: number
          specialization: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          year?: number
          specialization?: string
          created_at?: string
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          course_id: string
          professor_id: string
          room_id: string
          group_id: string
          day_of_week: number
          start_time: string
          duration_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          professor_id: string
          room_id: string
          group_id: string
          day_of_week: number
          start_time: string
          duration_minutes: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          professor_id?: string
          room_id?: string
          group_id?: string
          day_of_week?: number
          start_time?: string
          duration_minutes?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
