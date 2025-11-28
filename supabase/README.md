# Supabase Setup Instructions

Follow these steps to set up your Supabase project:

1. Go to [Supabase](https://supabase.com) and sign in or create an account

2. Create a New Project:
   - Click "New Project"
   - Choose an organization or create one
   - Set a project name (e.g., "suivie")
   - Set a secure database password
   - Choose a region closest to your users
   - Click "Create new project" and wait for it to be created

3. Get Your Project Credentials:
   - In your project dashboard, go to Project Settings -> API
   - You'll need two values:
     - Project URL (looks like: https://xxxxxxxxxxxxxxxxxxxx.supabase.co)
     - anon/public key (starts with "eyJ...")

4. Configure Your Environment:
   - Open your `.env` file in the project root
   - Replace the placeholder values with your actual credentials:
     ```
     VITE_SUPABASE_URL=your-project-url
     VITE_SUPABASE_ANON_KEY=your-anon-key
     ```

5. Set Up Database Schema:
   - Go to the SQL Editor in your Supabase dashboard
   - Copy the contents of `schema.sql` from this directory
   - Paste it into the SQL Editor
   - Click "Run" to create the database schema

6. Restart Your Development Server:
   ```bash
   npm run dev
   ```

## Database Schema

### Professors Table
- `id`: UUID, primary key
- `academic_title`: Text, required
- `specialization`: Text, required
- `weekly_hours`: Integer, required (must be > 0)
- `email`: Text, required (must be valid email format)
- `created_at`: Timestamp with timezone
- `updated_at`: Timestamp with timezone

### Security Features
- Row Level Security (RLS) enabled
- Anonymous read access allowed
- Only authenticated users can create/update records
- Automatic `updated_at` timestamp management
