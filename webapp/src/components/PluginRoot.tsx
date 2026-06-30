import React, { useEffect, useCallback } from 'react';
import { Plus, Users, Trash2, AlertCircle, X, Menu, ChevronDown, FolderPlus } from 'lucide-react';

const KanbanIcon = ({ className, size = 16 }: { className?: string, size?: number | string }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <path d="M8 7v7"/>
        <path d="M12 7v4"/>
        <path d="M16 7v9"/>
    </svg>
);
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import type { Project } from '../types';
import { CreateProjectDialog } from './CreateProjectDialog';
import { AddMembersDialog } from './AddMembersDialog';
import { AddTaskDialog } from './AddTaskDialog';
import { AddColumnDialog } from './AddColumnDialog';
import { EditColumnDialog } from './EditColumnDialog';
import { DeleteColumnDialog } from './DeleteColumnDialog';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import { TaskDetailsDialog } from './TaskDetailsDialog';
import { RemoveMemberDialog } from './RemoveMemberDialog';
import { AlertDialog } from './AlertDialog';
import { KanbanBoard } from './KanbanBoard';
import '../styles/main.css';

export const PluginRoot: React.FC = () => {

    const {
        projects,
        selectedProject,
        currentUser,
        projectMembers,
        projectTasks,
        projectColumns,
        loading,
        error,
        showCreateProjectDialog,
        showAddMembersDialog,
        setProjects,
        setCurrentUser,
        setSelectedProject,
        setProjectMembers,
        setProjectTasks,
        setProjectColumns,
        setLoading,
        setError,
        setShowCreateProjectDialog,
        setShowAddMembersDialog,
        setDeleteProjectInfo,
        selectedTaskDetails,
        setSelectedTaskDetails,
    } = useStore();

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
    const [isCreateDropdownOpen, setIsCreateDropdownOpen] = React.useState(false);
    const [dropdownPos, setDropdownPos] = React.useState({ top: 0, left: 0 });
    const createBtnRef = React.useRef<HTMLButtonElement>(null);
    const createDropdownRef = React.useRef<HTMLDivElement>(null);

    const openCreateDropdown = () => {
        if (createBtnRef.current) {
            const rect = createBtnRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 4,
                left: rect.left,
            });
        }
        setIsCreateDropdownOpen(v => !v);
    };

    // Close dropdown on outside click
    useEffect(() => {
        if (!isCreateDropdownOpen) return;
        const handle = (e: MouseEvent) => {
            const dropEl = createDropdownRef.current;
            const btnEl = createBtnRef.current;
            if (
                dropEl && !dropEl.contains(e.target as Node) &&
                btnEl && !btnEl.contains(e.target as Node)
            ) {
                setIsCreateDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [isCreateDropdownOpen]);

    // Load projects and current user on mount
    const loadProjects = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getProjects();
            setProjects(Array.isArray(data) ? data : []);
            
            const me = await api.getMe();
            setCurrentUser({ id: me.id, isAdmin: me.is_admin });
        } catch (err: any) {
            setError(err.message || 'Failed to load projects');
        } finally {
            setLoading(false);
        }
    }, [setProjects, setCurrentUser, setLoading, setError]);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    // WebSocket sync listener
    useEffect(() => {
        const handleRefresh = (e: any) => {
            const pid = e.detail?.project_id;
            loadProjects();

            if (selectedProject && selectedProject.id === pid) {
                api.getProjectMembers(pid).then(m => {
                    setProjectMembers(Array.isArray(m) ? m : []);
                }).catch(() => {});

                api.getProjectTasks(pid).then(t => {
                    setProjectTasks(Array.isArray(t) ? t : []);
                }).catch(() => {});
                
                api.getProjectColumns(pid).then(c => {
                    setProjectColumns(Array.isArray(c) ? c : []);
                }).catch(() => {});
            }
        };

        window.addEventListener('jira_project_updated', handleRefresh);
        return () => window.removeEventListener('jira_project_updated', handleRefresh);
    }, [selectedProject, loadProjects, setProjectMembers, setProjectTasks, setProjectColumns]);

    // Kick user out if they are removed from the currently selected project
    useEffect(() => {
        if (!selectedProject || loading) return;
        const stillExists = projects.some(p => p.id === selectedProject.id);
        if (!stillExists) {
            setSelectedProject(null);
            setProjectMembers([]);
            setProjectTasks([]);
            setError("لقد تم إزالتك من هذا المشروع، أو تم حذفه.");
        }
    }, [projects, selectedProject, loading, setSelectedProject, setProjectMembers, setProjectTasks, setError]);

    const loadProjectData = useCallback(async (project: Project) => {
        setSelectedProject(project);
        setLoading(true);
        try {
            const [membersData, tasksData, columnsData] = await Promise.all([
                api.getProjectMembers(project.id),
                api.getProjectTasks(project.id),
                api.getProjectColumns(project.id)
            ]);
            setProjectMembers(Array.isArray(membersData) ? membersData : []);
            setProjectTasks(Array.isArray(tasksData) ? tasksData : []);
            setProjectColumns(Array.isArray(columnsData) ? columnsData : []);
        } catch (err: any) {
            setError(err.message || 'فشل تحميل بيانات المشروع');
        } finally {
            setLoading(false);
        }
    }, [setSelectedProject, setProjectMembers, setProjectTasks, setProjectColumns, setLoading, setError]);


    const handleSelectProject = (project: Project) => {
        loadProjectData(project);
    };

    const handleDeleteProject = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!selectedProject) return;
        setDeleteProjectInfo(selectedProject);
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

    const isProjectAdmin = React.useMemo(() => {
        if (!currentUser || !selectedProject) return false;
        const member = projectMembers.find(m => m.user_id === currentUser.id);
        return member?.role === 'admin';
    }, [currentUser, selectedProject, projectMembers]);

    return (
        <div className="plugin-root">
                    {/* Mobile Sidebar Overlay */}
                    <div 
                        className={`plugin-sidebar-overlay ${isMobileSidebarOpen ? 'open' : ''}`} 
                        onClick={() => setIsMobileSidebarOpen(false)}
                    />

                    {/* Sidebar */}
                    <aside className={`plugin-sidebar ${isMobileSidebarOpen ? 'open' : ''}`}>
                        <div className="plugin-sidebar__header">
                            <div className="plugin-sidebar__title">
                                <KanbanIcon />
                                <span>مشاريع جيرا</span>
                            </div>
                            {currentUser?.isAdmin && (
                                <>
                                    <button
                                        ref={createBtnRef}
                                        className="btn-create-icon"
                                        onClick={openCreateDropdown}
                                        title="إنشاء مشروع جديد"
                                        aria-label="قائمة منسدلة لإنشاء مشروع"
                                    >
                                        <Plus size={18} />
                                    </button>
                                    {isCreateDropdownOpen && (
                                        <div
                                            ref={createDropdownRef}
                                            className="btn-create-dropdown"
                                            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
                                        >
                                            <button
                                                className="btn-create-dropdown-item"
                                                onClick={() => {
                                                    setIsCreateDropdownOpen(false);
                                                    setShowCreateProjectDialog(true);
                                                }}
                                            >
                                                <FolderPlus size={15} />
                                                <span>إنشاء مشروع جديد</span>
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
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
                                    onClick={() => {
                                        handleSelectProject(project);
                                        setIsMobileSidebarOpen(false);
                                    }}
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
                        <div className="mobile-top-bar">
                            <button className="mobile-menu-btn" onClick={() => setIsMobileSidebarOpen(true)}>
                                <Menu size={20} />
                            </button>
                            <span className="mobile-top-bar__title">مشاريع جيرا</span>
                        </div>

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
                                <KanbanIcon className="plugin-main__welcome-icon" size={64} />
                                <div className="plugin-main__welcome-title">إدارة المشاريع</div>
                                <div className="plugin-main__welcome-desc">
                                    اختر مشروعاً من القائمة الجانبية أو قم بإنشاء مشروع جديد للبدء في تنظيم مهامك على لوحة كانبان
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
                                            {isProjectAdmin && (
                                                <button
                                                    className="btn-danger-outline"
                                                    onClick={handleDeleteProject}
                                                >
                                                    <Trash2 />
                                                    <span>حذف</span>
                                                </button>
                                            )}
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
                                            <KanbanIcon size={15} />
                                            <span className="plugin-project-header__stat-value">{totalTasks}</span>
                                            <span>مهمة</span>
                                        </div>

                                        {/* Avatars */}
                                        {projectMembers.length > 0 && (
                                            <div className="plugin-project-header__avatars">
                                                {projectMembers.slice(0, 5).map((member) => (
                                                    <img
                                                        key={member.id}
                                                        className="plugin-project-header__avatar"
                                                        title={member.display_name || member.username}
                                                        src={`/api/v4/users/${member.user_id}/image`}
                                                        alt={member.display_name || member.username}
                                                        style={{ objectFit: 'cover' }}
                                                    />
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
                    <AddColumnDialog />
                    <EditColumnDialog />
                    <DeleteColumnDialog />
                    <DeleteProjectDialog />
                    <DeleteTaskDialog />
                    <TaskDetailsDialog />
                    <RemoveMemberDialog />
                    <AlertDialog />
                </div>
    );
};