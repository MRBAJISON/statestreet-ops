export const LOCAL_DATABASE_NAME = 'statestreet_ops_local';
export const LOCAL_ADMIN_DATABASE_URL = 'postgresql:///postgres?host=/tmp';
export const LOCAL_DATABASE_URL = `postgresql:///${LOCAL_DATABASE_NAME}?host=/tmp`;

export function assertLocalDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Local database URL is invalid.');
  }

  const socket = url.searchParams.get('host');
  const hostIsLocal = !url.hostname || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const socketIsLocal = !socket || socket === '/tmp';
  const databaseIsLocal = url.pathname.replace(/^\//, '') === LOCAL_DATABASE_NAME;

  if (url.protocol !== 'postgresql:' || !hostIsLocal || !socketIsLocal || !databaseIsLocal) {
    throw new Error(`Refusing non-local database URL for ${LOCAL_DATABASE_NAME}.`);
  }
}
