/*
  # Initial Schema for Class Schedule Management System

  1. New Tables
    - `users` - Store user information and authentication
    - `professors` - Professor details and specializations
    - `courses` - Course/module information
    - `rooms` - Classroom and lab information
    - `groups` - Student groups/classes
    - `sessions` - Schedule entries linking professors, courses, rooms, and groups

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'professor', 'user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Professors table
CREATE TABLE professors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  specialization text NOT NULL,
  weekly_hours integer DEFAULT 40,
  academic_title text,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Courses table
CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  professor_id uuid REFERENCES professors(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Rooms table
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity integer NOT NULL,
  facilities jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Groups table
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text NOT NULL,
  specialty text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sessions table (schedule entries)
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) NOT NULL,
  professor_id uuid REFERENCES professors(id) NOT NULL,
  room_id uuid REFERENCES rooms(id) NOT NULL,
  group_id uuid REFERENCES groups(id) NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE professors ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Admins can read all data
CREATE POLICY "Admins can read all data" ON users
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Professors can read their own data and related sessions
CREATE POLICY "Professors can read own data" ON professors
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Everyone can read courses
CREATE POLICY "Anyone can read courses" ON courses
  FOR SELECT TO authenticated
  USING (true);

-- Everyone can read rooms
CREATE POLICY "Anyone can read rooms" ON rooms
  FOR SELECT TO authenticated
  USING (true);

-- Everyone can read groups
CREATE POLICY "Anyone can read groups" ON groups
  FOR SELECT TO authenticated
  USING (true);

-- Everyone can read sessions
CREATE POLICY "Anyone can read sessions" ON sessions
  FOR SELECT TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX sessions_course_idx ON sessions(course_id);
CREATE INDEX sessions_professor_idx ON sessions(professor_id);
CREATE INDEX sessions_room_idx ON sessions(room_id);
CREATE INDEX sessions_group_idx ON sessions(group_id);
CREATE INDEX sessions_day_time_idx ON sessions(day_of_week, start_time, end_time);