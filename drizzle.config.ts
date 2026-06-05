import type { Config } from 'drizzle-kit';

// DATABASE_URL is supplied at run time (see package.json db:* scripts / .env.local).
export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
