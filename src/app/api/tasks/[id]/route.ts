import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Priority, TaskStatus } from '@prisma/client';
import { requireSession } from '@/lib/api-auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const current = await prisma.task.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const nextStatus = (body.status as TaskStatus) || current.status;

  const task = await prisma.task.update({
    where: { id },
    data: {
      title: body.title ?? current.title,
      description: body.description ?? current.description,
      priority: (body.priority as Priority) ?? current.priority,
      dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate === null ? null : current.dueDate,
      status: nextStatus,
      tags: Array.isArray(body.tags) ? body.tags.join(',') : body.tags ?? current.tags,
      requester: body.requester ?? current.requester,
      internalNotes: body.internalNotes ?? current.internalNotes,
      estimatedMinutes: typeof body.estimatedMinutes === 'number' ? body.estimatedMinutes : body.estimatedMinutes === null ? null : current.estimatedMinutes,
      subtasks: Array.isArray(body.subtasks)
        ? {
            deleteMany: {},
            create: body.subtasks
              .filter((s: { title?: string }) => s?.title?.trim())
              .map((s: { title: string; estimatedMinutes?: number; completed?: boolean }) => ({
                title: s.title.trim(),
                estimatedMinutes: typeof s.estimatedMinutes === 'number' ? s.estimatedMinutes : null,
                completed: !!s.completed,
              })),
          }
        : undefined,
      history:
        nextStatus !== current.status
          ? {
              create: {
                fromStatus: current.status,
                toStatus: nextStatus,
                note: body.historyNote || 'Estado actualizado',
              },
            }
          : undefined,
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
