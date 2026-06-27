import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectMembers = await db.projectMember.findMany({
      where: { projectId: id },
      include: { member: true },
    });
    return NextResponse.json(projectMembers);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch project members' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { memberIds } = body;

    if (!Array.isArray(memberIds)) {
      return NextResponse.json({ error: 'memberIds array is required' }, { status: 400 });
    }

    const results = [];
    for (const memberId of memberIds) {
      const existing = await db.projectMember.findUnique({
        where: {
          projectId_memberId: { projectId: id, memberId },
        },
      });
      if (!existing) {
        const pm = await db.projectMember.create({
          data: { projectId: id, memberId },
        });
        results.push(pm);
      }
    }

    return NextResponse.json(results, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add members' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
    }
    await db.projectMember.delete({
      where: {
        projectId_memberId: { projectId: id, memberId },
      },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
