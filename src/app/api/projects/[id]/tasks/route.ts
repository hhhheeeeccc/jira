import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tasks = await db.task.findMany({
      where: { projectId: id },
      include: { assignee: true },
      orderBy: { order: 'asc' },
    });
    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, dueDate, dueTime, priority, assigneeId } = body;

    if (!title) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    const status = assigneeId ? 'todo' : 'backlog';

    const maxOrder = await db.task.findFirst({
      where: { projectId: id, status },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const task = await db.task.create({
      data: {
        title,
        description: description || null,
        dueDate: dueDate || null,
        dueTime: dueTime || null,
        priority: priority || 'medium',
        status,
        order: (maxOrder?.order ?? -1) + 1,
        projectId: id,
        assigneeId: assigneeId || null,
      },
      include: { assignee: true },
    });

    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}