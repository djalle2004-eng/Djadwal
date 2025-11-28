-- Add first_name and last_name columns to professors table
alter table public.professors
add column first_name text not null default '',
add column last_name text not null default '';

-- Create a function to split the academic title into first_name and last_name
create or replace function public.split_academic_title()
returns void as $$
declare
    prof record;
    name_parts text[];
begin
    for prof in select * from public.professors loop
        -- Split academic title by space
        name_parts := string_to_array(trim(both from prof.academic_title), ' ');
        
        -- Update the professor record
        update public.professors
        set
            first_name = case 
                when array_length(name_parts, 1) > 1 then name_parts[2]
                else ''
            end,
            last_name = case 
                when array_length(name_parts, 1) > 2 then array_to_string(name_parts[3:array_length(name_parts, 1)], ' ')
                else ''
            end,
            academic_title = case 
                when name_parts[1] like 'Prof%' or name_parts[1] like 'Dr%' then name_parts[1]
                else 'Prof. Dr'
            end
        where id = prof.id;
    end loop;
end;
$$ language plpgsql;

-- Execute the function to migrate existing data
select public.split_academic_title();

-- Drop the function as it's no longer needed
drop function public.split_academic_title();
