import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// TEMPORARY one-time migration endpoint: adds the nullable users.store column on
// the production DB (whose connection string is a sensitive env var only available
// at runtime). Token-guarded and idempotent. Remove this route after running once.
const TOKEN = 'ss-init-store-7Qx29falKp';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS store text`;
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'store'`;
    return NextResponse.json({ ok: true, storePresent: cols.length === 1 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
