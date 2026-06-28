import { create } from 'zustand';
import type { Project, ProjectMember, Task, MattermostUser, KanbanColumn } from '../types';

interface AppState {
    projects: Project[];
    selectedProject: Project | null;
    projectMembers: ProjectMember[];
    projectTasks: Task[];
    projectColumns: KanbanColumn[];
    mattermostUsers: MattermostUser[];
    currentUser: { id: string; isAdmin: boolean } | null;
    loading: boolean;
    error: string | null;

    // Dialog states
    showCreateProjectDialog: boolean;
    showAddMembersDialog: boolean;
    showAddTaskDialog: boolean;
    showAddColumnDialog: boolean;
    addTaskColumnId: string | null;
    editColumn: KanbanColumn | null;
    deleteColumnInfo: KanbanColumn | null;
    deleteTaskInfo: Task | null;
    deleteProjectInfo: Project | null;
    deleteMemberInfo: ProjectMember | null;
    alertMessage: string | null;

    // Actions
    setProjects: (projects: Project[]) => void;
    setSelectedProject: (project: Project | null) => void;
    setProjectMembers: (members: ProjectMember[]) => void;
    setProjectTasks: (tasks: Task[]) => void;
    setProjectColumns: (columns: KanbanColumn[]) => void;
    setMattermostUsers: (users: MattermostUser[]) => void;
    setCurrentUser: (user: { id: string; isAdmin: boolean } | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setShowCreateProjectDialog: (show: boolean) => void;
    setShowAddMembersDialog: (show: boolean) => void;
    setShowAddTaskDialog: (show: boolean, columnId?: string | null) => void;
    setShowAddColumnDialog: (show: boolean) => void;
    setEditColumn: (column: KanbanColumn | null) => void;
    setDeleteColumnInfo: (column: KanbanColumn | null) => void;
    setDeleteTaskInfo: (task: Task | null) => void;
    setDeleteProjectInfo: (project: Project | null) => void;
    setDeleteMemberInfo: (member: ProjectMember | null) => void;
    setAlertMessage: (message: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
    projects: [],
    selectedProject: null,
    projectMembers: [],
    projectTasks: [],
    projectColumns: [],
    mattermostUsers: [],
    currentUser: null,
    loading: false,
    error: null,
    showCreateProjectDialog: false,
    showAddMembersDialog: false,
    showAddTaskDialog: false,
    showAddColumnDialog: false,
    addTaskColumnId: null,
    editColumn: null,
    deleteColumnInfo: null,
    deleteTaskInfo: null,
    deleteProjectInfo: null,
    deleteMemberInfo: null,
    alertMessage: null,

    setProjects: (projects) => set({ projects }),
    setSelectedProject: (project) => set({ selectedProject: project }),
    setProjectMembers: (members) => set({ projectMembers: members }),
    setProjectTasks: (tasks) => set({ projectTasks: tasks }),
    setProjectColumns: (columns) => set({ projectColumns: columns }),
    setMattermostUsers: (users) => set({ mattermostUsers: users }),
    setCurrentUser: (user) => set({ currentUser: user }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setShowCreateProjectDialog: (show) => set({ showCreateProjectDialog: show }),
    setShowAddMembersDialog: (show) => set({ showAddMembersDialog: show }),
    setShowAddTaskDialog: (show, columnId = null) => set({ showAddTaskDialog: show, addTaskColumnId: columnId }),
    setShowAddColumnDialog: (show) => set({ showAddColumnDialog: show }),
    setEditColumn: (column) => set({ editColumn: column }),
    setDeleteColumnInfo: (column) => set({ deleteColumnInfo: column }),
    setDeleteTaskInfo: (task) => set({ deleteTaskInfo: task }),
    setDeleteProjectInfo: (project) => set({ deleteProjectInfo: project }),
    setDeleteMemberInfo: (member) => set({ deleteMemberInfo: member }),
    setAlertMessage: (message) => set({ alertMessage: message }),
}));
