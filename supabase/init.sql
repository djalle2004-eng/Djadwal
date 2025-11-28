-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create professors table
create table if not exists public.professors (
    id uuid default uuid_generate_v4() primary key,
    academic_title text not null,
    specialization text not null,
    weekly_hours integer not null check (weekly_hours > 0),
    email text not null unique check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create courses table
create table if not exists public.courses (
    id uuid default uuid_generate_v4() primary key,
    name text not null unique,
    code text not null unique,
    description text,
    credits integer not null check (credits > 0),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create rooms table
create table if not exists public.rooms (
    id uuid default uuid_generate_v4() primary key,
    name text not null unique,
    capacity integer not null check (capacity > 0),
    building text not null,
    floor integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create groups table
create table if not exists public.groups (
    id uuid default uuid_generate_v4() primary key,
    name text not null unique,
    year integer not null check (year > 0),
    specialization text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create sessions table
create table if not exists public.sessions (
    id uuid default uuid_generate_v4() primary key,
    course_id uuid not null references public.courses(id) on delete cascade,
    professor_id uuid not null references public.professors(id) on delete cascade,
    room_id uuid not null references public.rooms(id) on delete cascade,
    group_id uuid not null references public.groups(id) on delete cascade,
    day_of_week integer not null check (day_of_week between 0 and 6),
    start_time time not null,
    duration_minutes integer not null check (duration_minutes > 0),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(room_id, day_of_week, start_time), -- Prevent room double-booking
    unique(professor_id, day_of_week, start_time), -- Prevent professor double-booking
    unique(group_id, day_of_week, start_time) -- Prevent group double-booking
);

-- Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger handle_professors_updated_at
    before update on public.professors
    for each row
    execute function public.handle_updated_at();

create trigger handle_courses_updated_at
    before update on public.courses
    for each row
    execute function public.handle_updated_at();

create trigger handle_rooms_updated_at
    before update on public.rooms
    for each row
    execute function public.handle_updated_at();

create trigger handle_groups_updated_at
    before update on public.groups
    for each row
    execute function public.handle_updated_at();

create trigger handle_sessions_updated_at
    before update on public.sessions
    for each row
    execute function public.handle_updated_at();

-- Enable Row Level Security (RLS)
alter table public.professors enable row level security;
alter table public.courses enable row level security;
alter table public.rooms enable row level security;
alter table public.groups enable row level security;
alter table public.sessions enable row level security;

-- Create policies for anonymous access (read-only)
create policy "Allow anonymous read access"
    on public.professors for select
    to anon
    using (true);

create policy "Allow anonymous read access"
    on public.courses for select
    to anon
    using (true);

create policy "Allow anonymous read access"
    on public.rooms for select
    to anon
    using (true);

create policy "Allow anonymous read access"
    on public.groups for select
    to anon
    using (true);

create policy "Allow anonymous read access"
    on public.sessions for select
    to anon
    using (true);

-- Insert sample data
insert into public.professors (academic_title, specialization, weekly_hours, email)
values
    ('Dr. Smith', 'Computer Science', 20, 'smith@university.edu'),
    ('Prof. Johnson', 'Mathematics', 15, 'johnson@university.edu'),
    ('Dr. Williams', 'Physics', 18, 'williams@university.edu');

insert into public.courses (name, code, description, credits)
values
    ('Introduction to Programming', 'CS101', 'Basic programming concepts', 3),
    ('Calculus I', 'MATH201', 'Limits, derivatives, and integrals', 4),
    ('Physics Mechanics', 'PHY301', 'Classical mechanics', 4);

insert into public.rooms (name, capacity, building, floor)
values
    ('Room A101', 30, 'Building A', 1),
    ('Lab B202', 25, 'Building B', 2),
    ('Hall C303', 50, 'Building C', 3);

insert into public.groups (name, year, specialization)
values
    ('CS-2025-A', 1, 'Computer Science'),
    ('MATH-2025-A', 1, 'Mathematics'),
    ('PHY-2025-A', 1, 'Physics');

insert into public.sessions (course_id, professor_id, room_id, group_id, day_of_week, start_time, duration_minutes)
values
    ((select id from public.courses where code = 'CS101'),
     (select id from public.professors where email = 'smith@university.edu'),
     (select id from public.rooms where name = 'Room A101'),
     (select id from public.groups where name = 'CS-2025-A'),
     1, '09:00', 90),
    ((select id from public.courses where code = 'MATH201'),
     (select id from public.professors where email = 'johnson@university.edu'),
     (select id from public.rooms where name = 'Lab B202'),
     (select id from public.groups where name = 'MATH-2025-A'),
     2, '11:00', 90),
    ((select id from public.courses where code = 'PHY301'),
     (select id from public.professors where email = 'williams@university.edu'),
     (select id from public.rooms where name = 'Hall C303'),
     (select id from public.groups where name = 'PHY-2025-A'),
     3, '14:00', 90);
