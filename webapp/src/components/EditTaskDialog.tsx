import React, { useState, useEffect, useRef } from 'react';
import { X, CalendarDays, Clock, Flag, User } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useStore } from '../store/useStore';
import { api } from '../api/client';

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'منخفض' },
    { value: 'medium', label: 'متوسط' },
    { value: 'high', label: 'عالي' },
    { value: 'critical', label: 'حرج' },
] as const;

export const EditTaskDialog: React.FC = () => {
    const dialogRef = useRef<HTMLDivElement>(null);
    useFocusTrap(dialogRef, true);

    const {
        editTaskInfo,
        setEditTaskInfo,
        selectedProject,
        projectMembers,
        projectColumns,
        setProjectTasks,
        setError,
    } = useStore();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('');
    const [priority, setPriority] = useState<string>('medium');
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [status, setStatus] = useState<string>('');
    const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const dateInputRef = React.useRef<HTMLInputElement>(null);
    const timeInputRef = React.useRef<HTMLInputElement>(null);

    // Populate fields when dialog opens
    useEffect(() => {
        if (editTaskInfo) {
            setTitle(editTaskInfo.title || '');
            setDescription(editTaskInfo.description || '');
            setDueDate(editTaskInfo.due_date || '');
            setDueTime(editTaskInfo.due_time || '');
            setPriority(editTaskInfo.priority || 'medium');
            setAssigneeId(editTaskInfo.assignee_id || '');
            setStatus(editTaskInfo.status || '');
            setError(null);
        }
    }, [editTaskInfo]);

    if (!editTaskInfo || !selectedProject) return null;

    const handleClose = () => {
        setEditTaskInfo(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        setSubmitting(true);
        setError(null);
        try {
            const updates: Record<string, any> = {
                title: title.trim(),
                description: description.trim() || null,
                priority,
                assignee_id: assigneeId || null,
                due_date: dueDate || null,
                due_time: dueTime || null,
                status,
            };

            await api.updateTask(editTaskInfo.id, updates);
            // Re-fetch tasks from server
            try {
                const updatedTasks = await api.getProjectTasks(selectedProject.id);
                setProjectTasks(Array.isArray(updatedTasks) ? updatedTasks : []);
            } catch (refErr: any) {
                // Non-fatal
            }
            handleClose();
        } catch (err: any) {
            setError(err.message || 'فشل تحديث المهمة');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClearAssignee = () => {
        setAssigneeId('');
        setIsAssigneeDropdownOpen(false);
    };

    return (
        <div className="modal-overlay" onClick={handleClose} onKeyDown={e => { if (e.key === 'Escape') handleClose(); }}>
            <div className="modal-dialog1" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
                <div className="modal-dialog1__header">
                    <h2 className="modal-dialog1__title">تعديل المهمة</h2>
                    <button className="modal-dialog1__close" onClick={handleClose}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-dialog1__body">
                        {/* Title */}
                        <div className="form-group">
                            <label className="form-label">عنوان المهمة *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="أدخل عنوان المهمة"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                autoFocus
                                required
                            />
                        </div>

                        {/* Description */}
                        <div className="form-group">
                            <label className="form-label">الوصف</label>
                            <textarea
                                className="form-textarea"
                                placeholder="أدخل وصف المهمة (اختياري)"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={2}
                            />
                        </div>

                        {/* Priority & Assignee Row */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">
                                    <Flag size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }} />
                                    الأولوية
                                </label>
                                <select
                                    className="form-select"
                                    value={priority}
                                    onChange={e => setPriority(e.target.value)}
                                >
                                    {PRIORITY_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    <User size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }} />
                                    المسؤول
                                </label>
                                <div className="custom-select-container">
                                    <div
                                        className="custom-select"
                                        onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                                    >
                                        {assigneeId && projectMembers.find(m => m.user_id === assigneeId) ? (
                                            <div className="custom-select-user" style={{ justifyContent: 'space-between', width: '100%' }}>
                                                <div className="custom-select-user" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <img
                                                        src={`/api/v4/users/${assigneeId}/image`}
                                                        className="custom-select-avatar"
                                                        alt="avatar"
                                                    />
                                                    <span className="custom-select-name">
                                                        {projectMembers.find(m => m.user_id === assigneeId)?.display_name || projectMembers.find(m => m.user_id === assigneeId)?.username}
                                                    </span>
                                                </div>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); handleClearAssignee(); }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mm-text-muted)', padding: 2 }}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="custom-select-placeholder">اختر المسؤول...</span>
                                        )}
                                    </div>

                                    {isAssigneeDropdownOpen && (
                                        <>
                                            <div
                                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                                                onClick={(e) => { e.stopPropagation(); setIsAssigneeDropdownOpen(false); }}
                                            />
                                            <div className="custom-select-menu">
                                                {projectMembers.map(member => (
                                                    <div
                                                        key={member.user_id}
                                                        className="custom-select-option"
                                                        onClick={() => {
                                                            setAssigneeId(member.user_id);
                                                            setIsAssigneeDropdownOpen(false);
                                                        }}
                                                    >
                                                        <img
                                                            src={`/api/v4/users/${member.user_id}/image`}
                                                            className="custom-select-avatar"
                                                            alt={member.username}
                                                        />
                                                        <div className="custom-select-info" style={{ marginRight: '12px' }}>
                                                            <div className="custom-select-name">{member.display_name || member.username}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Status (Column) */}
                        <div className="form-group">
                            <label className="form-label">الحالة</label>
                            <select
                                className="form-select"
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                            >
                                {projectColumns.map(col => (
                                    <option key={col.id} value={col.id}>
                                        {col.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date & Time Row */}
                        <div className="form-row" style={{ marginTop: 8 }}>
                            <div className="form-group">
                                <div
                                    className="date-time-input"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        try { dateInputRef.current?.showPicker(); } catch (e) { dateInputRef.current?.focus(); }
                                    }}
                                >
                                    <span className="date-time-input__label">تاريخ الاستحقاق</span>
                                    <span className="date-time-input__icon"><CalendarDays size={16} /></span>
                                    <span className="date-time-input__value" style={{ color: dueDate ? 'var(--mm-text)' : 'var(--mm-text-muted)' }}>
                                        {dueDate || 'حدد التاريخ...'}
                                    </span>
                                    <input
                                        ref={dateInputRef}
                                        type="date"
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        style={{ width: 0, height: 0, padding: 0, border: 'none', opacity: 0, position: 'absolute' }}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <div
                                    className="date-time-input"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        try { timeInputRef.current?.showPicker(); } catch (e) { timeInputRef.current?.focus(); }
                                    }}
                                >
                                    <span className="date-time-input__label">الوقت</span>
                                    <span className="date-time-input__icon"><Clock size={16} /></span>
                                    <span className="date-time-input__value" style={{ color: dueTime ? 'var(--mm-text)' : 'var(--mm-text-muted)' }}>
                                        {dueTime || 'حدد الوقت...'}
                                    </span>
                                    <input
                                        ref={timeInputRef}
                                        type="time"
                                        value={dueTime}
                                        onChange={e => setDueTime(e.target.value)}
                                        style={{ width: 0, height: 0, padding: 0, border: 'none', opacity: 0, position: 'absolute' }}
                                    />
                                </div>
                            </div>
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
                            disabled={!title.trim() || submitting}
                        >
                            {submitting ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
