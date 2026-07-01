import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import useDialogEscape from '../hooks/useDialogEscape';

export const DeleteProjectDialog = () => {
    const {
        deleteProjectInfo,
        setDeleteProjectInfo,
        projects,
        setProjects,
        setSelectedProject,
        setError,
    } = useStore();

    const [submitting, setSubmitting] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    const isOpen = !!deleteProjectInfo;

    const handleClose = () => {
        setDeleteProjectInfo(null);
    };

    useDialogEscape(handleClose, isOpen);

    // Auto-focus dialog on open
    useEffect(() => {
        if (isOpen && dialogRef.current) {
            const firstInput = dialogRef.current.querySelector('input, textarea, button:not([aria-label*=إغلاق])') as HTMLElement | null;
            if (firstInput) firstInput.focus();
        }
    }, [isOpen]);

    if (!deleteProjectInfo) return null;

    const handleDelete = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await api.deleteProject(deleteProjectInfo.id);
            const updatedProjects = projects.filter(p => p.id !== deleteProjectInfo.id);
            setProjects(updatedProjects);
            setSelectedProject(updatedProjects.length > 0 ? updatedProjects[0] : null);
            handleClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'فشل حذف المشروع';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="dialog-title-DeleteProjectDialog">
            <div className="modal-dialog1" onClick={e => e.stopPropagation()} ref={dialogRef} tabIndex={-1}>
                <div className="modal-dialog1__header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mm-error-text)' }}>
                        <AlertTriangle size={24} />
                        <h2 id="dialog-title-DeleteProjectDialog" className="modal-dialog1__title" style={{ margin: 0 }}>حذف المشروع</h2>
                    </div>
                    <button className="modal-dialog1__close" onClick={handleClose} aria-label="إغلاق">
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-dialog1__body" style={{ paddingTop: '16px' }}>
                    <p>هل أنت متأكد من حذف المشروع <strong>"{deleteProjectInfo.name}"</strong>؟</p>
                    <p style={{ color: 'var(--mm-text-muted)', fontSize: '13px', marginTop: '8px' }}>
                        سيتم حذف جميع المهام والأعمدة المرتبطة بهذا المشروع. هذا الإجراء لا يمكن التراجع عنه.
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