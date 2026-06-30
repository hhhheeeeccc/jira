import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';

export const DeleteProjectDialog: React.FC = () => {
    const {
        deleteProjectInfo,
        setDeleteProjectInfo,
        projects,
        setProjects,
        setSelectedProject,
        setProjectMembers,
        setProjectTasks,
        setProjectColumns,
        setError,
    } = useStore();

    const [submitting, setSubmitting] = useState(false);

    if (!deleteProjectInfo) return null;

    const handleClose = () => {
        setDeleteProjectInfo(null);
    };

    const handleDelete = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await api.deleteProject(deleteProjectInfo.id);
            const updatedProjects = projects.filter(p => p.id !== deleteProjectInfo.id);
            setProjects(updatedProjects);
            if (updatedProjects.length > 0) {
                setSelectedProject(updatedProjects[0]);
                // Load data for the auto-selected project
                try {
                    const [membersData, tasksData, columnsData] = await Promise.all([
                        api.getProjectMembers(updatedProjects[0].id),
                        api.getProjectTasks(updatedProjects[0].id),
                        api.getProjectColumns(updatedProjects[0].id),
                    ]);
                    setProjectMembers(Array.isArray(membersData) ? membersData : []);
                    setProjectTasks(Array.isArray(tasksData) ? tasksData : []);
                    setProjectColumns(Array.isArray(columnsData) ? columnsData : []);
                } catch (loadErr: any) {
                    // Non-fatal
                }
            } else {
                setSelectedProject(null);
                setProjectMembers([]);
                setProjectTasks([]);
                setProjectColumns([]);
            }
            handleClose();
        } catch (err: any) {
            setError(err.message || 'فشل حذف المشروع');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose} onKeyDown={e => { if (e.key === 'Escape') handleClose(); }}>
            <div className="modal-dialog1" onClick={e => e.stopPropagation()}>
                <div className="modal-dialog1__header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mm-error-text)' }}>
                        <AlertTriangle size={24} />
                        <h2 className="modal-dialog1__title" style={{ margin: 0 }}>حذف المشروع</h2>
                    </div>
                    <button className="modal-dialog1__close" onClick={handleClose}>
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
