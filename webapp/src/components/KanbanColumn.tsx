import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import type { Task, ProjectMember } from '../types';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
    id: string;
    title: string;
    color: string;
    tasks: Task[];
    isDragOver: boolean;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
    id,
    title,
    color,
    tasks,
    isDragOver,
}) => {
    const { setEditColumn, setDeleteColumnInfo, setShowAddTaskDialog, projectMembers, setAlertMessage } = useStore();

    const { setNodeRef, isOver } = useDroppable({
        id,
        data: {
            type: 'column',
        },
    });

    const taskIds = tasks.map(t => t.id);

    const handleAddTask = () => {
        setShowAddTaskDialog(true, id);
    };

    const handleEditColumn = () => {
        setEditColumn({ id, title, color } as any);
    };

    const handleDeleteColumn = () => {
        if (tasks.length > 0) {
            setAlertMessage('لا يمكن حذف عمود يحتوي على مهام. يرجى نقل المهام أولاً.');
            return;
        }
        setDeleteColumnInfo({ id, title, color } as any);
    };

    const showDragHighlight = isDragOver || isOver;

    const isDefaultColumn = ['-backlog', '-todo', '-in_progress', '-completed'].some(suffix => id.endsWith(suffix));

    return (
        <div className={`kanban-column ${showDragHighlight ? 'kanban-column--drag-over' : ''}`}>
            <div className="kanban-column__color-bar" style={{ background: color }} />

            <div className="kanban-column__header" style={{ position: 'relative' }}>
                <div className="kanban-column__title-group">
                    <span className="kanban-column__title">{title}</span>
                    <span className="kanban-column__count">{tasks.length}</span>
                </div>
                {!isDefaultColumn && (
                    <div className="kanban-column__actions" style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={handleEditColumn} title="تعديل العمود" aria-label="تعديل العمود" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mm-text-muted)' }}>
                            <Edit2 size={14} />
                        </button>
                        <button onClick={handleDeleteColumn} title="حذف العمود" aria-label="حذف العمود" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mm-error-text)' }}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>

            <div ref={setNodeRef} className="kanban-column__tasks">
                <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                    {tasks.length === 0 ? (
                        <div className="kanban-column__empty">
                            لا توجد مهام
                        </div>
                    ) : (
                        tasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                projectMembers={projectMembers}
                                columnColor={color}
                            />
                        ))
                    )}
                </SortableContext>
            </div>

            <div className="kanban-column__footer">
                <button className="btn-add-task" onClick={handleAddTask}>
                    <Plus size={14} />
                    إضافة مهمة
                </button>
            </div>
        </div>
    );
};