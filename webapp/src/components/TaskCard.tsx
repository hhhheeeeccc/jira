import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, CalendarDays, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';
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
    columnColor?: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, projectMembers, isOverlay = false, columnColor }) => {
    const { currentUser, setDeleteTaskInfo, setSelectedTaskDetails } = useStore();

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
        ? { padding: 12, background: 'var(--center-channel-bg)', border: '1px solid var(--center-channel-bg)', borderRadius: 8, width: 260, color: 'var(--center-channel-color)' }
        : {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.4 : 1,
            borderRight: columnColor ? `4px solid ${columnColor}` : undefined,
        };

    const assignee = task.assignee_id
        ? projectMembers.find(m => m.user_id === task.assignee_id)
        : null;

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteTaskInfo(task);
    };

    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.status.endsWith('-completed');

    const canDelete = React.useMemo(() => {
        if (!currentUser) return false;
        if (task.assignee_id === currentUser.id) return true;

        const member = projectMembers.find(m => m.user_id === currentUser.id);
        return member?.role === 'admin';
    }, [currentUser, task.assignee_id, projectMembers]);

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
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{task.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`task-card__priority task-card__priority--${task.priority}`}>
                        {PRIORITY_LABELS[task.priority]}
                    </span>
                    {assignee && (
                        <span style={{ fontSize: 12 }}>
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
            onClick={() => setSelectedTaskDetails(task)}
        >
            {canDelete && (
                <button
                    className="task-card__delete"
                    onClick={handleDelete}
                    title="حذف المهمة"
                    aria-label="حذف المهمة"
                >
                    <Trash2 size={14} />
                </button>
            )}

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
                        <img
                            className="task-card__assignee-avatar"
                            src={`/api/v4/users/${assignee.user_id}/image`}
                            alt={assignee.display_name || assignee.username}
                            style={{ objectFit: 'cover' }}
                        />
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