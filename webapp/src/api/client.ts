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
    getProjects: (): Promise<any[]> =>
        fetch(`${BASE_URL}/projects`, getOptions()).then(r => handleResponse(r)),

    getProject: (id: string): Promise<any> =>
        fetch(`${BASE_URL}/projects/${id}`, getOptions()).then(r => handleResponse(r)),

    createProject: (data: { name: string; description?: string }): Promise<any> =>
        fetch(`${BASE_URL}/projects`, getOptions({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })).then(r => handleResponse(r)),

    deleteProject: (id: string): Promise<any> =>
        fetch(`${BASE_URL}/projects/${id}`, getOptions({ method: 'DELETE' })).then(r => handleResponse(r)),

    // Project Members
    getProjectMembers: (projectId: string): Promise<any[]> =>
        fetch(`${BASE_URL}/projects/${projectId}/members`, getOptions()).then(r => handleResponse(r)),

    addProjectMembers: (projectId: string, userIds: string[]): Promise<any> =>
        fetch(`${BASE_URL}/projects/${projectId}/members`, getOptions({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_ids: userIds }),
        })).then(r => handleResponse(r)),

    removeProjectMember: (projectId: string, userId: string): Promise<any> =>
        fetch(`${BASE_URL}/projects/${projectId}/members/${userId}`, getOptions({
            method: 'DELETE',
        })).then(r => handleResponse(r)),

    // Tasks
    getProjectTasks: (projectId: string): Promise<any[]> =>
        fetch(`${BASE_URL}/projects/${projectId}/tasks`, getOptions()).then(r => handleResponse(r)),

    createTask: (projectId: string, data: any): Promise<any> =>
        fetch(`${BASE_URL}/projects/${projectId}/tasks`, getOptions({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })).then(r => handleResponse(r)),

    updateTask: (taskId: string, data: any): Promise<any> =>
        fetch(`${BASE_URL}/tasks/${taskId}`, getOptions({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })).then(r => handleResponse(r)),

    deleteTask: (taskId: string): Promise<any> =>
        fetch(`${BASE_URL}/tasks/${taskId}`, getOptions({ method: 'DELETE' })).then(r => handleResponse(r)),

    // Columns
    getProjectColumns: (projectId: string): Promise<any[]> =>
        fetch(`${BASE_URL}/projects/${projectId}/columns`, getOptions()).then(r => handleResponse(r)),

    createColumn: (projectId: string, data: { title: string; color?: string; sort_order?: number }): Promise<any> =>
        fetch(`${BASE_URL}/projects/${projectId}/columns`, getOptions({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })).then(r => handleResponse(r)),

    updateColumn: (columnId: string, data: { title: string; color?: string; sort_order?: number; project_id?: string }): Promise<any> =>
        fetch(`${BASE_URL}/columns/${columnId}`, getOptions({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })).then(r => handleResponse(r)),

    deleteColumn: (columnId: string): Promise<any> =>
        fetch(`${BASE_URL}/columns/${columnId}`, getOptions({ method: 'DELETE' })).then(r => handleResponse(r)),

    // User
    getMe: (): Promise<{ id: string; is_admin: boolean }> =>
        fetch(`${BASE_URL}/me`, getOptions()).then(r => handleResponse(r)),

    getUsers: (): Promise<any[]> =>
        fetch(`${BASE_URL}/users`, getOptions()).then(r => handleResponse(r)),
};