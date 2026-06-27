export interface Project {
    id: string;
    name: string;
    description: string | null;
    creator_id: string;
    created_at: string;
    updated_at: string;
    task_count?: number;
    member_count?: number;
}

export interface ProjectMember {
    id: string;
    project_id: string;
    user_id: string;
    role: string;
    joined_at: string;
    username: string;
    display_name: string;
}

export interface Task {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    due_time: string | null;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'backlog' | 'todo' | 'in_progress' | 'done';
    sort_order: number;
    project_id: string;
    assignee_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface MattermostUser {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    nickname: string;
    position: string;
}

export const KANBAN_COLUMNS = [
    { id: 'backlog', title: 'الخلفية', color: '#6b7280' },
    { id: 'todo', title: 'قيد التنفيذ', color: '#3b82f6' },
    { id: 'in_progress', title: 'جاري العمل', color: '#f59e0b' },
    { id: 'done', title: 'مكتمل', color: '#10b981' },
] as const;

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';