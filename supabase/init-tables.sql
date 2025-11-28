-- =====================================================
-- SCHÉMA DE BASE DE DONNÉES DJADWAL
-- =====================================================

-- Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE DEPARTMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE PROFESSORS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.professors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    academic_title TEXT NOT NULL,
    specialization TEXT NOT NULL,
    weekly_hours INTEGER NOT NULL CHECK (weekly_hours > 0),
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE COURSES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    credits INTEGER NOT NULL CHECK (credits > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE ROOMS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    building TEXT NOT NULL,
    floor INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE GROUPS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year > 0),
    specialization TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE SESSIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES public.professors(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contraintes pour éviter les conflits
    UNIQUE(room_id, day_of_week, start_time), -- Une salle ne peut pas être double-réservée
    UNIQUE(professor_id, day_of_week, start_time), -- Un professeur ne peut pas être double-réservé
    UNIQUE(group_id, day_of_week, start_time) -- Un groupe ne peut pas être double-réservé
);

-- =====================================================
-- TABLE ACADEMIC_YEARS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    year_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CHECK (end_date > start_date)
);

-- =====================================================
-- TABLE SEMESTERS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.semesters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    semester_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CHECK (end_date > start_date)
);

-- =====================================================
-- TABLE COURSE_ASSIGNMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.course_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES public.professors(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    semester_id UUID REFERENCES public.semesters(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un professeur ne peut pas être assigné au même cours pour le même groupe
    UNIQUE(course_id, professor_id, group_id, academic_year_id)
);

-- =====================================================
-- TRIGGERS POUR UPDATED_AT
-- =====================================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers pour toutes les tables
CREATE TRIGGER handle_departments_updated_at
    BEFORE UPDATE ON public.departments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_professors_updated_at
    BEFORE UPDATE ON public.professors
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_courses_updated_at
    BEFORE UPDATE ON public.courses
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_rooms_updated_at
    BEFORE UPDATE ON public.rooms
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_sessions_updated_at
    BEFORE UPDATE ON public.sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_academic_years_updated_at
    BEFORE UPDATE ON public.academic_years
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_semesters_updated_at
    BEFORE UPDATE ON public.semesters
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_course_assignments_updated_at
    BEFORE UPDATE ON public.course_assignments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- POLITIQUES RLS (Row Level Security)
-- =====================================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;

-- Politiques pour permettre l'accès anonyme (pour le développement)
-- En production, vous devriez restreindre l'accès aux utilisateurs authentifiés

-- Départements
CREATE POLICY "Allow anonymous access to departments" ON public.departments
    FOR ALL TO anon USING (true);

-- Professeurs
CREATE POLICY "Allow anonymous access to professors" ON public.professors
    FOR ALL TO anon USING (true);

-- Cours
CREATE POLICY "Allow anonymous access to courses" ON public.courses
    FOR ALL TO anon USING (true);

-- Salles
CREATE POLICY "Allow anonymous access to rooms" ON public.rooms
    FOR ALL TO anon USING (true);

-- Groupes
CREATE POLICY "Allow anonymous access to groups" ON public.groups
    FOR ALL TO anon USING (true);

-- Sessions
CREATE POLICY "Allow anonymous access to sessions" ON public.sessions
    FOR ALL TO anon USING (true);

-- Années académiques
CREATE POLICY "Allow anonymous access to academic_years" ON public.academic_years
    FOR ALL TO anon USING (true);

-- Semestres
CREATE POLICY "Allow anonymous access to semesters" ON public.semesters
    FOR ALL TO anon USING (true);

-- Attributions de cours
CREATE POLICY "Allow anonymous access to course_assignments" ON public.course_assignments
    FOR ALL TO anon USING (true);

-- =====================================================
-- INDEX POUR LES PERFORMANCES
-- =====================================================

-- Index sur les clés étrangères
CREATE INDEX IF NOT EXISTS idx_sessions_course_id ON public.sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_professor_id ON public.sessions(professor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_room_id ON public.sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_sessions_group_id ON public.sessions(group_id);

-- Index sur les contraintes uniques
CREATE INDEX IF NOT EXISTS idx_sessions_room_time ON public.sessions(room_id, day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_professor_time ON public.sessions(professor_id, day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_group_time ON public.sessions(group_id, day_of_week, start_time);

-- Index sur les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_professors_specialization ON public.professors(specialization);
CREATE INDEX IF NOT EXISTS idx_courses_code ON public.courses(code);
CREATE INDEX IF NOT EXISTS idx_groups_specialization ON public.groups(specialization);

-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON TABLE public.departments IS 'Départements académiques de l''université';
COMMENT ON TABLE public.professors IS 'Professeurs et leurs informations';
COMMENT ON TABLE public.courses IS 'Cours et matières enseignées';
COMMENT ON TABLE public.rooms IS 'Salles de classe et amphithéâtres';
COMMENT ON TABLE public.groups IS 'Groupes d''étudiants par spécialisation';
COMMENT ON TABLE public.sessions IS 'Sessions de cours planifiées';
COMMENT ON TABLE public.academic_years IS 'Années académiques';
COMMENT ON TABLE public.semesters IS 'Semestres dans les années académiques';
COMMENT ON TABLE public.course_assignments IS 'Attributions cours-professeur-groupe';

-- =====================================================
-- FIN DU SCHÉMA
-- =====================================================
