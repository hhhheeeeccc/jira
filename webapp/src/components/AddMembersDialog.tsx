import React, { useState, useEffect, useRef } from 'react';
import { X, UserMinus, UserPlus, Search } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import useDialogEscape from '../hooks/useDialogEscape';

export const AddMembersDialog: React.FC = () => {
    const {
        selectedProject,
        projectMembers,
        mattermostUsers,
        showAddMembersDialog,
        setShowAddMembersDialog,
        setProjectMembers,
        setMattermostUsers,
        setError,
        setDeleteMemberInfo,
        currentUser,
    } = useStore();

    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [adding, setAdding] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dialogRef = useRef<HTMLDivElement>(null);

    const handleClose = () => {
        setShowAddMembersDialog(false);
        setSelectedUserIds([]);
        setSearchQuery('');
    };

    useDialogEscape(handleClose, !!showAddMembersDialog && !!selectedProject);

    // Auto-focus first input on open
    useEffect(() => {
        if (showAddMembersDialog && selectedProject && dialogRef.current) {
            const firstInput = dialogRef.current.querySelector('input, textarea, button:not([aria-label*=إغلاق])') as HTMLElement | null;
            if (firstInput) firstInput.focus();
        }
    }, [showAddMembersDialog, selectedProject]);

    useEffect(() => {
        const loadUsers = async () => {
            try {
                const users = await api.getUsers();
                setMattermostUsers(Array.isArray(users) ? users : []);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'فشل تحميل المستخدمين';
                console.error('Failed to load users:', message);
            }
        };
        loadUsers();
    }, [setMattermostUsers]);

    if (!selectedProject || !showAddMembersDialog) return null;

    const isProjectAdmin = React.useMemo(() => {
        if (!currentUser || !selectedProject) return false;
        const member = projectMembers.find(m => m.user_id === currentUser.id);
        return member?.role === 'admin';
    }, [currentUser, selectedProject, projectMembers]);

    const currentMemberUserIds = new Set(projectMembers.map(m => m.user_id));
    const availableUsers = mattermostUsers.filter(u => !currentMemberUserIds.has(u.id));

    const filteredAvailableUsers = React.useMemo(() => {
        if (!searchQuery.trim()) return availableUsers;
        const q = searchQuery.toLowerCase();
        return availableUsers.filter(u =>
            (u.username && u.username.toLowerCase().includes(q)) ||
            (u.display_name && u.display_name.toLowerCase().includes(q))
        );
    }, [availableUsers, searchQuery]);

    const handleRemoveMember = async (userId: string) => {
        const member = projectMembers.find(m => m.user_id === userId);
        if (member) {
            setDeleteMemberInfo(member);
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
            setSearchQuery('');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'فشل إضافة الأعضاء';
            setError(message);
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

    const getDisplayName = (member: { display_name?: string; username?: string }) => {
        return member.display_name || member.username || 'مستخدم';
    };

    return (
        <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="dialog-title-AddMembersDialog">
            <div className="modal-dialog1 members-modal" onClick={e => e.stopPropagation()} ref={dialogRef}>
                <div className="modal-dialog1__header">
                    <h2 id="dialog-title-AddMembersDialog" className="modal-dialog1__title">إدارة أعضاء المشروع</h2>
                    <button className="modal-dialog1__close" onClick={handleClose} aria-label="إغلاق">
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-dialog1__body members-modal__body">
                    {/* Current Members */}
                    <div className="members-section">
                        <div className="members-section__title">الأعضاء الحاليون ({projectMembers.length})</div>
                        {projectMembers.length === 0 ? (
                            <div className="empty-state">لا يوجد أعضاء حالياً</div>
                        ) : (
                            <div className="member-list scrollable-list-small">
                                {projectMembers.map((member) => (
                                    <div key={member.id} className="member-item">
                                        <div className="member-item__info">
                                            <img
                                                className="member-item__avatar"
                                                src={`/api/v4/users/${member.user_id}/image`}
                                                alt={getDisplayName(member)}
                                                style={{ objectFit: 'cover' }}
                                            />
                                            <div>
                                                <div className="member-item__name">
                                                    {getDisplayName(member)}
                                                    {member.role === 'admin' && <span className="role-badge">مشرف</span>}
                                                </div>
                                            </div>
                                        </div>
                                        {isProjectAdmin && member.role !== 'admin' && (
                                            <button
                                                className="member-item__remove"
                                                onClick={() => handleRemoveMember(member.user_id)}
                                                title="إزالة العضو"
                                                aria-label={`إزالة ${getDisplayName(member)}`}
                                            >
                                                <UserMinus size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add New Members */}
                    {isProjectAdmin && availableUsers.length > 0 && (
                        <div className="members-section">
                            <div className="members-section__title">إضافة أعضاء جدد</div>

                            <div className="search-box">
                                <Search className="search-box__icon" size={16} />
                                <input
                                    type="text"
                                    className="search-box__input"
                                    placeholder="ابحث عن اسم المستخدم أو الاسم الكامل..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {filteredAvailableUsers.length === 0 ? (
                                <div className="empty-state">لا يوجد نتائج للبحث</div>
                            ) : (
                                <div className="member-list scrollable-list">
                                    {filteredAvailableUsers.map((user) => {
                                        const displayName = getDisplayName(user);
                                        const isChecked = selectedUserIds.includes(user.id);
                                        return (
                                            <label key={user.id} className={`member-checkbox-item ${isChecked ? 'selected' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleUser(user.id)}
                                                    className="member-checkbox hidden"
                                                />
                                                <img
                                                    className="member-item__avatar"
                                                    src={`/api/v4/users/${user.id}/image`}
                                                    alt={displayName}
                                                    style={{ objectFit: 'cover' }}
                                                />
                                                <div className="member-checkbox-item__info">
                                                    <div className="member-item__name">{displayName}</div>
                                                </div>
                                                {isChecked && <UserPlus className="member-item__selected-icon" size={16} />}
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-dialog1__footer">
                    <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={adding}>
                        إلغاء
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleAddMembers} disabled={selectedUserIds.length === 0 || adding}>
                        <UserPlus size={16} />
                        {adding ? 'جارٍ الإضافة...' : `إضافة (${selectedUserIds.length})`}
                    </button>
                </div>
            </div>
        </div>
    );
};