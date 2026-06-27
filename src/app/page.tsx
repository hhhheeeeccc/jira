'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  FolderKanban,
  Users,
  Trash2,
  Inbox,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { CreateProjectDialog } from '@/components/create-project-dialog';
import { MemberManager } from '@/components/member-manager';
import { AddMembersDialog } from '@/components/add-members-dialog';
import { KanbanBoard } from '@/components/kanban-board';

export default function Home() {
  const {
    projects,
    selectedProject,
    members,
    loading,
    setProjects,
    setSelectedProject,
    setMembers,
    setLoading,
    removeProjectFromList,
  } = useAppStore();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [addMembersDialogOpen, setAddMembersDialogOpen] = useState(false);
  const [projectLoading, setProjectLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Initial data load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [projectsRes, membersRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/members'),
        ]);

        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(projectsData);
        }
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setMembers(membersData);
        }
      } catch {
        toast.error('فشل في تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [setProjects, setMembers, setLoading]);

  // Select project and fetch full details
  const selectProject = useCallback(
    async (projectId: string) => {
      setProjectLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) throw new Error('فشل في تحميل المشروع');

        const project = await res.json();
        setSelectedProject(project);
      } catch {
        toast.error('فشل في تحميل تفاصيل المشروع');
      } finally {
        setProjectLoading(false);
      }
    },
    [setSelectedProject]
  );

  // Refresh selected project
  const refreshProject = useCallback(() => {
    if (selectedProject) {
      selectProject(selectedProject.id);
    }
  }, [selectedProject, selectProject]);

  // Delete project
  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/projects?id=${projectId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('فشل في حذف المشروع');
      removeProjectFromList(projectId);
      toast.success('تم حذف المشروع');
    } catch {
      toast.error('فشل في حذف المشروع');
    }
  };

  // Render sidebar
  const renderSidebar = () => (
    <aside
      className={`${
        sidebarCollapsed ? 'w-16' : 'w-72'
      } flex-shrink-0 bg-slate-900 text-white flex flex-col h-screen transition-all duration-300 overflow-hidden`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <FolderKanban className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">
                إدارة المشاريع
              </h1>
              <p className="text-[10px] text-slate-400">Jira Plugin</p>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center mx-auto">
            <FolderKanban className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Create Project Button */}
      <div className="p-3">
        {!sidebarCollapsed ? (
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-start gap-2 text-sm h-9"
          >
            <Plus className="w-4 h-4" />
            إنشاء مشروع
          </Button>
        ) : (
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="w-full p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
            title="إنشاء مشروع"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!sidebarCollapsed && (
          <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            المشاريع
          </p>
        )}
        <ScrollArea className="flex-1 custom-sidebar-scroll">
          <div className="px-2 space-y-0.5 pb-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-2.5">
                  <Skeleton className="h-4 w-3/4 bg-slate-700" />
                </div>
              ))
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                  className={`
                    w-full group flex items-center justify-between p-2.5 rounded-lg text-right
                    transition-all duration-150
                    ${
                      selectedProject?.id === project.id
                        ? 'bg-slate-700/70 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }
                  `}
                >
                  {!sidebarCollapsed ? (
                    <>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FolderKanban className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-blue-400" />
                        <span className="text-sm truncate">{project.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-slate-600 text-slate-300 hover:bg-slate-600 px-1.5 py-0 h-5"
                        >
                          {project._count?.tasks ?? project.tasks?.length ?? 0}
                        </Badge>
                        <button
                          onClick={(e) => handleDeleteProject(e, project.id)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10
                                     opacity-0 group-hover:opacity-100 transition-all"
                          aria-label="حذف المشروع"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <FolderKanban className="w-5 h-5 text-slate-400 group-hover:text-blue-400 mx-auto" />
                  )}
                </button>
              ))
            )}
            {projects.length === 0 && !loading && !sidebarCollapsed && (
              <p className="text-xs text-slate-500 text-center py-6 px-4">
                لا توجد مشاريع بعد
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-slate-700/50 space-y-1">
        {!sidebarCollapsed ? (
          <>
            <Button
              variant="ghost"
              onClick={() => setAddMembersDialogOpen(true)}
              disabled={!selectedProject}
              className="w-full justify-start gap-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 h-9"
            >
              <UserPlus className="w-4 h-4" />
              إضافة أعضاء
            </Button>
            <Button
              variant="ghost"
              onClick={() => setMemberDialogOpen(true)}
              className="w-full justify-start gap-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 h-9"
            >
              <Users className="w-4 h-4" />
              إدارة الأعضاء
            </Button>
          </>
        ) : (
          <>
            <button
              onClick={() => setAddMembersDialogOpen(true)}
              disabled={!selectedProject}
              className="w-full p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors disabled:opacity-30"
              title="إضافة أعضاء"
            >
              <UserPlus className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMemberDialogOpen(true)}
              className="w-full p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
              title="إدارة الأعضاء"
            >
              <Users className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </aside>
  );

  // Render main content
  const renderMainContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Skeleton className="h-12 w-12 rounded-full mx-auto" />
            <Skeleton className="h-5 w-48 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </div>
        </div>
      );
    }

    if (!selectedProject) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <Inbox className="w-8 h-8 text-slate-300" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              مرحباً بك في إدارة المشاريع
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              أنشئ مشروعاً للبدء في تنظيم المهام وإدارتها بسهولة
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              إنشاء مشروع جديد
            </Button>
          </div>
        </div>
      );
    }

    if (projectLoading) {
      return (
        <div className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-36" />
            </div>
          </div>
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-72 flex-shrink-0">
                <Skeleton className="h-12 w-full rounded-t-xl" />
                <div className="p-3 space-y-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Project Header */}
        <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {selectedProject.name}
              </h2>
              {selectedProject.description && (
                <p className="text-sm text-slate-500 mt-0.5">
                  {selectedProject.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Project Members Avatars */}
              <div className="flex items-center -space-x-2 space-x-reverse ml-3">
                {selectedProject.members.slice(0, 4).map((pm) => (
                  <div
                    key={pm.id}
                    className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center border-2 border-white"
                    title={pm.member.name}
                  >
                    {pm.member.name.charAt(0)}
                  </div>
                ))}
                {selectedProject.members.length > 4 && (
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center border-2 border-white">
                    +{selectedProject.members.length - 4}
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddMembersDialogOpen(true)}
                className="gap-1.5 text-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">الأعضاء</span>
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                {selectedProject.tasks.length}
              </span>
              مهمة إجمالاً
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="font-semibold">
                {selectedProject.tasks.filter((t) => t.status === 'done').length}
              </span>
              مكتملة
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <span className="font-semibold">
                {selectedProject.tasks.filter((t) => t.status === 'in_progress').length}
              </span>
              جارية
            </div>
          </div>
        </header>

        {/* Kanban Board */}
        <main className="flex-1 overflow-hidden p-6">
          <KanbanBoard
            project={selectedProject}
            onUpdate={refreshProject}
          />
        </main>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50" dir="rtl">
      {renderSidebar()}

      {renderMainContent()}

      {/* Dialogs */}
      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <MemberManager
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
      />

      {selectedProject && (
        <AddMembersDialog
          project={selectedProject}
          allMembers={members}
          open={addMembersDialogOpen}
          onOpenChange={setAddMembersDialogOpen}
          onUpdate={refreshProject}
        />
      )}
    </div>
  );
}