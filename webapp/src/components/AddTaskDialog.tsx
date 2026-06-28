import React, { useState, useEffect } from 'react';
import { X, CalendarDays, Clock, Flag, User } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import type { TaskStatus } from '../types';

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'منخفض' },
    { value: 'medium', label: 'متوسط' },
    { value: 'high', label: 'عالي' },
    { value: 'critical', label: 'حرج' },
] as const;

export const AddTaskDialog: React.FC = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    
    const dateInputRef = React.useRef<HTMLInputElement>(null);
    const timeInputRef = React.useRef<HTMLInputElement>(null);

    const {
        selectedProject,
        projectMembers,
        projectColumns,
        showAddTaskDialog,
        addTaskColumnId,
        setShowAddTaskDialog,
        setProjectTasks,
        setError,
    } = useStore();

    // Reset state when dialog opens
    useEffect(() => {
        if (showAddTaskDialog) {
            setTitle('');
            setDescription('');
            setDueDate('');
            setDueTime('');
            setPriority('medium');
            setAssigneeId('');
            setError(null);
            
            // Set initial due date to today
            const today = new Date();
            setDueDate(today.toISOString().split('T')[0]);
        }
    }, [showAddTaskDialog]);

    if (!showAddTaskDialog || !selectedProject) return null;

    const handleClose = () => {
        setShowAddTaskDialog(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const isFormValid = title.trim() && description.trim() && dueDate && dueTime && priority && assigneeId;
        if (!selectedProject || !isFormValid) return;

        setSubmitting(true);
        setError(null);
        try {
            let status: TaskStatus = addTaskColumnId as TaskStatus;
            if (!status) {
                status = projectColumns.length > 0 ? projectColumns[0].id : 'backlog';
            }

            const taskData: any = {
                title: title.trim(),
                description: description.trim() || null,
                priority,
                status,
                assignee_id: assigneeId || null,
                due_date: dueDate || null,
                due_time: dueTime || null,
            };

            await api.createTask(selectedProject.id, taskData);
            const tasks = await api.getProjectTasks(selectedProject.id);
            setProjectTasks(Array.isArray(tasks) ? tasks : []);
            handleClose();
        } catch (err: any) {
            setError(err.message || 'فشل إنشاء المهمة');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-dialog1" onClick={e => e.stopPropagation()}>
                <div className="modal-dialog1__header">
                    <h2 className="modal-dialog1__title">إضافة مهمة جديدة</h2>
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
                            <label className="form-label">الوصف *</label>
                            <textarea
                                className="form-textarea"
                                placeholder="أدخل وصف المهمة"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={2}
                                required
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
                                    onChange={e => setPriority(e.target.value as any)}
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
                                <select
                                    className="form-select"
                                    value={assigneeId}
                                    onChange={e => setAssigneeId(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>اختر المسؤول...</option>
                                    {projectMembers.map(member => (
                                        <option key={member.user_id} value={member.user_id}>
                                            {member.display_name || member.username}
                                        </option>
                                    ))}
                                </select>
                            </div>
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
                                    style={{ border: !dueDate ? '1px solid var(--mm-error-text)' : undefined }}
                                >
                                    <span className="date-time-input__label">تاريخ الاستحقاق *</span>
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
                                    style={{ border: !dueTime ? '1px solid var(--mm-error-text)' : undefined }}
                                >
                                    <span className="date-time-input__label">الوقت *</span>
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
                            disabled={!(title.trim() && description.trim() && dueDate && dueTime && priority && assigneeId) || submitting}
                        >
                            {submitting ? 'جارٍ الإنشاء...' : 'إنشاء مهمة'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};