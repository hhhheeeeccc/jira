import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';

export const AddColumnDialog: React.FC = () => {
    const {
        selectedProject,
        showAddColumnDialog,
        setShowAddColumnDialog,
        projectColumns,
        setProjectColumns,
        setError,
    } = useStore();

    const [title, setTitle] = useState('');
    const [color, setColor] = useState('#64748b');
    const [submitting, setSubmitting] = useState(false);

    // Reset state when dialog opens
    useEffect(() => {
        if (showAddColumnDialog) {
            setTitle('');
            setColor('#64748b');
        }
    }, [showAddColumnDialog]);

    if (!showAddColumnDialog || !selectedProject) return null;

    const handleClose = () => {
        setShowAddColumnDialog(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProject || !title.trim()) return;

        setSubmitting(true);
        setError(null);
        try {
            const newCol = await api.createColumn(selectedProject.id, {
                title: title.trim(),
                color: color,
            });
            setProjectColumns([...projectColumns, newCol]);
            handleClose();
        } catch (err: any) {
            setError(err.message || 'فشل إنشاء العمود');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-dialog1" onClick={e => e.stopPropagation()}>
                <div className="modal-dialog1__header">
                    <h2 className="modal-dialog1__title">إضافة عمود جديد</h2>
                    <button className="modal-dialog1__close" onClick={handleClose}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-dialog1__body">
                        <div className="form-group">
                            <label className="form-label">اسم العمود *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="مثال: قيد المراجعة"
                                autoFocus
                                required
                            />
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">اللون</label>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                                {['#64748b', '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'].map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            background: c,
                                            border: color === c ? '3px solid var(--mm-center-channel-bg)' : '1px solid var(--mm-border)',
                                            boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                                            cursor: 'pointer',
                                            transition: 'transform 0.1s',
                                            transform: color === c ? 'scale(1.1)' : 'scale(1)'
                                        }}
                                        title={c}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="modal-dialog1__footer">
                        <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={submitting}>
                            إلغاء
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={!title.trim() || submitting}>
                            {submitting ? 'جارٍ الإنشاء...' : 'إنشاء عمود'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
