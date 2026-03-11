import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';

export async function POST(request: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  if (!body.taskId || !body.date || !body.minutes) {
    return NextResponse.json({ error: 'Campos obligatorios: taskId, date, minutes' }, { status: 400 });
  }

  const entry = await prisma.timeEntry.create({
    data: {
      taskId: body.taskId,
      subtaskId: body.subtaskId || null,
      date: new Date(body.date),
      minutes: Number(body.minutes),
      note: body.note || null,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
