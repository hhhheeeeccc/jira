import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.status !== undefined) {
      if (body.status === 'backlog') {
        await db.task.update({
          where: { id },
          data: { status: body.status, assigneeId: null },
        });
      } else {
        await db.task.update({
          where: { id },
          data: { status: body.status },
        });
      }
    }

    if (body.order !== undefined) {
      await db.task.update({
        where: { id },
        data: { order: body.order },
      });
    }

    if (body.title !== undefined || body.description !== undefined || body.dueDate !== undefined || body.dueTime !== undefined || body.priority !== undefined || body.assigneeId !== undefined) {
      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.dueDate !== undefined) updateData.dueDate = body.dueDate;
      if (body.dueTime !== undefined) updateData.dueTime = body.dueTime;
      if (body.priority !== undefined) updateData.priority = body.priority;
      if (body.assigneeId !== undefined) updateData.assigneeId = body.assigneeId;

      await db.task.update({
        where: { id },
        data: updateData,
      });
    }

    const updated = await db.task.findUnique({
      where: { id },
      include: { assignee: true },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}