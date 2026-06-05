import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Neon HTTP driver: one-shot queries, ideal for serverless (Vercel) and works locally too.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Fail loudly at first use rather than silently returning empty data.
  throw new Error(
    'DATABASE_URL is not set. Add your Neon connection string to .env.local (see .env.example).'
  );
}

const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
