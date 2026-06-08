import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';

// Public, unauthenticated endpoint for the Customer Experience survey link.
// Hardened: honeypot field + best-effort per-IP rate limit. Only ever writes
// a marketing/customer-experience entry — never a generic form.

const RATE = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = RATE.get(ip);
  if (!rec || now - rec.ts > WINDOW_MS) {
    RATE.set(ip, { count: 1, ts: now });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

const ALLOWED = ['store', 'category', 'nps', 'recommend', 'detail', 'name', 'contact'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Honeypot: bots fill hidden "company"; pretend success without saving.
    if (body && typeof body.company === 'string' && body.company.trim() !== '') {
      return NextResponse.json({ ok: true });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (rateLimited(ip)) {
      return NextResponse.json({ error: 'Too many submissions, please try again shortly.' }, { status: 429 });
    }

    const payload: Record<string, unknown> = { source: 'survey', type: 'feedback' };
    for (const k of ALLOWED) {
      const v = body?.[k];
      if (v !== '' && v !== null && v !== undefined) {
        payload[k] = typeof v === 'string' ? v.trim().slice(0, 2000) : v;
      }
    }

    // Require at least a rating or a comment so we don't store empties.
    if (payload.nps === undefined && !payload.detail && !payload.recommend) {
      return NextResponse.json({ error: 'Please share a rating or a comment.' }, { status: 400 });
    }

    await db.insert(entries).values({ department: 'marketing', formType: 'customer-experience', payload });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
