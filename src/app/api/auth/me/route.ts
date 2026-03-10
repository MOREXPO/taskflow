import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authCookieName } from '@/lib/auth';
import { verifySession } from '@/lib/session';

export async function GET() {
  const token = (await cookies()).get(authCookieName)?.value;
  const session = verifySession(token);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, user: session });
}
