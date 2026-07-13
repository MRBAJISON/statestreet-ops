import { neon } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http';
import { drizzle as nodePostgresDrizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as legacySchema from './schema';
import * as foundationSchema from './foundation-schema';
import * as operationalSchema from './operational-schema';

// Neon HTTP driver: one-shot queries, ideal for serverless (Vercel) and works locally too.
const connectionString = process.env.DATABASE_URL ?? '';

if (!connectionString) {
  // Fail loudly at first use rather than silently returning empty data.
  throw new Error(
    'DATABASE_URL is not set. Add your Neon connection string to .env.local (see .env.example).'
  );
}

const schema = { ...legacySchema, ...foundationSchema, ...operationalSchema };

function createNeonDatabase() {
  return neonDrizzle(neon(connectionString), { schema });
}

type AppDatabase = ReturnType<typeof createNeonDatabase>;

const globalForDatabase = globalThis as typeof globalThis & {
  stateStreetLocalPool?: Pool;
};

function createLocalDatabase(): AppDatabase {
  const pool =
    globalForDatabase.stateStreetLocalPool ??
    new Pool({
      connectionString,
      max: 10,
      application_name: 'statestreet-ops-local',
    });

  if (process.env.NODE_ENV !== 'production') {
    globalForDatabase.stateStreetLocalPool = pool;
  }

  return nodePostgresDrizzle(pool, { schema }) as unknown as AppDatabase;
}

export const db =
  process.env.DATABASE_DRIVER === 'node-postgres' ? createLocalDatabase() : createNeonDatabase();
