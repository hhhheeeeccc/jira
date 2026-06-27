import React, { useState, useEffect } from 'react';
import { X, UserMinus, UserPlus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';

export const AddMembersDialog: React.FC = () => {
    const {
        selectedProject,
        projectMembers,
        mattermostUsers,
        setShowAddMembersDialog,
        setProjectMembers,
        setMattermostUsers,
        setError,
    } = useStore();

    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Load Mattermost users when dialog opens
    useEffect(() => {
        const loadUsers = async () => {
            setLoadingUsers(true);
            try {
                const users = await fetch('/plugins/com.mattermost.plugin.jira/api/v1/users').then(r => {
                    if (!r.ok) throw new Error('فشل تحميل المستخدمين');
                    return r.json();
                });
                setMattermostUsers(Array.isArray(users) ? users : []);
            } catch (err: any) {
                console.error('Failed to load users:', err);
            } finally {
                setLoadingUsers(false);
            }
        };
        loadUsers();
    }, [setMattermostUsers]);

    if (!selectedProject) return null;

    const currentMemberUserIds = new Set(projectMembers.map(m => m.user_id));
    const availableUsers = mattermostUsers.filter(u => !currentMemberUserIds.has(u.id));

    const handleClose = () => {
        setShowAddMembersDialog(false);
        setSelectedUserIds([]);
    };

    const handleRemoveMember = async (userId: string) => {
        setRemovingUserId(userId);
        try {
            await api.removeProjectMember(selectedProject.id, userId);
            const updated = projectMembers.filter(m => m.user_id !== userId);
            setProjectMembers(updated);
        } catch (err: any) {
            setError(err.message || 'فشل إزالة العضو');
        } finally {
            setRemovingUserId(null);
        }
    };

    const handleAddMembers = async () => {
        if (selectedUserIds.length === 0) return;
        setAdding(true);
        try {
            await api.addProjectMembers(selectedProject.id, selectedUserIds);
            const updatedMembers = await api.getProjectMembers(selectedProject.id);
            setProjectMembers(Array.isArray(updatedMembers) ? updatedMembers : []);
            setSelectedUserIds([]);
            setShowAddMembersDialog(false);
        } catch (err: any) {
            setError(err.message || 'فشل إضافة الأعضاء');
        } finally {
            setAdding(false);
        }
    };

    const toggleUser = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const getDisplayName = (member: { display_name: string; username: string }) => {
        return member.display_name || member.username;
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()}>
                <div className="modal-dialog__header">
                    <h2 className="modal-dialog__title">إدارة أعضاء المشروع</h2>
                    <button className="modal-dialog__close" onClick={handleClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-dialog__body">
                    {/* Current Members */}
                    <div className="members-section">
                        <div className="members-section__title">الأعضاء الحاليون</div>
                        {projectMembers.length === 0 ? (
                            <div style={{ color: 'var(--mm-text-muted)', fontSize: '13px', padding: '8px 0', textAlign: 'center' }}>
                                لا يوجد أعضاء حالياً
                            </div>
                        ) : (
                            <div className="member-list">
                                {projectMembers.map((member) => (
                                    <div key={member.id} className="member-item">
                                        <div className="member-item__info">
                                            <div className="member-item__avatar">
                                                {getDisplayName(member).substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="member-item__name">
                                                    {getDisplayName(member)}
                                                </div>
                                                <div className="member-item__username">
                                                    @{member.username}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            className="member-item__remove"
                                            onClick={() => handleRemoveMember(member.user_id)}
                                            disabled={removingUserId === member.user_id}
                                            title="إزالة العضو"
                                        >
                                            <UserMinus size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add New Members */}
                    {availableUsers.length > 0 && (
                        <div className="members-section">
                            <div className="members-section__title">إضافة أعضاء</div>
                            <div className="member-list">
                                {availableUsers.map((user) => {
                                    const displayName = user.display_name || user.username;
                                    const isChecked = selectedUserIds.includes(user.id);
                                    return (
                                        <label
                                            key={user.id}
                                            className="member-checkbox-item"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleUser(user.id)}
                                            />
                                        <div className="member-item__avatar" style={{ width: 26, height: 26, fontSize: 10 }}>
                                                {displayName.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="member-item__name">{displayName}</div>
                                                <div className="member-item__username">@{user.username}</div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-dialog__footer">
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={handleClose}
                        disabled={adding}
                    >
                        إلغاء
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAddMembers}
                        disabled={selectedUserIds.length === 0 || adding}
                    >
                        <UserPlus size={16} />
                        {adding ? 'جارٍ الإضافة...' : `إضافة (${selectedUserIds.length})`}
                    </button>
                </div>
            </div>
        </div>
    );
};