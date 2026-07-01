import React from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
} from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import { type Task, type TaskStatus } from '../types';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';

export const KanbanBoard: React.FC = () => {
    const {
        selectedProject,
        projectTasks,
        projectMembers,
        projectColumns,
        setProjectTasks,
        setShowAddColumnDialog,
        setError,
        currentUser,
    } = useStore();

    const isProjectAdmin = React.useMemo(() => {
        if (!currentUser || !selectedProject) return false;
        const member = projectMembers.find(m => m.user_id === currentUser.id);
        return member?.role === 'admin';
    }, [currentUser, selectedProject, projectMembers]);

    const [activeTask, setActiveTask] = React.useState<Task | null>(null);
    const [activeOverColumnId, setActiveOverColumnId] = React.useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const getColumnTasks = (columnId: string): Task[] => {
        return projectTasks
            .filter(t => t.status === columnId)
            .sort((a, b) => a.sort_order - b.sort_order);
    };

    const handleAddColumn = () => {
        if (!selectedProject) return;
        setShowAddColumnDialog(true);
    };

    const handleDragStart = (event: DragStartEvent) => {
        const task = projectTasks.find(t => t.id === event.active.id);
        if (task) {
            setActiveTask(task);
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        // Detect which column we're over
        const { over } = event;
        if (over?.data?.current?.type === 'column') {
            setActiveOverColumnId(over.id as string);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveTask(null);
        setActiveOverColumnId(null);

        const { active, over } = event;
        if (!over) return;

        const taskId = active.id as string;
        const task = projectTasks.find(t => t.id === taskId);
        if (!task) return;

        // Determine the target column
        let targetColumnId: string;

        if (over.data?.current?.type === 'column') {
            // Dropped on a column (not on a task)
            targetColumnId = over.id as string;
        } else if (over.data?.current?.type === 'task') {
            // Dropped on a task - find which column that task is in
            const overTask = projectTasks.find(t => t.id === over.id);
            if (!overTask) return;
            targetColumnId = overTask.status;
        } else {
            return;
        }

        // If dropped in the same position, do nothing
        if (task.status === targetColumnId && over.id === active.id) return;

        // Prepare update data
        const updates: Record<string, unknown> = {};

        if (task.status !== targetColumnId) {
            updates.status = targetColumnId as TaskStatus;

            // When dragging to backlog, clear assignee
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
        }

        try {
            await api.updateTask(taskId, updates);
            // Refresh tasks
            const updatedTasks = await api.getProjectTasks(task.project_id);
            setProjectTasks(Array.isArray(updatedTasks) ? updatedTasks : []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'فشل تحديث المهمة';
            setError(message);
            // Refresh to restore state
            const currentTasks = await api.getProjectTasks(task.project_id);
            setProjectTasks(Array.isArray(currentTasks) ? currentTasks : []);
        }
    };

    return (
        <div className="kanban-board">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                {projectColumns.map(column => (
                    <KanbanColumn
                        key={column.id}
                        column={column}
                        tasks={getColumnTasks(column.id)}
                        isDragOver={activeOverColumnId === column.id}
                    />
                ))}

                {isProjectAdmin && (
                    <div className="add-column-container" style={{ minWidth: 280, padding: '0 8px' }}>
                        <button
                            onClick={handleAddColumn}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                padding: '12px',
                                background: 'var(--mm-surface)',
                                border: '1px dashed var(--mm-border)',
                                borderRadius: 'var(--mm-radius)',
                                color: 'var(--mm-text-muted)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--mm-text-muted)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--mm-border)'}
                        >
                            <Plus size={16} />
                            <span>إضافة عمود</span>
                        </button>
                    </div>
                )}

                <DragOverlay dropAnimation={{
                    duration: 250,
                    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                }}>
                    {activeTask ? (
                        <TaskCard
                            task={activeTask}
                            projectMembers={projectMembers}
                            isOverlay
                            columnColor={projectColumns.find(c => c.id === (activeOverColumnId || activeTask.status))?.color}
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};