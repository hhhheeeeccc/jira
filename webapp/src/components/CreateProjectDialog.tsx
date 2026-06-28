import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import type { Project } from '../types';

export const CreateProjectDialog: React.FC = () => {
    const { setShowCreateProjectDialog, setProjects, setSelectedProject, setError, setLoading } = useStore();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleClose = () => {
        setShowCreateProjectDialog(false);
    };

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
        } catch (err: any) {
            setError(err.message || 'فشل إنشاء المشروع');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-dialog1" onClick={e => e.stopPropagation()}>
                <div className="modal-dialog1__header">
                    <h2 className="modal-dialog1__title">إنشاء مشروع جديد</h2>
                    <button className="modal-dialog1__close" onClick={handleClose}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-dialog1__body">
                        <div className="form-group">
                            <label className="form-label">اسم المشروع *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="أدخل اسم المشروع"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                autoFocus
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">الوصف</label>
                            <textarea
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