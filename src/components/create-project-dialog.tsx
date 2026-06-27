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
import { toast } from 'sonner';
import type { Project } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { setProjects, setSelectedProject } = useAppStore();

  const resetForm = () => {
    setName('');
    setDescription('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم المشروع');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'فشل في إنشاء المشروع');
      }

      const newProject: Project = await res.json();

      // Refresh project list
      const projectsRes = await fetch('/api/projects');
      if (projectsRes.ok) {
        const allProjects = await projectsRes.json();
        setProjects(allProjects);
      }

      // Fetch full project details and select it
      const detailRes = await fetch(`/api/projects/${newProject.id}`);
      if (detailRes.ok) {
        const fullProject = await detailRes.json();
        setSelectedProject(fullProject);
      }

      toast.success('تم إنشاء المشروع بنجاح');
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            إنشاء مشروع جديد
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-sm font-medium text-slate-700">
              اسم المشروع <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="أدخل اسم المشروع..."
              className="text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-desc" className="text-sm font-medium text-slate-700">
              الوصف
            </Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="أدخل وصف المشروع (اختياري)..."
              rows={3}
              className="text-sm resize-none"
            />
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
              disabled={submitting || !name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              {submitting ? 'جاري الإنشاء...' : 'إنشاء المشروع'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
