import React, { useEffect, useCallback } from 'react';
import { LayoutDashboard, Plus, Users, Trash2, AlertCircle, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import type { Project } from '../types';
import { CreateProjectDialog } from './CreateProjectDialog';
import { AddMembersDialog } from './AddMembersDialog';
import { AddTaskDialog } from './AddTaskDialog';
import { KanbanBoard } from './KanbanBoard';
import '../styles/main.css';

export const PluginRoot: React.FC = () => {
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

    // Load projects and users on mount
    const loadProjects = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getProjects();
            setProjects(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message || 'فشل تحميل المشاريع');
        } finally {
            setLoading(false);
        }
    }, [setProjects, setLoading, setError]);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

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
            setError(err.message || 'فشل تحميل بيانات المشروع');
        }
    }, [setSelectedProject, setProjectMembers, setProjectTasks, setError]);

    const handleSelectProject = (project: Project) => {
        loadProjectData(project);
    };

    const handleDeleteProject = async () => {
        if (!selectedProject) return;
        if (!window.confirm(`هل أنت متأكد من حذف مشروع "${selectedProject.name}"؟ سيتم حذف جميع المهام المرتبطة.`)) return;

        setLoading(true);
        try {
            await api.deleteProject(selectedProject.id);
            setSelectedProject(null);
            await loadProjects();
        } catch (err: any) {
            setError(err.message || 'فشل حذف المشروع');
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

    return (
        <div className="plugin-root">
            {/* Sidebar */}
            <aside className="plugin-sidebar">
                <div className="plugin-sidebar__header">
                    <div className="plugin-sidebar__title">
                        <LayoutDashboard />
                        <span>إدارة المشاريع</span>
                    </div>
                    <button
                        className="btn-create-project"
                        onClick={() => setShowCreateProjectDialog(true)}
                    >
                        <Plus />
                        <span>إنشاء مشروع</span>
                    </button>
                </div>

                <div className="plugin-sidebar__projects">
                    {projects.length === 0 && !loading && (
                        <div className="plugin-sidebar__empty">
                            لا توجد مشاريع بعد
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
                        <div className="plugin-main__welcome-title">مرحباً بك في إدارة المشاريع</div>
                        <div className="plugin-main__welcome-desc">
                            اختر مشروعاً من القائمة الجانبية أو أنشئ مشروعاً جديداً للبدء في تنظيم مهامك بلوحة كانبان
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
                                        <span>الأعضاء</span>
                                    </button>
                                    <button
                                        className="btn-danger-outline"
                                        onClick={handleDeleteProject}
                                    >
                                        <Trash2 />
                                        <span>حذف</span>
                                    </button>
                                </div>
                            </div>

                            <div className="plugin-project-header__stats">
                                <div className="plugin-project-header__stat">
                                    <Users size={15} />
                                    <span className="plugin-project-header__stat-value">
                                        {projectMembers.length}
                                    </span>
                                    <span>عضو</span>
                                </div>
                                <div className="plugin-project-header__stat">
                                    <LayoutDashboard size={15} />
                                    <span className="plugin-project-header__stat-value">{totalTasks}</span>
                                    <span>مهمة</span>
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
    );
};