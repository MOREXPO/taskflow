import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Priority, TaskStatus } from '@prisma/client';

export async function GET() {
  const tasks = await prisma.task.findMany({
    include: {
      comments: { orderBy: { createdAt: 'desc' } },
      history: { orderBy: { createdAt: 'desc' }, take: 6 },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
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
      history: {
        create: {
          toStatus: (body.status as TaskStatus) || TaskStatus.PENDING,
          note: 'Tarea creada',
        },
      },
    },
    include: { comments: true, history: true },
  });

  return NextResponse.json(task, { status: 201 });
}
