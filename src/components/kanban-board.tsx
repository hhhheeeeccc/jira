'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
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

  const handleDragOver = (event: DragOverEvent) => {
    // Visual feedback only handled by DnD kit
  };

  const findColumnForTask = (taskId: UniqueIdentifier): TaskStatus | null => {
    const task = project.tasks.find((t) => t.id === taskId);
    return task ? (task.status as TaskStatus) : null;
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

      // Move task to new column
      const columnTasks = getColumnTasks(targetColumn.id as TaskStatus);
      const newOrder = columnTasks.length;

      try {
        await fetch(`/api/tasks/${activeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: targetColumn.id,
            order: newOrder,
          }),
        });
        onUpdate();
      } catch {
        toast.error('فشل في تحديث المهمة');
      }
      return;
    }

    // Check if we're dropping on another task within the same or different column
    const activeColumn = findColumnForTask(activeId);
    const overTask = project.tasks.find((t) => t.id === overId);

    if (!activeColumn || !overTask) return;

    const overColumn = overTask.status as TaskStatus;

    if (activeColumn === overColumn) {
      // Reorder within the same column
      const columnTasks = getColumnTasks(activeColumn);
      const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
      const newIndex = columnTasks.findIndex((t) => t.id === overId);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(columnTasks, oldIndex, newIndex);

      // Update orders
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
      // Move to a different column
      const targetColumnTasks = getColumnTasks(overColumn);
      const overIndex = targetColumnTasks.findIndex((t) => t.id === overId);

      const newOrder = overIndex >= 0 ? overIndex + 1 : targetColumnTasks.length;

      try {
        await fetch(`/api/tasks/${activeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: overColumn,
            order: newOrder,
          }),
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
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
          {KANBAN_COLUMNS.map((column) => {
            const tasks = getColumnTasks(column.id);
            return (
              <div
                key={column.id}
                className="flex-shrink-0 w-72 flex flex-col bg-slate-50 rounded-xl border border-slate-200"
              >
                {/* Column Header */}
                <div className="p-3 rounded-t-xl">
                  <div className={`h-1 w-8 rounded-full ${column.color} mb-3`} />
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">
                      {column.title}
                    </h3>
                    <span className="text-xs bg-white text-slate-500 rounded-full px-2 py-0.5 border border-slate-200 font-medium">
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
                    {tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onDelete={handleDeleteTask}
                      />
                    ))}
                    {tasks.length === 0 && (
                      <div className="flex items-center justify-center h-20 text-xs text-slate-400 border border-dashed border-slate-300 rounded-lg">
                        لا توجد مهام
                      </div>
                    )}
                  </div>
                </SortableContext>

                {/* Add Task Button */}
                <div className="px-3 pb-3">
                  <button
                    onClick={() => {
                      setDefaultStatus(column.id as TaskStatus);
                      setAddTaskOpen(true);
                    }}
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