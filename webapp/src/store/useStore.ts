import { create } from 'zustand';
import type { Project, ProjectMember, Task, MattermostUser } from '../types';

interface AppState {
    projects: Project[];
    selectedProject: Project | null;
    projectMembers: ProjectMember[];
    projectTasks: Task[];
    mattermostUsers: MattermostUser[];
    loading: boolean;
    error: string | null;

    // Dialog states
    showCreateProjectDialog: boolean;
    showAddMembersDialog: boolean;
    showAddTaskDialog: boolean;
    addTaskColumnId: string | null;

    // Actions
    setProjects: (projects: Project[]) => void;
    setSelectedProject: (project: Project | null) => void;
    setProjectMembers: (members: ProjectMember[]) => void;
    setProjectTasks: (tasks: Task[]) => void;
    setMattermostUsers: (users: MattermostUser[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setShowCreateProjectDialog: (show: boolean) => void;
    setShowAddMembersDialog: (show: boolean) => void;
    setShowAddTaskDialog: (show: boolean, columnId?: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
    projects: [],
    selectedProject: null,
    projectMembers: [],
    projectTasks: [],
    mattermostUsers: [],
    loading: false,
    error: null,
    showCreateProjectDialog: false,
    showAddMembersDialog: false,
    showAddTaskDialog: false,
    addTaskColumnId: null,

    setProjects: (projects) => set({ projects }),
    setSelectedProject: (project) => set({ selectedProject: project }),
    setProjectMembers: (members) => set({ projectMembers: members }),
    setProjectTasks: (tasks) => set({ projectTasks: tasks }),
    setMattermostUsers: (users) => set({ mattermostUsers: users }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setShowCreateProjectDialog: (show) => set({ showCreateProjectDialog: show }),
    setShowAddMembersDialog: (show) => set({ showAddMembersDialog: show }),
    setShowAddTaskDialog: (show, columnId = null) => set({ showAddTaskDialog: show, addTaskColumnId: columnId }),
}));
