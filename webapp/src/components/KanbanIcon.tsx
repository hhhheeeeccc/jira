import React from 'react';

const KanbanIcon: React.FC<{ className?: string; color?: string; size?: number | string }> = ({ className, color, size = 16 }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <path d="M8 7v7"/>
        <path d="M12 7v4"/>
        <path d="M16 7v9"/>
    </svg>
);

export default KanbanIcon;