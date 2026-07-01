import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import type { KanbanColumn } from '../types';
import useDialogEscape from '../hooks/useDialogEscape';

export const EditColumnDialog = () => {
    const {
        editColumn,
        setEditColumn,
        setProjectColumns,
        setError,
    } = useStore();

    const [title, setTitle] = useState('');
    const [color, setColor] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    const isOpen = !!editColumn;

    const handleClose = () => {
        setEditColumn(null);
    };

    useDialogEscape(handleClose, isOpen);

    // Auto-focus first input on open
    useEffect(() => {
        if (isOpen && dialogRef.current) {
            const firstInput = dialogRef.current.querySelector('input, textarea, button:not([aria-label*=إغلاق])') as HTMLElement | null;
            if (firstInput) firstInput.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (editColumn) {
            setTitle(editColumn.title);
            setColor(editColumn.color || '#64748b');
        }
    }, [editColumn]);

    if (!editColumn) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || (title.trim() === editColumn.title && color === editColumn.color)) {
            handleClose();
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            await api.updateColumn(editColumn.id, {
                title: title.trim(),
                color: color,
            });
            setProjectColumns((prev: KanbanColumn[]) => prev.map(c =>
                c.id === editColumn.id ? { ...c, title: title.trim(), color: color } : c
            ));
            handleClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'فشل تحديث العمود';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="dialog-title-EditColumnDialog">
            <div className="modal-dialog1" onClick={e => e.stopPropagation()} ref={dialogRef}>
                <div className="modal-dialog1__header">
                    <h2 id="dialog-title-EditColumnDialog" className="modal-dialog1__title">تعديل العمود</h2>
                    <button className="modal-dialog1__close" onClick={handleClose} aria-label="إغلاق">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-dialog1__body">
                        <div className="form-group">
                            <label className="form-label" htmlFor="edit-column-name">اسم العمود *</label>
                            <input
                                id="edit-column-name"
                                type="text"
                                className="form-input"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="مثال: قيد المراجعة"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">اللون</label>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }} role="radiogroup" aria-label="اختر لون العمود">
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
                                        aria-label={`الون ${c}`}
                                        aria-pressed={color === c}
                                        role="radio"
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
                            {submitting ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};