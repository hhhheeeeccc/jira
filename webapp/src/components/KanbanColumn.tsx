import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
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
    const { projectMembers, setShowAddTaskDialog } = useStore();

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

    const showDragHighlight = isDragOver || isOver;

    return (
        <div className={`kanban-column ${showDragHighlight ? 'kanban-column--drag-over' : ''}`}>
            <div className="kanban-column__color-bar" style={{ background: color }} />

            <div className="kanban-column__header">
                <div className="kanban-column__title-group">
                    <span className="kanban-column__title">{title}</span>
                    <span className="kanban-column__count">{tasks.length}</span>
                </div>
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