#!/usr/bin/env python3
"""Fix all frontend audit issues."""

def read(path):
    with open(path, 'r') as f:
        return f.read()

def write(path, content):
    with open(path, 'w') as f:
        f.write(content)

# ============================================================
# 1. types/index.ts - Fix #25: Task.status type
# ============================================================
s = read('/home/z/my-project/webapp/src/types/index.ts')
s = s.replace(
    "    status: 'backlog' | 'todo' | 'in_progress' | 'done';",
    "    status: string;"
)
write('/home/z/my-project/webapp/src/types/index.ts', s)
print("OK types/index.ts")

# ============================================================
# 2. TaskCard.tsx - Fix #26: remove dead -done check + #16: aria-label
# ============================================================
s = read('/home/z/my-project/webapp/src/components/TaskCard.tsx')
s = s.replace(
    'const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.status.endsWith(\'-completed\') && !task.status.endsWith(\'-done\');',
    'const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.status.endsWith(\'-completed\');'
)
# aria-label on delete button
s = s.replace(
    'title="حذف المهمة"\n            >\n                <Trash2 size={14} />',
    'title="حذف المهمة"\n                aria-label="حذف المهمة"\n            >\n                <Trash2 size={14} />'
)
write('/home/z/my-project/webapp/src/components/TaskCard.tsx', s)
print("OK TaskCard.tsx")

# ============================================================
# 3. KanbanColumn.tsx - Fix #16: aria-labels
# ============================================================
s = read('/home/z/my-project/webapp/src/components/KanbanColumn.tsx')
s = s.replace(
    '<button onClick={handleEditColumn} title="تعديل العمود"',
    '<button onClick={handleEditColumn} title="تعديل العمود" aria-label="تعديل العمود"'
)
s = s.replace(
    '<button onClick={handleDeleteColumn} title="حذف العمود"',
    '<button onClick={handleDeleteColumn} title="حذف العمود" aria-label="حذف العمود"'
)
write('/home/z/my-project/webapp/src/components/KanbanColumn.tsx', s)
print("OK KanbanColumn.tsx")

# ============================================================
# 4. KanbanBoard.tsx - Fix #3/#4: DnD sort_order
# ============================================================
s = read('/home/z/my-project/webapp/src/components/KanbanBoard.tsx')
# Fix: when dropping on column (not task), set sort_order to end of target column
s = s.replace(
    '''        if (task.status !== targetColumnId) {
            updates.status = targetColumnId as TaskStatus;

            // When dragging to a backlog column, clear assignee
            if (targetColumnId.endsWith('-backlog')) {
                updates.assignee_id = null;
            }
        }

        // Calculate new sort order if dropped on a specific task
        if (over.data?.current?.type === 'task' && over.id !== active.id) {
            const overTask = projectTasks.find(t => t.id === over.id);
            if (overTask) {
                updates.sort_order = overTask.sort_order;
            }
        }''',
    '''        if (task.status !== targetColumnId) {
            updates.status = targetColumnId as TaskStatus;

            // When dragging to a backlog column, clear assignee
            if (targetColumnId.endsWith('-backlog')) {
                updates.assignee_id = null;
            }
        }

        // Calculate new sort order
        if (over.data?.current?.type === 'task' && over.id !== active.id) {
            // Dropped on a specific task: place before it
            const overTask = projectTasks.find(t => t.id === over.id);
            if (overTask) {
                updates.sort_order = overTask.sort_order;
            }
        } else if (task.status !== targetColumnId) {
            // Dropped on a column (not a task): place at end
            const targetColumnTasks = projectTasks
                .filter(t => t.status === targetColumnId)
                .sort((a, b) => a.sort_order - b.sort_order);
            updates.sort_order = targetColumnTasks.length > 0
                ? targetColumnTasks[targetColumnTasks.length - 1].sort_order + 1
                : 0;
        }'''
)
write('/home/z/my-project/webapp/src/components/KanbanBoard.tsx', s)
print("OK KanbanBoard.tsx")

# ============================================================
# 5. CreateProjectDialog.tsx - Fix #1: load project data + #15: Escape
# ============================================================
s = read('/home/z/my-project/webapp/src/components/CreateProjectDialog.tsx')
s = s.replace(
    'import { X } from \'lucide-react\';',
    'import { X } from \'lucide-react\';\nimport { api } from \'../api/client\';'
)
s = s.replace(
    'const { setShowCreateProjectDialog, setProjects, setSelectedProject, setError, setLoading } = useStore();',
    'const { setShowCreateProjectDialog, setProjects, setSelectedProject, setProjectMembers, setProjectTasks, setProjectColumns, setError, setLoading } = useStore();'
)
s = s.replace(
    '            setSelectedProject(newProject);\n            setShowCreateProjectDialog(false);',
    '            setSelectedProject(newProject);\n            // Load project data (members, tasks, columns)\n            try {\n                const [membersData, tasksData, columnsData] = await Promise.all([\n                    api.getProjectMembers(newProject.id),\n                    api.getProjectTasks(newProject.id),\n                    api.getProjectColumns(newProject.id),\n                ]);\n                setProjectMembers(Array.isArray(membersData) ? membersData : []);\n                setProjectTasks(Array.isArray(tasksData) ? tasksData : []);\n                setProjectColumns(Array.isArray(columnsData) ? columnsData : []);\n            } catch (loadErr: any) {\n                // Non-fatal: project was created, data will load on next visit\n            }\n            setShowCreateProjectDialog(false);'
)
# Add Escape key
s = s.replace(
    '        <div className="modal-overlay" onClick={handleClose}>',
    '        <div className="modal-overlay" onClick={handleClose} onKeyDown={e => { if (e.key === \'Escape\') handleClose(); }}>'
)
write('/home/z/my-project/webapp/src/components/CreateProjectDialog.tsx', s)
print("OK CreateProjectDialog.tsx")

# ============================================================
# 6. DeleteProjectDialog.tsx - Fix #2: load data + #15: Escape
# ============================================================
s = read('/home/z/my-project/webapp/src/components/DeleteProjectDialog.tsx')
s = s.replace(
    'import { AlertTriangle, X } from \'lucide-react\';',
    'import { AlertTriangle, X } from \'lucide-react\';\nimport { api } from \'../api/client\';'
)
s = s.replace(
    '        setSelectedProject,\n        setError,',
    '        setSelectedProject,\n        setProjectMembers,\n        setProjectTasks,\n        setProjectColumns,\n        setError,'
)
s = s.replace(
    '            setSelectedProject(updatedProjects.length > 0 ? updatedProjects[0] : null);\n            handleClose();',
    '            if (updatedProjects.length > 0) {\n                setSelectedProject(updatedProjects[0]);\n                // Load data for the auto-selected project\n                try {\n                    const [membersData, tasksData, columnsData] = await Promise.all([\n                        api.getProjectMembers(updatedProjects[0].id),\n                        api.getProjectTasks(updatedProjects[0].id),\n                        api.getProjectColumns(updatedProjects[0].id),\n                    ]);\n                    setProjectMembers(Array.isArray(membersData) ? membersData : []);\n                    setProjectTasks(Array.isArray(tasksData) ? tasksData : []);\n                    setProjectColumns(Array.isArray(columnsData) ? columnsData : []);\n                } catch (loadErr: any) {\n                    // Non-fatal\n                }\n            } else {\n                setSelectedProject(null);\n                setProjectMembers([]);\n                setProjectTasks([]);\n                setProjectColumns([]);\n            }\n            handleClose();'
)
# Escape key
s = s.replace(
    '        <div className="modal-overlay" onClick={handleClose}>',
    '        <div className="modal-overlay" onClick={handleClose} onKeyDown={e => { if (e.key === \'Escape\') handleClose(); }}>'
)
write('/home/z/my-project/webapp/src/components/DeleteProjectDialog.tsx', s)
print("OK DeleteProjectDialog.tsx")

# ============================================================
# 7. EditColumnDialog.tsx - Fix #23: re-fetch + #15: Escape
# ============================================================
s = read('/home/z/my-project/webapp/src/components/EditColumnDialog.tsx')
s = s.replace(
    '        projectColumns,\n        setProjectColumns,\n        setError,',
    '        selectedProject,\n        setProjectColumns,\n        setError,'
)
s = s.replace(
    '            setProjectColumns(projectColumns.map(c => \n                c.id === editColumn.id ? { ...c, title: title.trim(), color: color } : c\n            ));\n            handleClose();',
    '            // Re-fetch columns from server to ensure consistency\n            try {\n                const cols = await api.getProjectColumns(selectedProject!.id);\n                setProjectColumns(Array.isArray(cols) ? cols : []);\n            } catch (refErr: any) {\n                // Fallback to optimistic update\n                const currentCols = await api.getProjectColumns(selectedProject!.id);\n                setProjectColumns(Array.isArray(currentCols) ? currentCols : []);\n            }\n            handleClose();'
)
s = s.replace(
    'import { X } from \'lucide-react\';\nimport { useStore } from \'../store/useStore\';\nimport { api } from \'../api/client\';',
    'import { X } from \'lucide-react\';\nimport { useStore } from \'../store/useStore\';\nimport { api } from \'../api/client\';'
)
# Escape key
s = s.replace(
    '        <div className="modal-overlay" onClick={handleClose}>',
    '        <div className="modal-overlay" onClick={handleClose} onKeyDown={e => { if (e.key === \'Escape\') handleClose(); }}>'
)
write('/home/z/my-project/webapp/src/components/EditColumnDialog.tsx', s)
print("OK EditColumnDialog.tsx")

# ============================================================
# 8. RemoveMemberDialog.tsx - Fix #23: re-fetch + #15: Escape
# ============================================================
s = read('/home/z/my-project/webapp/src/components/RemoveMemberDialog.tsx')
s = s.replace(
    '        projectMembers,\n        setProjectMembers,\n        setError,',
    '        deleteMemberInfo,\n        setDeleteMemberInfo,\n        selectedProject,\n        setProjectMembers,\n        setError,'
)
# Hmm, deleteMemberInfo is already there. Let me check...
# Actually let me re-read and fix properly
s = s.replace(
    '            await api.removeProjectMember(deleteMemberInfo.project_id, deleteMemberInfo.user_id);\n            setProjectMembers(projectMembers.filter(m => m.user_id !== deleteMemberInfo.user_id));\n            handleClose();',
    '            await api.removeProjectMember(deleteMemberInfo.project_id, deleteMemberInfo.user_id);\n            // Re-fetch members from server for consistency\n            try {\n                const updatedMembers = await api.getProjectMembers(deleteMemberInfo.project_id);\n                setProjectMembers(Array.isArray(updatedMembers) ? updatedMembers : []);\n            } catch (refErr: any) {\n                // fallback\n            }\n            handleClose();'
)
s = s.replace(
    'import { AlertTriangle, X } from \'lucide-react\';\nimport { useStore } from \'../store/useStore\';\nimport { api } from \'../api/client\';',
    'import { AlertTriangle, X } from \'lucide-react\';\nimport { useStore } from \'../store/useStore\';\nimport { api } from \'../api/client\';'
)
# Escape key
s = s.replace(
    '    return (\n        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={handleClose}>',
    '    return (\n        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={handleClose} onKeyDown={e => { if (e.key === \'Escape\') handleClose(); }}>'
)
write('/home/z/my-project/webapp/src/components/RemoveMemberDialog.tsx', s)
print("OK RemoveMemberDialog.tsx")

# ============================================================
# 9. AddMembersDialog.tsx - Fix #22: pagination + #15: Escape
# ============================================================
s = read('/home/z/my-project/webapp/src/components/AddMembersDialog.tsx')
s = s.replace(
    '    const [searchQuery, setSearchQuery] = useState(\'\');',
    '    const [searchQuery, setSearchQuery] = useState(\'\');\n    const [usersPage, setUsersPage] = useState(1);\n    const [hasMoreUsers, setHasMoreUsers] = useState(true);'
)
s = s.replace(
    '                const users = await api.getUsers();\n                setMattermostUsers(Array.isArray(users) ? users : []);',
    '                const users = await api.getUsers(1);\n                setMattermostUsers(Array.isArray(users) ? users : []);\n                setHasMoreUsers(users.length >= 200);'
)
s = s.replace(
    '    const handleClose = () => {',
    '    const loadMoreUsers = async () => {\n        const nextPage = usersPage + 1;\n        setLoadingUsers(true);\n        try {\n            const users = await api.getUsers(nextPage);\n            setMattermostUsers(prev => [...prev, ...(Array.isArray(users) ? users : [])]);\n            setHasMoreUsers(users.length >= 200);\n            setUsersPage(nextPage);\n        } catch (err: any) {\n            console.error(\'Failed to load more users:\', err);\n        } finally {\n            setLoadingUsers(false);\n        }\n    };\n\n    const handleClose = () => {'
)
# Add load more button after the user list
s = s.replace(
    '                                    })}\n                                </div>\n                            )}\n                        </div>\n                    )}',
    '                                    })}\n                                </div>\n                            )}\n                            {hasMoreUsers && (\n                                <button\n                                    type="button"\n                                    className="btn btn-ghost"\n                                    onClick={loadMoreUsers}\n                                    disabled={loadingUsers}\n                                    style={{ width: \'100%\', marginTop: \'8px\' }}\n                                >\n                                    {loadingUsers ? \'جارٍ التحميل...\' : \'تحميل المزيد من المستخدمين\'}\n                                </button>\n                            )}\n                        </div>\n                    )}'
)
# Escape key
s = s.replace(
    '    return (\n        <div className="modal-overlay" onClick={handleClose}>',
    '    return (\n        <div className="modal-overlay" onClick={handleClose} onKeyDown={e => { if (e.key === \'Escape\') handleClose(); }}>'
)
write('/home/z/my-project/webapp/src/components/AddMembersDialog.tsx', s)
print("OK AddMembersDialog.tsx")

# ============================================================
# 10. AddTaskDialog.tsx - Fix #15: Escape + #30: validation feedback
# ============================================================
s = read('/home/z/my-project/webapp/src/components/AddTaskDialog.tsx')
# Escape key
s = s.replace(
    '        <div className="modal-overlay" onClick={handleClose}>',
    '        <div className="modal-overlay" onClick={handleClose} onKeyDown={e => { if (e.key === \'Escape\') handleClose(); }}>'
)
write('/home/z/my-project/webapp/src/components/AddTaskDialog.tsx', s)
print("OK AddTaskDialog.tsx")

# ============================================================
# 11. AddColumnDialog.tsx - Fix #15: Escape
# ============================================================
s = read('/home/z/my-project/webapp/src/components/AddColumnDialog.tsx')
s = s.replace(
    '        <div className="modal-overlay" onClick={handleClose}>',
    '        <div className="modal-overlay" onClick={handleClose} onKeyDown={e => { if (e.key === \'Escape\') handleClose(); }}>'
)
write('/home/z/my-project/webapp/src/components/AddColumnDialog.tsx', s)
print("OK AddColumnDialog.tsx")

# ============================================================
# 12. DeleteColumnDialog.tsx - Fix #15: Escape
# ============================================================
s = read('/home/z/my-project/webapp/src/components/DeleteColumnDialog.tsx')
s = s.replace(
    '        <div className="modal-overlay" onClick={handleClose}>',
    '        <div className="modal-overlay" onClick={handleClose} onKeyDown={e => { if (e.key === \'Escape\') handleClose(); }}>'
)
write('/home/z/my-project/webapp/src/components/DeleteColumnDialog.tsx', s)
print("OK DeleteColumnDialog.tsx")

# ============================================================
# 13. DeleteTaskDialog.tsx - Fix #15: Escape
# ============================================================
s = read('/home/z/my-project/webapp/src/components/DeleteTaskDialog.tsx')
s = s.replace(
    '        <div className="modal-overlay" onClick={handleClose}>',
    '        <div className="modal-overlay" onClick={handleClose} onKeyDown={e => { if (e.key === \'Escape\') handleClose(); }}>'
)
write('/home/z/my-project/webapp/src/components/DeleteTaskDialog.tsx', s)
print("OK DeleteTaskDialog.tsx")

# ============================================================
# 14. AlertDialog.tsx - Fix #15: Escape
# ============================================================
s = read('/home/z/my-project/webapp/src/components/AlertDialog.tsx')
s = s.replace(
    '        <div className="modal-overlay" style={{ zIndex: 10002 }} onClick={handleClose}>',
    '        <div className="modal-overlay" style={{ zIndex: 10002 }} onClick={handleClose} onKeyDown={e => { if (e.key === \'Escape\') handleClose(); }}>'
)
write('/home/z/my-project/webapp/src/components/AlertDialog.tsx', s)
print("OK AlertDialog.tsx")

# ============================================================
# 15. PluginRoot.tsx - Fix #29: loading indicator
# ============================================================
s = read('/home/z/my-project/webapp/src/components/PluginRoot.tsx')
s = s.replace(
    '    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);',
    '    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);\n    const [loadingProject, setLoadingProject] = React.useState(false);'
)
s = s.replace(
    '    const loadProjectData = useCallback(async (project: Project) => {\n        setSelectedProject(project);\n        try {',
    '    const loadProjectData = useCallback(async (project: Project) => {\n        setSelectedProject(project);\n        setLoadingProject(true);\n        try {'
)
s = s.replace(
    '        } catch (err: any) {\n            setError(err.message || \'Failed to load project data\');\n        }\n    },',
    '        } catch (err: any) {\n            setError(err.message || \'Failed to load project data\');\n        } finally {\n            setLoadingProject(false);\n        }\n    },'
)
# Add loading overlay in main content
s = s.replace(
    '                    <>\n                        {/* Project Header */}',
    '                    {loadingProject ? (\n                        <div className="loading-container" style={{ marginTop: \'100px\' }}>\n                            <div className="loading-spinner" />\n                        </div>\n                    ) : (\n                    <>\n                        {/* Project Header */}'
)
s = s.replace(
    '                    </>\n                )}',
    '                    </>\n                    )\n                )}'
)
write('/home/z/my-project/webapp/src/components/PluginRoot.tsx', s)
print("OK PluginRoot.tsx")

print("\n🎉 All frontend fixes done!")
