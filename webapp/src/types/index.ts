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
    priority: string;
    status: string;
    sort_order: number;
    project_id: string;
    assignee_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface MattermostUser {
    id: string;
    username: string;
    display_name: string;
}

export interface KanbanColumn {
    id: string;
    project_id: string;
    title: string;
    color: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export type TaskStatus = string;