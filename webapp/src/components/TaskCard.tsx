import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, CalendarDays, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import type { Task, ProjectMember } from '../types';

const PRIORITY_LABELS: Record<string, string> = {
    low: 'منخفض',
    medium: 'متوسط',
    high: 'عالي',
    critical: 'حرج',
};

interface TaskCardProps {
    task: Task;
    projectMembers: ProjectMember[];
    isOverlay?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, projectMembers, isOverlay = false }) => {
    const { selectedProject, setProjectTasks, setError } = useStore();
    const [deleting, setDeleting] = React.useState(false);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: task.id,
        data: {
            type: 'task',
            task,
        },
    });

    const style = isOverlay
        ? { padding: 12, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 8, width: 260 }
        : {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.4 : 1,
        };

    const assignee = task.assignee_id
        ? projectMembers.find(m => m.user_id === task.assignee_id)
        : null;

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!selectedProject) return;

        setDeleting(true);
        try {
            await api.deleteTask(task.id);
            const tasks = await api.getProjectTasks(selectedProject.id);
            setProjectTasks(Array.isArray(tasks) ? tasks : []);
        } catch (err: any) {
            setError(err.message || 'فشل حذف المهمة');
        } finally {
            setDeleting(false);
        }
    };

    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

    const formatDueDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ar-SA', {
            month: 'short',
            day: 'numeric',
        });
    };

    if (isOverlay) {
        return (
            <div className="drag-overlay" style={style}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 8 }}>{task.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`task-card__priority task-card__priority--${task.priority}`}>
                        {PRIORITY_LABELS[task.priority]}
                    </span>
                    {assignee && (
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                            {assignee.display_name || assignee.username}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`task-card ${isDragging ? 'task-card--dragging' : ''}`}
            {...attributes}
            {...listeners}
        >
            <button
                className="task-card__delete"
                onClick={handleDelete}
                disabled={deleting}
                title="حذف المهمة"
            >
                <Trash2 size={14} />
            </button>

            <div className="task-card__title">{task.title}</div>

            {task.description && (
                <div className="task-card__description">{task.description}</div>
            )}

            <div className="task-card__meta">
                <span className={`task-card__priority task-card__priority--${task.priority}`}>
                    {PRIORITY_LABELS[task.priority]}
                </span>

                {assignee && (
                    <div className="task-card__assignee">
                        <div className="task-card__assignee-avatar">
                            {(assignee.display_name || assignee.username).substring(0, 1).toUpperCase()}
                        </div>
                        <span className="task-card__assignee-name">
                            {assignee.display_name || assignee.username}
                        </span>
                    </div>
                )}

                {task.due_date && (
                    <div className={`task-card__due ${isOverdue ? 'task-card__due--overdue' : ''}`}>
                        <CalendarDays size={13} />
                        <span>{formatDueDate(task.due_date)}</span>
                    </div>
                )}

                {task.due_time && (
                    <div className="task-card__due">
                        <Clock size={13} />
                        <span>{task.due_time}</span>
                    </div>
                )}
            </div>
        </div>
    );
};