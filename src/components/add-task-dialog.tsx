'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { ProjectMember, TaskStatus } from '@/lib/types';

const priorityOptions = [
  { value: 'low', label: 'منخفض' },
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'عالي' },
  { value: 'critical', label: 'حرج' },
] as const;

interface AddTaskDialogProps {
  projectId: string;
  projectMembers: ProjectMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: TaskStatus;
  onTaskCreated: () => void;
}

export function AddTaskDialog({
  projectId,
  projectMembers,
  open,
  onOpenChange,
  defaultStatus = 'backlog',
  onTaskCreated,
}: AddTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [assigneeId, setAssigneeId] = useState<string>('none');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setDueTime('');
    setPriority('medium');
    setAssigneeId('none');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('يرجى إدخال عنوان المهمة');
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, string | null> = {
        title: title.trim(),
        description: description.trim() || null,
        dueDate: dueDate || null,
        dueTime: dueTime || null,
        priority,
      };

      if (assigneeId !== 'none') {
        body.assigneeId = assigneeId;
      }

      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'فشل في إنشاء المهمة');
      }

      toast.success('تم إنشاء المهمة بنجاح');
      resetForm();
      onOpenChange(false);
      onTaskCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            إضافة مهمة جديدة
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title" className="text-sm font-medium text-slate-700">
              عنوان المهمة <span className="text-red-500">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="أدخل عنوان المهمة..."
              className="text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc" className="text-sm font-medium text-slate-700">
              الوصف
            </Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="أدخل وصف المهمة (اختياري)..."
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-date" className="text-sm font-medium text-slate-700">
                تاريخ الاستحقاق
              </Label>
              <Input
                id="task-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-time" className="text-sm font-medium text-slate-700">
                الوقت
              </Label>
              <Input
                id="task-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                الأولوية
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                المسؤول
              </Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="اختر مسؤولاً" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مسؤول</SelectItem>
                  {projectMembers.map((pm) => (
                    <SelectItem key={pm.memberId} value={pm.memberId}>
                      {pm.member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              className="text-sm"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              {submitting ? 'جاري الإنشاء...' : 'إنشاء المهمة'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
