import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Priority, TaskStatus } from '@prisma/client';
import { requireSession } from '@/lib/api-auth';

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tasks = await prisma.task.findMany({
    where: session.role === 'ADMIN' ? undefined : { ownerUserId: session.userId },
    include: {
      comments: { orderBy: { createdAt: 'desc' } },
      history: { orderBy: { createdAt: 'desc' }, take: 6 },
      subtasks: { orderBy: { createdAt: 'asc' }, include: { timeEntries: { orderBy: { date: 'desc' } } } },
      timeEntries: { orderBy: { date: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description || null,
      priority: (body.priority as Priority) || Priority.MEDIUM,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: (body.status as TaskStatus) || TaskStatus.PENDING,
      tags: Array.isArray(body.tags) ? body.tags.join(',') : body.tags || '',
      requester: body.requester || null,
      internalNotes: body.internalNotes || null,
      estimatedMinutes: typeof body.estimatedMinutes === 'number' ? body.estimatedMinutes : null,
      ownerUserId: session.userId,
      subtasks: Array.isArray(body.subtasks)
        ? {
            create: body.subtasks
              .filter((s: { title?: string }) => s?.title?.trim())
              .map((s: { title: string; estimatedMinutes?: number; completed?: boolean }) => ({
                title: s.title.trim(),
                estimatedMinutes: typeof s.estimatedMinutes === 'number' ? s.estimatedMinutes : null,
                completed: !!s.completed,
              })),
          }
        : undefined,
      history: {
        create: {
          toStatus: (body.status as TaskStatus) || TaskStatus.PENDING,
          note: 'Tarea creada',
        },
      },
    },
    include: { comments: true, history: true, subtasks: { include: { timeEntries: true } }, timeEntries: true },
  });

  return NextResponse.json(task, { status: 201 });
}
