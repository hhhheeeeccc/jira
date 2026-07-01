import React from 'react';
import {PluginRoot} from './components/PluginRoot';
import KanbanIcon from './components/KanbanIcon';

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
    const browserHistory = (window as unknown as Record<string, unknown>).WebappUtils as { browserHistory: { push: (path: string) => void } } | undefined;
    if (browserHistory) {
        browserHistory.browserHistory.push('/jira');
    } else {
        // Fallback
        const teamName = window.location.pathname.split('/')[1] || '';
        window.location.href = `/${teamName}/jira`;
    }
};

export const registerPlugin = (registry: unknown) => {
    // Register as a native Mattermost Product (like Playbooks/Boards)
    // Parameters: baseURL, productIcon, productName, defaultLandingPage, mainComponent, headerCenterComponent, headerRightComponent, enableTeamSidebar
    const reg = registry as Record<string, unknown>;
    if (typeof reg.registerProduct === 'function') {
        (reg.registerProduct as (...args: unknown[]) => void)(
            '/jira',
            ProductSwitcherIcon,
            'إدارة مشاريع جيرا',
            '/jira',
            PluginRoot,
            GlobalHeaderCenter,
            null,
            true
        );
    } else if (typeof reg.registerCustomRoute === 'function') {
        (reg.registerCustomRoute as (path: string, component: React.FC) => void)('/jira', PluginRoot);
    }

    if (typeof reg.registerChannelHeaderButtonAction === 'function') {
        (reg.registerChannelHeaderButtonAction as (icon: React.ReactNode, action: () => void, tooltipText: string, ariaLabel: string) => void)(
            <KanbanIcon />,
            navigateToJira,
            "إدارة مشاريع جيرا",
            "إدارة مشاريع جيرا"
        );
    }
};