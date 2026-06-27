import { create } from 'zustand';
import type { Project, Member, Task } from '@/lib/types';

interface AppState {
  projects: Project[];
  selectedProject: Project | null;
  members: Member[];
  loading: boolean;

  setProjects: (projects: Project[]) => void;
  setSelectedProject: (project: Project | null) => void;
  setMembers: (members: Member[]) => void;
  setLoading: (loading: boolean) => void;
  updateProjectInList: (project: Project) => void;
  removeProjectFromList: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  projects: [],
  selectedProject: null,
  members: [],
  loading: true,

  setProjects: (projects) => set({ projects }),
  setSelectedProject: (project) => set({ selectedProject: project }),
  setMembers: (members) => set({ members }),
  setLoading: (loading) => set({ loading }),
  updateProjectInList: (project) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === project.id ? project : p)),
      selectedProject:
        state.selectedProject?.id === project.id ? project : state.selectedProject,
    })),
  removeProjectFromList: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      selectedProject: state.selectedProject?.id === id ? null : state.selectedProject,
    })),
}));