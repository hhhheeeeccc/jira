import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import type { ProjectMember } from '../types';
import useDialogEscape from '../hooks/useDialogEscape';

export const RemoveMemberDialog = () => {
    const {
        deleteMemberInfo,
        setDeleteMemberInfo,
        setProjectMembers,
        setError,
    } = useStore();

    const [submitting, setSubmitting] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    const isOpen = !!deleteMemberInfo;

    const handleClose = () => {
        setDeleteMemberInfo(null);
    };

    useDialogEscape(handleClose, isOpen);

    // Auto-focus dialog on open
    useEffect(() => {
        if (isOpen && dialogRef.current) {
            const firstInput = dialogRef.current.querySelector('input, textarea, button:not([aria-label*=إغلاق])') as HTMLElement | null;
            if (firstInput) firstInput.focus();
        }
    }, [isOpen]);

    if (!deleteMemberInfo) return null;

    const handleRemove = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await api.removeProjectMember(deleteMemberInfo.project_id, deleteMemberInfo.user_id);
            setProjectMembers((prev: ProjectMember[]) => prev.filter(m => m.user_id !== deleteMemberInfo.user_id));
            handleClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'فشل إزالة العضو';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="dialog-title-RemoveMemberDialog">
            <div className="modal-dialog1" onClick={e => e.stopPropagation()} ref={dialogRef} tabIndex={-1}>
                <div className="modal-dialog1__header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mm-error-text)' }}>
                        <AlertTriangle size={24} />
                        <h2 id="dialog-title-RemoveMemberDialog" className="modal-dialog1__title" style={{ margin: 0 }}>إزالة العضو</h2>
                    </div>
                    <button className="modal-dialog1__close" onClick={handleClose} aria-label="إغلاق">
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-dialog1__body" style={{ paddingTop: '16px' }}>
                    <p>هل أنت متأكد من إزالة <strong>"{deleteMemberInfo.display_name}"</strong> من المشروع؟</p>
                    <p style={{ color: 'var(--mm-text-muted)', fontSize: '13px', marginTop: '8px' }}>
                        لن يتمكن هذا العضو من الوصول إلى مهام المشروع بعد إزالته.
                    </p>
                </div>

                <div className="modal-dialog1__footer">
                    <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={submitting}>
                        إلغاء
                    </button>
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="btn btn-danger"
                        disabled={submitting}
                    >
                        {submitting ? 'جارٍ الإزالة...' : 'موافق'}
                    </button>
                </div>
            </div>
        </div>
    );
};