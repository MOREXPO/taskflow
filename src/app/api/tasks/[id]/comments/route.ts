import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { content } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Comentario vacío' }, { status: 400 });

  const comment = await prisma.taskComment.create({
    data: {
      taskId: id,
      content: content.trim(),
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
