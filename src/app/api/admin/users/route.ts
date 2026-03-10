import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, password, role } = await request.json();
  if (!email || !password) return NextResponse.json({ error: 'Email y password requeridos' }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (exists) return NextResponse.json({ error: 'Usuario ya existe' }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: String(email).toLowerCase(),
      passwordHash,
      role: role === 'ADMIN' ? 'ADMIN' : 'USER',
    },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
