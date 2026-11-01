import { defineConfig } from 'drizzle-kit';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '.env') });

export default defineConfig({
  schema: './packages/db/src/schema.ts',
  out: './packages/db/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});

