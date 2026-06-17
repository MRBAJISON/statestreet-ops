import nextEnv from '@next/env';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const { loadEnvConfig } = nextEnv;

// Local maintenance scripts should prefer .env.local even when NODE_ENV is unset.
loadEnvConfig(repoRoot, true);
