import React, { useState, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useStore } from '../store/useStore';
import { api } from '../api/client';

export const DeleteColumnDialog: React.FC = () => {
    const dialogRef = useRef<HTMLDivElement>(null);
    useFocusTrap(dialogRef, true);

    const {
        deleteColumnInfo,
        setDeleteColumnInfo,
        selectedProject,
        setProjectColumns,
        setError,
    } = useStore();

    const [submitting, setSubmitting] = useState(false);

    if (!deleteColumnInfo) return null;

    const handleClose = () => {
        setDeleteColumnInfo(null);
    };

    const handleDelete = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await api.deleteColumn(deleteColumnInfo.id);
            // Re-fetch columns from server for consistency
            if (selectedProject) {
                try {
                    const cols = await api.getProjectColumns(selectedProject.id);
                    setProjectColumns(Array.isArray(cols) ? cols : []);
                } catch (refErr: any) {
                    setError(refErr.message || 'فشل تحديث الأعمدة');
                }
            }
            handleClose();
        } catch (err: any) {
            setError(err.message || 'فشل حذف العمود');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose} onKeyDown={e => { if (e.key === 'Escape') handleClose(); }}>
            <div className="modal-dialog1" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
                <div className="modal-dialog1__header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mm-error-text)' }}>
                        <AlertTriangle size={24} />
                        <h2 className="modal-dialog1__title" style={{ margin: 0 }}>حذف العمود</h2>
                    </div>
                    <button className="modal-dialog1__close" onClick={handleClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-dialog1__body" style={{ paddingTop: '16px' }}>
                    <p>هل أنت متأكد من رغبتك في حذف عمود <strong>"{deleteColumnInfo.title}"</strong>؟</p>
                    <p style={{ color: 'var(--mm-text-muted)', fontSize: '13px', marginTop: '8px' }}>
                        هذا الإجراء لا يمكن التراجع عنه.
                    </p>
                </div>

                <div className="modal-dialog1__footer">
                    <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={submitting}>
                        إلغاء
                    </button>
                    <button 
                        type="button" 
                        onClick={handleDelete}
                        className="btn btn-danger" 
                        disabled={submitting}
                    >
                        {submitting ? 'جارٍ الحذف...' : 'موافق'}
                    </button>
                </div>
            </div>
        </div>
    );
};
