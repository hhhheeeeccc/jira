'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Task } from '@/lib/types';

const priorityConfig = {
  low: { label: 'منخفض', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  medium: { label: 'متوسط', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  high: { label: 'عالي', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  critical: { label: 'حرج', color: 'bg-red-100 text-red-700 border-red-200' },
} as const;

interface TaskCardProps {
  task: Task;
  onDelete?: (taskId: string) => void;
}

export function TaskCard({ task, onDelete }: TaskCardProps) {
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = priorityConfig[task.priority];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        relative group bg-white rounded-lg border border-slate-200 p-3 cursor-grab active:cursor-grabbing
        hover:shadow-md hover:border-slate-300 transition-all duration-200
        ${isDragging ? 'opacity-50 shadow-lg rotate-2 scale-105 z-50' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-slate-800 leading-relaxed flex-1">
          {task.title}
        </h4>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${priority.color}`}>
          {priority.label}
        </Badge>
      </div>

      {task.description && (
        <p className="text-xs text-slate-500 mb-2 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {task.assignee && (
            <div className="flex items-center gap-1">
              <Avatar className="w-5 h-5">
                <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700">
                  {task.assignee.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px] text-slate-500 max-w-[100px] truncate">
                {task.assignee.name}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {task.dueDate && (
            <div className="flex items-center gap-0.5 text-[10px] text-slate-400">
              <Calendar className="w-3 h-3" />
              <span>{task.dueDate}</span>
            </div>
          )}
          {task.dueTime && (
            <div className="flex items-center gap-0.5 text-[10px] text-slate-400">
              <Clock className="w-3 h-3" />
              <span>{task.dueTime}</span>
            </div>
          )}
        </div>
      </div>

      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="absolute top-1 left-1 w-5 h-5 flex items-center justify-center 
                     rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 
                     opacity-0 group-hover:opacity-100 transition-all duration-150"
          aria-label="حذف المهمة"
        >
          ×
        </button>
      )}
    </div>
  );
}