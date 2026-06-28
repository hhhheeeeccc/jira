const PLUGIN_ID = 'com.mattermost.plugin.jira';
const BASE_URL = `/plugins/${PLUGIN_ID}/api/v1`;

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
        fetch(`${BASE_URL}/projects`).then(r => handleResponse(r)),

    getProject: (id: string): Promise<any> =>
        fetch(`${BASE_URL}/projects/${id}`).then(r => handleResponse(r)),

    createProject: (data: { name: string; description?: string }): Promise<any> =>
        fetch(`${BASE_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).then(r => handleResponse(r)),

    deleteProject: (id: string): Promise<any> =>
        fetch(`${BASE_URL}/projects/${id}`, { method: 'DELETE' }).then(r => handleResponse(r)),

    // Project Members
    getProjectMembers: (projectId: string): Promise<any[]> =>
        fetch(`${BASE_URL}/projects/${projectId}/members`).then(r => handleResponse(r)),

    addProjectMembers: (projectId: string, userIds: string[]): Promise<any> =>
        fetch(`${BASE_URL}/projects/${projectId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_ids: userIds }),
        }).then(r => handleResponse(r)),

    removeProjectMember: (projectId: string, userId: string): Promise<any> =>
        fetch(`${BASE_URL}/projects/${projectId}/members/${userId}`, {
            method: 'DELETE',
        }).then(r => handleResponse(r)),

    // Tasks
    getProjectTasks: (projectId: string): Promise<any[]> =>
        fetch(`${BASE_URL}/projects/${projectId}/tasks`).then(r => handleResponse(r)),

    createTask: (projectId: string, data: any): Promise<any> =>
        fetch(`${BASE_URL}/projects/${projectId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).then(r => handleResponse(r)),

    updateTask: (taskId: string, data: any): Promise<any> =>
        fetch(`${BASE_URL}/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).then(r => handleResponse(r)),

    deleteTask: (taskId: string): Promise<any> =>
        fetch(`${BASE_URL}/tasks/${taskId}`, { method: 'DELETE' }).then(r => handleResponse(r)),
};