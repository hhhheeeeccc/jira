'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { KANBAN_COLUMNS, type Task, type TaskStatus, type Project } from '@/lib/types';
import { TaskCard } from './task-card';
import { AddTaskDialog } from './add-task-dialog';

function KanbanColumn({
  column,
  tasks,
  onAddTask,
  children,
}: {
  column: (typeof KANBAN_COLUMNS)[number];
  tasks: Task[];
  onAddTask: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 flex flex-col rounded-xl border transition-colors duration-200 ${
        isOver
          ? 'bg-blue-50 border-blue-300'
          : 'bg-slate-50 border-slate-200'
      }`}
    >
      {/* Column Header */}
      <div className="p-3 rounded-t-xl">
        <div className={`h-1 w-8 rounded-full ${column.color} mb-3`} />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            {column.title}
          </h3>
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium border ${
            isOver
              ? 'bg-blue-100 text-blue-600 border-blue-200'
              : 'bg-white text-slate-500 border-slate-200'
          }`}>
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Column Tasks */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 px-3 pb-3 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[120px] custom-scrollbar">
          {children}
          {tasks.length === 0 && (
            <div className={`flex items-center justify-center h-20 text-xs rounded-lg border border-dashed ${
              isOver
                ? 'text-blue-400 border-blue-300 bg-blue-50/50'
                : 'text-slate-400 border-slate-300'
            }`}>
              {isOver ? 'أفلت هنا' : 'لا توجد مهام'}
            </div>
          )}
        </div>
      </SortableContext>

      {/* Add Task Button */}
      <div className="px-3 pb-3">
        <button
          onClick={onAddTask}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs 
                     text-slate-500 hover:text-blue-600 hover:bg-blue-50 
                     rounded-lg transition-colors duration-150 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          إضافة مهمة
        </button>
      </div>
    </div>
  );
}

interface KanbanBoardProps {
  project: Project;
  onUpdate: () => void;
}

export function KanbanBoard({ project, onUpdate }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('backlog');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const getColumnTasks = useCallback(
    (status: TaskStatus) =>
      project.tasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.order - b.order),
    [project.tasks]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = project.tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Check if we're dropping on a column directly
    const targetColumn = KANBAN_COLUMNS.find((col) => col.id === overId);
    if (targetColumn) {
      const task = project.tasks.find((t) => t.id === activeId);
      if (!task || task.status === targetColumn.id) return;

      const columnTasks = getColumnTasks(targetColumn.id as TaskStatus);
      const newOrder = columnTasks.length;

      try {
        const updateData: Record<string, unknown> = {
          status: targetColumn.id,
          order: newOrder,
        };
        // If moving to backlog, remove assignee
        if (targetColumn.id === 'backlog') {
          updateData.assigneeId = null;
        }

        await fetch(`/api/tasks/${activeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });
        onUpdate();
      } catch {
        toast.error('فشل في تحديث المهمة');
      }
      return;
    }

    // Check if we're dropping on another task
    const activeTaskData = project.tasks.find((t) => t.id === activeId);
    const overTask = project.tasks.find((t) => t.id === overId);

    if (!activeTaskData || !overTask) return;

    const activeColumn = activeTaskData.status as TaskStatus;
    const overColumn = overTask.status as TaskStatus;

    if (activeColumn === overColumn) {
      // Reorder within the same column
      const columnTasks = getColumnTasks(activeColumn);
      const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
      const newIndex = columnTasks.findIndex((t) => t.id === overId);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(columnTasks, oldIndex, newIndex);

      try {
        await Promise.all(
          reordered.map((task, index) =>
            fetch(`/api/tasks/${task.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order: index }),
            })
          )
        );
        onUpdate();
      } catch {
        toast.error('فشل في إعادة ترتيب المهام');
      }
    } else {
      // Move to a different column (dropped on a task in another column)
      const targetColumnTasks = getColumnTasks(overColumn);
      const overIndex = targetColumnTasks.findIndex((t) => t.id === overId);
      const newOrder = overIndex >= 0 ? overIndex + 1 : targetColumnTasks.length;

      try {
        const updateData: Record<string, unknown> = {
          status: overColumn,
          order: newOrder,
        };
        if (overColumn === 'backlog') {
          updateData.assigneeId = null;
        }

        await fetch(`/api/tasks/${activeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });
        onUpdate();
      } catch {
        toast.error('فشل في نقل المهمة');
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      onUpdate();
      toast.success('تم حذف المهمة');
    } catch {
      toast.error('فشل في حذف المهمة');
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
          {KANBAN_COLUMNS.map((column) => {
            const tasks = getColumnTasks(column.id);
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasks}
                onAddTask={() => {
                  setDefaultStatus(column.id as TaskStatus);
                  setAddTaskOpen(true);
                }}
              >
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </KanbanColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} />}
        </DragOverlay>
      </DndContext>

      <AddTaskDialog
        projectId={project.id}
        projectMembers={project.members}
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        defaultStatus={defaultStatus}
        onTaskCreated={onUpdate}
      />
    </>
  );
}