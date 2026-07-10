import type { Config } from 'drizzle-kit';
import { loadEnvConfig } from '@next/env';

// DATABASE_URL is supplied at run time (see package.json db:* scripts / .env.local).
loadEnvConfig(process.cwd(), true);

export default {
  schema: ['./src/lib/db/schema.ts', './src/lib/db/foundation-schema.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
