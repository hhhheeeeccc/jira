import { useStore } from '../store/useStore';
import { X, CalendarDays, Clock, User, AlertCircle, FileText } from 'lucide-react';
import { marked } from 'marked';
import type { Task, KanbanColumn, ProjectMember } from '../types';

const PRIORITY_LABELS: Record<string, string> = {
    low: 'منخفض',
    medium: 'متوسط',
    high: 'عالي',
    critical: 'حرج',
};

const PRIORITY_COLORS: Record<string, string> = {
    low: '#2ecc71',
    medium: '#3498db',
    high: '#f39c12',
    critical: '#e74c3c',
};

export const TaskDetailsDialog: React.FC = () => {
    const { selectedTaskDetails, setSelectedTaskDetails, projectColumns, projectMembers, mattermostUsers } = useStore();

    if (!selectedTaskDetails) return null;

    const task = selectedTaskDetails;

    // Find the column this task is currently in based on its status
    const currentColumn = projectColumns.find(c => c.id === task.status);
    const statusText = currentColumn ? currentColumn.title : 'غير محدد';

    const assigneeMember = task.assignee_id ? projectMembers.find(m => m.user_id === task.assignee_id) : null;
    const assigneeName = assigneeMember ? (assigneeMember.display_name || assigneeMember.username) : 'غير مسند';

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="modal-overlay" onClick={() => setSelectedTaskDetails(null)}>
            <div className="modal-dialog1 task-details-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-dialog1__header">
                    <h2 className="modal-dialog1__title">{task.title}</h2>
                    <button className="modal-dialog1__close" onClick={() => setSelectedTaskDetails(null)}>
                        <X size={20} />
                    </button>
                </div>
                
                <div className="modal-dialog1__content task-details-content">
                    <div className="task-details-grid">
                        <div className="task-details-section">
                            <h3 className="section-title">التفاصيل</h3>
                            
                            <div className="details-row">
                                <span className="details-label">الحالة:</span>
                                <span className="details-value status-badge" style={{ backgroundColor: currentColumn?.color || '#eee', color: currentColumn?.color ? '#fff' : '#333' }}>
                                    {statusText}
                                </span>
                            </div>
                            
                            <div className="details-row">
                                <span className="details-label">الأولوية:</span>
                                <span className="details-value priority-badge" style={{ color: PRIORITY_COLORS[task.priority] }}>
                                    <AlertCircle size={16} />
                                    {PRIORITY_LABELS[task.priority]}
                                </span>
                            </div>
                        </div>

                        <div className="task-details-section">
                            <h3 className="section-title">الأشخاص</h3>
                            
                            <div className="details-row">
                                <span className="details-label">المسند إليه:</span>
                                <span className="details-value assignee-info">
                                    {assigneeMember ? (
                                        <img 
                                            src={`/api/v4/users/${assigneeMember.user_id}/image`} 
                                            alt={assigneeName} 
                                            className="task-details-avatar" 
                                        />
                                    ) : (
                                        <div className="task-details-avatar-placeholder">
                                            <User size={14} />
                                        </div>
                                    )}
                                    {assigneeName}
                                </span>
                            </div>
                        </div>

                        <div className="task-details-section">
                            <h3 className="section-title">التواريخ</h3>
                            
                            <div className="details-row">
                                <span className="details-label">تاريخ الإنشاء:</span>
                                <span className="details-value">
                                    {formatDate(task.created_at)}
                                </span>
                            </div>
                            
                            <div className="details-row">
                                <span className="details-label">تاريخ التحديث:</span>
                                <span className="details-value">
                                    {formatDate(task.updated_at)}
                                </span>
                            </div>

                            {task.due_date && (
                                <div className="details-row">
                                    <span className="details-label">تاريخ الاستحقاق:</span>
                                    <span className="details-value due-date-value">
                                        <CalendarDays size={16} />
                                        {new Date(task.due_date).toLocaleDateString('ar-SA')}
                                        {task.due_time && <><Clock size={16} style={{marginLeft: 4, marginRight: 8}} /> {task.due_time}</>}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="task-details-description-block">
                        <h3 className="section-title">
                            <FileText size={18} />
                            الوصف
                        </h3>
                        <div className="task-details-description-content">
                            {task.description ? (
                                <div 
                                    className="markdown-body"
                                    dangerouslySetInnerHTML={{ 
                                        __html: marked.parse(task.description, { 
                                            gfm: true, 
                                            breaks: true 
                                        }) as string 
                                    }} 
                                />
                            ) : (
                                <p className="empty-description">لا يوجد وصف لهذه المهمة.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
