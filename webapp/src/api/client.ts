import type { Project, Task, KanbanColumn, ProjectMember, MattermostUser } from '../types';

const PLUGIN_ID = 'com.workspace.plugin.jira';
const BASE_URL = `/plugins/${PLUGIN_ID}/api/v1`;

function getCSRFToken() {
    const match = document.cookie.match(/(?:^|;)\s*MMCSRF=([^;]*)/);
    return match ? match[1] : '';
}

function getOptions(options: RequestInit = {}): RequestInit {
    const headers = new Headers(options.headers || {});
    headers.set('X-CSRF-Token', getCSRFToken());

    return {
        ...options,
        headers,
        credentials: 'include',
    };
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'حدث خطأ غير متوقع' }));
        throw new Error(error.error || `خطأ ${response.status}`);
    }
    return response.json();
}

export const api = {
    // Projects
    getProjects: (): Promise<Project[]> =>
        fetch(`${BASE_URL}/projects`, getOptions()).then(r => handleResponse<Project[]>(r)),

    getProject: (id: string): Promise<Project> =>
        fetch(`${BASE_URL}/projects/${id}`, getOptions()).then(r => handleResponse<Project>(r)),

    createProject: (data: { name: string; description?: string }): Promise<Project> =>
        fetch(`${BASE_URL}/projects`, getOptions({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })).then(r => handleResponse<Project>(r)),

    deleteProject: (id: string): Promise<void> =>
        fetch(`${BASE_URL}/projects/${id}`, getOptions({ method: 'DELETE' })).then(r => {
            if (!r.ok) throw new Error('فشل حذف المشروع');
        }),

    // Project Members
    getProjectMembers: (projectId: string): Promise<ProjectMember[]> =>
        fetch(`${BASE_URL}/projects/${projectId}/members`, getOptions()).then(r => handleResponse<ProjectMember[]>(r)),

    addProjectMembers: (projectId: string, userIds: string[]): Promise<void> =>
        fetch(`${BASE_URL}/projects/${projectId}/members`, getOptions({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_ids: userIds }),
        })).then(r => {
            if (!r.ok) throw new Error('فشل إضافة الأعضاء');
        }),

    removeProjectMember: (projectId: string, userId: string): Promise<void> =>
        fetch(`${BASE_URL}/projects/${projectId}/members/${userId}`, getOptions({
            method: 'DELETE',
        })).then(r => {
            if (!r.ok) throw new Error('فشل إزالة العضو');
        }),

    // Tasks
    getProjectTasks: (projectId: string): Promise<Task[]> =>
        fetch(`${BASE_URL}/projects/${projectId}/tasks`, getOptions()).then(r => handleResponse<Task[]>(r)),

    createTask: (projectId: string, data: Record<string, unknown>): Promise<Task> =>
        fetch(`${BASE_URL}/projects/${projectId}/tasks`, getOptions({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })).then(r => handleResponse<Task>(r)),

    updateTask: (taskId: string, data: Record<string, unknown>): Promise<Task> =>
        fetch(`${BASE_URL}/tasks/${taskId}`, getOptions({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })).then(r => handleResponse<Task>(r)),

    deleteTask: (taskId: string): Promise<void> =>
        fetch(`${BASE_URL}/tasks/${taskId}`, getOptions({ method: 'DELETE' })).then(r => {
            if (!r.ok) throw new Error('فشل حذف المهمة');
        }),

    // Columns
    getProjectColumns: (projectId: string): Promise<KanbanColumn[]> =>
        fetch(`${BASE_URL}/projects/${projectId}/columns`, getOptions()).then(r => handleResponse<KanbanColumn[]>(r)),

    createColumn: (projectId: string, data: { title: string; color?: string; sort_order?: number }): Promise<KanbanColumn> =>
        fetch(`${BASE_URL}/projects/${projectId}/columns`, getOptions({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })).then(r => handleResponse<KanbanColumn>(r)),

    updateColumn: (columnId: string, data: { title: string; color?: string; sort_order?: number; project_id?: string }): Promise<KanbanColumn> =>
        fetch(`${BASE_URL}/columns/${columnId}`, getOptions({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })).then(r => handleResponse<KanbanColumn>(r)),

    deleteColumn: (columnId: string, projectId?: string): Promise<void> =>
        fetch(`${BASE_URL}/columns/${columnId}${projectId ? `?project_id=${projectId}` : ''}`, getOptions({ method: 'DELETE' })).then(r => {
            if (!r.ok) throw new Error('فشل حذف العمود');
        }),

    // Users
    getUsers: (): Promise<MattermostUser[]> =>
        fetch(`${BASE_URL}/users`, getOptions()).then(r => handleResponse<MattermostUser[]>(r)),

    // User
    getMe: (): Promise<{ id: string; is_admin: boolean }> =>
        fetch(`${BASE_URL}/me`, getOptions()).then(r => handleResponse<{ id: string; is_admin: boolean }>(r)),
};