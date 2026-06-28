import React, { useState } from 'react';
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
    const {
        selectedProject,
        projectMembers,
        showAddTaskDialog,
        addTaskColumnId,
        setProjectTasks,
        setShowAddTaskDialog,
        setError,
    } = useStore();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    if (!showAddTaskDialog || !selectedProject) return null;

    const handleClose = () => {
        setShowAddTaskDialog(false);
        // Reset form
        setTitle('');
        setDescription('');
        setDueDate('');
        setDueTime('');
        setPriority('medium');
        setAssigneeId('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        setSubmitting(true);
        try {
            // Determine initial status based on assignee and column
            let status: TaskStatus = addTaskColumnId as TaskStatus;
            if (!status) {
                status = assigneeId ? 'todo' : 'backlog';
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
            <div className="modal-dialog" onClick={e => e.stopPropagation()}>
                <div className="modal-dialog__header">
                    <h2 className="modal-dialog__title">إضافة مهمة جديدة</h2>
                    <button className="modal-dialog__close" onClick={handleClose}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-dialog__body">
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
                                >
                                    <option value="">بدون مسؤول</option>
                                    {projectMembers.map(member => (
                                        <option key={member.user_id} value={member.user_id}>
                                            {member.display_name || member.username}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Date & Time Row */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">
                                    <CalendarDays size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }} />
                                    تاريخ الاستحقاق
                                </label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    <Clock size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }} />
                                    الوقت
                                </label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={dueTime}
                                    onChange={e => setDueTime(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="modal-dialog__footer">
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
                            {submitting ? 'جارٍ الإنشاء...' : 'إنشاء مهمة'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};