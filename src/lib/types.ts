export interface Member {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  memberId: string;
  role: string;
  joinedAt: string;
  member: Member;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'backlog' | 'todo' | 'in_progress' | 'done';
  order: number;
  projectId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: Member | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  tasks: Task[];
  _count?: { tasks: number };
}

export const KANBAN_COLUMNS = [
  { id: 'backlog', title: 'الخلفية', color: 'bg-gray-500' },
  { id: 'todo', title: 'قيد التنفيذ', color: 'bg-blue-500' },
  { id: 'in_progress', title: 'جاري العمل', color: 'bg-amber-500' },
  { id: 'done', title: 'مكتمل', color: 'bg-emerald-500' },
] as const;

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';