import React, { useState, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useStore } from '../store/useStore';
import { api } from '../api/client';

export const RemoveMemberDialog: React.FC = () => {
    const dialogRef = useRef<HTMLDivElement>(null);
    useFocusTrap(dialogRef, true);

    const {
        deleteMemberInfo,
        setDeleteMemberInfo,
        selectedProject,
        setProjectMembers,
        setError,
    } = useStore();

    const [submitting, setSubmitting] = useState(false);

    if (!deleteMemberInfo) return null;

    const handleClose = () => {
        setDeleteMemberInfo(null);
    };

    const handleRemove = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await api.removeProjectMember(deleteMemberInfo.project_id, deleteMemberInfo.user_id);
            // Re-fetch members from server for consistency
            try {
                const updatedMembers = await api.getProjectMembers(deleteMemberInfo.project_id);
                setProjectMembers(Array.isArray(updatedMembers) ? updatedMembers : []);
            } catch (refErr: any) {
                // fallback
            }
            handleClose();
        } catch (err: any) {
            setError(err.message || 'فشل إزالة العضو');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={handleClose} onKeyDown={e => { if (e.key === 'Escape') handleClose(); }}>
            <div className="modal-dialog1" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
                <div className="modal-dialog1__header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mm-error-text)' }}>
                        <AlertTriangle size={24} />
                        <h2 className="modal-dialog1__title" style={{ margin: 0 }}>إزالة العضو</h2>
                    </div>
                    <button className="modal-dialog1__close" onClick={handleClose}>
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
