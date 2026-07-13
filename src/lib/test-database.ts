export function testDatabaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!['postgresql:', 'postgres:'].includes(parsed.protocol) || !databaseName.endsWith('_test')) {
    throw new Error('Refusing database tests unless TEST_DATABASE_URL names a database ending in _test');
  }
  return value;
}
