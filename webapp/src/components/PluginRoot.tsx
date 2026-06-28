import React, { useEffect, useCallback } from 'react';
import { LayoutDashboard, Plus, Users, Trash2, AlertCircle, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import type { Project } from '../types';
import { CreateProjectDialog } from './CreateProjectDialog';
import { AddMembersDialog } from './AddMembersDialog';
import { AddTaskDialog } from './AddTaskDialog';
import { KanbanBoard } from './KanbanBoard';
import { usePluginVisible } from '../register';
import '../styles/main.css';

export const PluginRoot: React.FC = () => {
    const [visible, toggle] = usePluginVisible();

    const {
        projects,
        selectedProject,
        projectMembers,
        projectTasks,
        loading,
        error,
        showCreateProjectDialog,
        showAddMembersDialog,
        setProjects,
        setSelectedProject,
        setProjectMembers,
        setProjectTasks,
        setLoading,
        setError,
        setShowCreateProjectDialog,
        setShowAddMembersDialog,
    } = useStore();

    // Load projects on mount
    const loadProjects = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getProjects();
            setProjects(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message || 'Failed to load projects');
        } finally {
            setLoading(false);
        }
    }, [setProjects, setLoading, setError]);

    useEffect(() => {
        if (visible) {
            loadProjects();
        } else {
            setSelectedProject(null);
            setProjectTasks([]);
            setProjectMembers([]);
        }
    }, [visible]);

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && visible) {
                toggle();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [visible, toggle]);

    const loadProjectData = useCallback(async (project: Project) => {
        setSelectedProject(project);
        try {
            const [membersData, tasksData] = await Promise.all([
                api.getProjectMembers(project.id),
                api.getProjectTasks(project.id),
            ]);
            setProjectMembers(Array.isArray(membersData) ? membersData : []);
            setProjectTasks(Array.isArray(tasksData) ? tasksData : []);
        } catch (err: any) {
            setError(err.message || 'Failed to load project data');
        }
    }, [setSelectedProject, setProjectMembers, setProjectTasks, setError]);

    const handleSelectProject = (project: Project) => {
        loadProjectData(project);
    };

    const handleDeleteProject = async () => {
        if (!selectedProject) return;
        if (!window.confirm(`Delete project "${selectedProject.name}"? All tasks will be removed.`)) return;

        setLoading(true);
        try {
            await api.deleteProject(selectedProject.id);
            setSelectedProject(null);
            await loadProjects();
        } catch (err: any) {
            setError(err.message || 'Failed to delete project');
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const totalTasks = projectTasks.length;
    const doneTasks = projectTasks.filter(t => t.status === 'done').length;
    const inProgressTasks = projectTasks.filter(t => t.status === 'in_progress').length;
    const todoTasks = projectTasks.filter(t => t.status === 'todo').length;

    if (!visible) return null;

    return (
        <div className="plugin-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) toggle();
        }}>
            <div className="plugin-overlay__panel">
                {/* Close button */}
                <button className="plugin-overlay__close" onClick={toggle} title="Close">
                    <X size={20} />
                </button>

                <div className="plugin-root">
                    {/* Sidebar */}
                    <aside className="plugin-sidebar">
                        <div className="plugin-sidebar__header">
                            <div className="plugin-sidebar__title">
                                <LayoutDashboard />
                                <span>Jira PM</span>
                            </div>
                            <button
                                className="btn-create-project"
                                onClick={() => setShowCreateProjectDialog(true)}
                            >
                                <Plus />
                                <span>New Project</span>
                            </button>
                        </div>

                        <div className="plugin-sidebar__projects">
                            {projects.length === 0 && !loading && (
                                <div className="plugin-sidebar__empty">
                                    No projects yet
                                </div>
                            )}
                            {projects.map((project) => (
                                <div
                                    key={project.id}
                                    className={`plugin-sidebar__project-item ${
                                        selectedProject?.id === project.id ? 'plugin-sidebar__project-item--active' : ''
                                    }`}
                                    onClick={() => handleSelectProject(project)}
                                >
                                    <span className="plugin-sidebar__project-name">
                                        {project.name}
                                    </span>
                                    {project.task_count !== undefined && (
                                        <span className="plugin-sidebar__project-badge">
                                            {project.task_count}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="plugin-main">
                        {error && (
                            <div className="error-banner">
                                <AlertCircle />
                                <span>{error}</span>
                                <button className="error-banner__close" onClick={() => setError(null)}>
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {loading && !selectedProject ? (
                            <div className="loading-container">
                                <div className="loading-spinner" />
                            </div>
                        ) : !selectedProject ? (
                            <div className="plugin-main__welcome">
                                <LayoutDashboard className="plugin-main__welcome-icon" />
                                <div className="plugin-main__welcome-title">Project Management</div>
                                <div className="plugin-main__welcome-desc">
                                    Select a project from the sidebar or create a new one to start organizing your tasks on a Kanban board
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Project Header */}
                                <div className="plugin-project-header">
                                    <div className="plugin-project-header__top">
                                        <div className="plugin-project-header__info">
                                            <div className="plugin-project-header__name">
                                                {selectedProject.name}
                                            </div>
                                            {selectedProject.description && (
                                                <div className="plugin-project-header__desc">
                                                    {selectedProject.description}
                                                </div>
                                            )}
                                        </div>
                                        <div className="plugin-project-header__actions">
                                            <button
                                                className="btn-outline"
                                                onClick={() => setShowAddMembersDialog(true)}
                                            >
                                                <Users />
                                                <span>Members</span>
                                            </button>
                                            <button
                                                className="btn-danger-outline"
                                                onClick={handleDeleteProject}
                                            >
                                                <Trash2 />
                                                <span>Delete</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="plugin-project-header__stats">
                                        <div className="plugin-project-header__stat">
                                            <Users size={15} />
                                            <span className="plugin-project-header__stat-value">
                                                {projectMembers.length}
                                            </span>
                                            <span>members</span>
                                        </div>
                                        <div className="plugin-project-header__stat">
                                            <LayoutDashboard size={15} />
                                            <span className="plugin-project-header__stat-value">{totalTasks}</span>
                                            <span>tasks</span>
                                        </div>

                                        {/* Avatars */}
                                        {projectMembers.length > 0 && (
                                            <div className="plugin-project-header__avatars">
                                                {projectMembers.slice(0, 5).map((member) => (
                                                    <div
                                                        key={member.id}
                                                        className="plugin-project-header__avatar"
                                                        title={member.display_name || member.username}
                                                    >
                                                        {getInitials(member.display_name || member.username)}
                                                    </div>
                                                ))}
                                                {projectMembers.length > 5 && (
                                                    <div className="plugin-project-header__avatar plugin-project-header__avatar-more">
                                                        +{projectMembers.length - 5}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Kanban Board */}
                                <KanbanBoard />
                            </>
                        )}
                    </main>

                    {/* Dialogs */}
                    {showCreateProjectDialog && <CreateProjectDialog />}
                    {showAddMembersDialog && <AddMembersDialog />}
                    <AddTaskDialog />
                </div>
            </div>
        </div>
    );
};