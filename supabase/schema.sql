-- Create professors table
create table public.professors (
    id uuid default gen_random_uuid() primary key,
    academic_title text not null,
    specialization text not null,
    weekly_hours integer not null check (weekly_hours > 0),
    email text not null unique check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.professors enable row level security;

-- Create policy to allow anonymous read access
create policy "Allow anonymous read access"
    on public.professors
    for select
    to anon
    using (true);

-- Create policy to allow authenticated users to insert
create policy "Allow authenticated create access"
    on public.professors
    for insert
    to authenticated
    with check (true);

-- Create policy to allow authenticated users to update their own records
create policy "Allow authenticated update access"
    on public.professors
    for update
    to authenticated
    using (true)
    with check (true);

-- Create updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

create trigger handle_professors_updated_at
    before update on public.professors
    for each row
    execute function public.handle_updated_at();
