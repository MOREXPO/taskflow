import { NextResponse } from 'next/server';
import { authCookieName } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { signSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'Email y contraseña requeridos' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user) return NextResponse.json({ ok: false, error: 'Credenciales incorrectas' }, { status: 401 });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return NextResponse.json({ ok: false, error: 'Credenciales incorrectas' }, { status: 401 });

  const token = signSession({ userId: user.id, email: user.email, role: user.role as 'ADMIN' | 'USER' });

  const response = NextResponse.json({ ok: true, user: { email: user.email, role: user.role } });
  response.cookies.set(authCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 14,
    path: '/',
  });
  return response;
}
