import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TaskStatus } from '@prisma/client';
import { requireSession } from '@/lib/api-auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { status } = await request.json();

  const current = await prisma.task.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const nextStatus = status as TaskStatus;

  const task = await prisma.task.update({
    where: { id },
    data: {
      status: nextStatus,
      history: {
        create: {
          fromStatus: current.status,
          toStatus: nextStatus,
          note: 'Movida en tablero',
        },
      },
    },
    include: {
      comments: { orderBy: { createdAt: 'desc' } },
      history: { orderBy: { createdAt: 'desc' }, take: 6 },
      subtasks: { orderBy: { createdAt: 'asc' }, include: { timeEntries: { orderBy: { date: 'desc' } } } },
      timeEntries: { orderBy: { date: 'desc' } },
    },
  });

  return NextResponse.json(task);
}
