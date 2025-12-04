import { createClient } from '@libsql/client';

const url = process.env.EXPO_PUBLIC_TURSO_DB_URL;
const authToken = process.env.EXPO_PUBLIC_TURSO_AUTH_TOKEN;

if (!url) {
    console.error('TURSO_DB_URL is not defined in environment variables');
}

export const turso = createClient({
    url: url || 'file:local.db',
    authToken: authToken,
});
