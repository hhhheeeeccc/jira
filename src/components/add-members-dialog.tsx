'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import type { Member, ProjectMember, Project } from '@/lib/types';

interface AddMembersDialogProps {
  project: Project;
  allMembers: Member[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function AddMembersDialog({
  project,
  allMembers,
  open,
  onOpenChange,
  onUpdate,
}: AddMembersDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const currentMemberIds = new Set(project.members.map((pm) => pm.memberId));
  const availableMembers = allMembers.filter((m) => !currentMemberIds.has(m.id));

  useEffect(() => {
    if (!open) setSelectedIds(new Set());
  }, [open]);

  const toggleMember = (memberId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleAddMembers = async () => {
    if (selectedIds.size === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'فشل في إضافة الأعضاء');
      }

      toast.success('تمت إضافة الأعضاء بنجاح');
      setSelectedIds(new Set());
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${project.id}/members?memberId=${memberId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) throw new Error('فشل في إزالة العضو');

      toast.success('تمت إزالة العضو');
      onUpdate();
    } catch {
      toast.error('فشل في إزالة العضو');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            إدارة أعضاء المشروع
          </DialogTitle>
        </DialogHeader>

        {/* Current Members */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">
            الأعضاء الحاليون ({project.members.length})
          </h4>
          <ScrollArea className="max-h-40">
            <div className="space-y-1">
              {project.members.length === 0 && (
                <p className="text-xs text-slate-400 py-3 text-center">
                  لا يوجد أعضاء في المشروع
                </p>
              )}
              {project.members.map((pm) => (
                <div
                  key={pm.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 group"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
                        {pm.member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {pm.member.name}
                      </p>
                      <p className="text-[11px] text-slate-400">{pm.member.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(pm.memberId)}
                    className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50
                               opacity-0 group-hover:opacity-100 transition-all"
                    aria-label="إزالة العضو"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Separator />\n
        {/* Add New Members */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">
            إضافة أعضاء
          </h4>
          {availableMembers.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              جميع الأعضاء منضمون بالفعل
            </p>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="space-y-1">
                {availableMembers.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(member.id)}
                      onCheckedChange={() => toggleMember(member.id)}
                    />
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600">
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {member.name}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {member.email}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Actions */}
        {availableMembers.length > 0 && (
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-sm"
            >
              إغلاق
            </Button>
            <Button
              onClick={handleAddMembers}
              disabled={submitting || selectedIds.size === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              <UserPlus className="w-4 h-4 ml-1" />
              {submitting
                ? 'جاري الإضافة...'
                : `إضافة (${selectedIds.size})`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
