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
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserPlus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { Member } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

interface MemberManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemberManager({ open, onOpenChange }: MemberManagerProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { members, setMembers } = useAppStore();

  const resetForm = () => {
    setName('');
    setEmail('');
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('يرجى إدخال الاسم والبريد الإلكتروني');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'فشل في إضافة العضو');
      }

      // Refresh members list
      const membersRes = await fetch('/api/members');
      if (membersRes.ok) {
        const allMembers = await membersRes.json();
        setMembers(allMembers);
      }

      toast.success('تمت إضافة العضو بنجاح');
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    setDeleting(memberId);
    try {
      const res = await fetch(`/api/members?id=${memberId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('فشل في حذف العضو');

      const membersRes = await fetch('/api/members');
      if (membersRes.ok) {
        const allMembers = await membersRes.json();
        setMembers(allMembers);
      }

      toast.success('تم حذف العضو');
    } catch {
      toast.error('فشل في حذف العضو');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5" />
            إدارة الأعضاء
          </DialogTitle>
        </DialogHeader>

        {/* Add Member Form */}
        <form onSubmit={handleAddMember} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="member-name" className="text-xs font-medium text-slate-600">
                الاسم
              </Label>
              <Input
                id="member-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم العضو"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-email" className="text-xs font-medium text-slate-600">
                البريد الإلكتروني
              </Label>
              <Input
                id="member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="text-sm"
                dir="ltr"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={submitting || !name.trim() || !email.trim()}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white w-full text-sm"
          >
            <UserPlus className="w-4 h-4 ml-1" />
            {submitting ? 'جاري الإضافة...' : 'إضافة عضو'}
          </Button>
        </form>

        {/* Members List */}
        <div className="mt-2">
          <p className="text-xs font-semibold text-slate-500 mb-2">
            الأعضاء ({members.length})
          </p>
          <ScrollArea className="max-h-60">
            <div className="space-y-1">
              {members.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">
                  لا يوجد أعضاء بعد
                </p>
              )}
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 group"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {member.name}
                      </p>
                      <p className="text-[11px] text-slate-400" dir="ltr">
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    disabled={deleting === member.id}
                    className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50
                               opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                    aria-label="حذف العضو"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
