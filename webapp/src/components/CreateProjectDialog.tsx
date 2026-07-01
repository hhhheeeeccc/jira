import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import type { Project } from '../types';
import useDialogEscape from '../hooks/useDialogEscape';

export const CreateProjectDialog = () => {
    const { showCreateProjectDialog, setShowCreateProjectDialog, setProjects, setSelectedProject, setError } = useStore();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    const handleClose = () => {
        setShowCreateProjectDialog(false);
    };

    useDialogEscape(handleClose, !!showCreateProjectDialog);

    // Auto-focus first input on open
    useEffect(() => {
        if (showCreateProjectDialog && dialogRef.current) {
            const firstInput = dialogRef.current.querySelector('input, textarea, button:not([aria-label*=إغلاق])') as HTMLElement | null;
            if (firstInput) firstInput.focus();
        }
    }, [showCreateProjectDialog]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setSubmitting(true);
        try {
            const newProject: Project = await api.createProject({
                name: name.trim(),
                description: description.trim() || undefined,
            });
            const projects = await api.getProjects();
            setProjects(Array.isArray(projects) ? projects : []);
            setSelectedProject(newProject);
            setShowCreateProjectDialog(false);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'فشل إنشاء المشروع';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!showCreateProjectDialog) return null;

    return (
        <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="dialog-title-CreateProjectDialog">
            <div className="modal-dialog1" onClick={e => e.stopPropagation()} ref={dialogRef}>
                <div className="modal-dialog1__header">
                    <h2 id="dialog-title-CreateProjectDialog" className="modal-dialog1__title">إنشاء مشروع جديد</h2>
                    <button className="modal-dialog1__close" onClick={handleClose} aria-label="إغلاق">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-dialog1__body">
                        <div className="form-group">
                            <label className="form-label" htmlFor="create-project-name">اسم المشروع *</label>
                            <input
                                id="create-project-name"
                                type="text"
                                className="form-input"
                                placeholder="أدخل اسم المشروع"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="create-project-desc">الوصف</label>
                            <textarea
                                id="create-project-desc"
                                className="form-textarea"
                                placeholder="أدخل وصف المشروع (اختياري)"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="modal-dialog1__footer">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={handleClose}
                            disabled={submitting}
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!name.trim() || submitting}
                        >
                            {submitting ? 'جارٍ الإنشاء...' : 'إنشاء'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};