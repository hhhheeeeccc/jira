import React from 'react';
import {PluginRoot} from './components/PluginRoot';

const KanbanIcon = ({ color, size = 16 }: { color?: string, size?: number | string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="17" height="17" rx="2" ry="2"/>
        <path d="M8 7v7"/>
        <path d="M12 7v4"/>
        <path d="M16 7v9"/>
    </svg>
);

const ProductSwitcherIcon = () => <KanbanIcon color="var(--button-bg)" size={17} />;

// Inject CSS to set the global header background to sidebar-bg when on /jira route
const GlobalHeaderCenter = () => {
    React.useEffect(() => {
        const styleId = 'jira-plugin-header-style';
        let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = `
            #global-header,
            .global-header,
            [class*="GlobalHeaderContainer"],
            [class*="global-header"] {
                background: var(--sidebar-header-bg) !important;
                border-bottom-color: rgba(var(--sidebar-text-rgb, 255,255,255), 0.08) !important;
            }
            #team-sidebar,
            .team-sidebar,
            [class*="TeamSidebar"],
            [class*="team-sidebar"] {
                background: var(--sidebar-header-bg) !important;
            }
            
            /* Fix white borders/gaps around the plugin */
            #app-content,
            .app__content,
            .main-wrapper,
            .product-wrapper,
            .a11y__region,
            .a11y__region > div {
                background: var(--center-channel-bg) !important;
                padding: 0 !important;
                margin: 0 !important;
                height: 100% !important;
                display: flex !important;
                flex: 1 1 auto !important;
                flex-direction: column !important;
                border-radius: 0 !important;
            }

        `;
        return () => {
            // Remove style when unmounted (leaving /jira)
            const el = document.getElementById(styleId);
            if (el) el.remove();
        };
    }, []);
    return null;
};

const navigateToJira = () => {
    // Use Mattermost's SPA router to avoid full page refresh
    const browserHistory = (window as any).WebappUtils?.browserHistory;
    if (browserHistory) {
        browserHistory.push('/jira');
    } else {
        // Fallback
        const teamName = window.location.pathname.split('/')[1] || '';
        window.location.href = `/${teamName}/jira`;
    }
};

export const registerPlugin = (registry: any) => {
    // Register as a native Mattermost Product (like Playbooks/Boards)
    // Parameters: baseURL, productIcon, productName, defaultLandingPage, mainComponent, headerCenterComponent, headerRightComponent, enableTeamSidebar
    if (registry.registerProduct) {
        registry.registerProduct(
            '/jira',
            ProductSwitcherIcon,
            'إدارة مشاريع جيرا',
            '/jira',
            PluginRoot,
            GlobalHeaderCenter,
            null,
            true
        );
    } else {
        registry.registerCustomRoute('/jira', PluginRoot);
    }

    registry.registerChannelHeaderButtonAction(
        <KanbanIcon />,
        navigateToJira,
        "إدارة مشاريع جيرا",
        "إدارة مشاريع جيرا"
    );
};