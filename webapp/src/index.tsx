import React from 'react';
import {PluginRoot} from './components/PluginRoot';

const PLUGIN_ID = 'com.workspace.plugin.jira';

// Extend Window type for Mattermost plugin registration
declare global {
    interface Window {
        registerPlugin: (pluginId: string, plugin: any) => void;
    }
}

// Placeholder header components – return null so the product page gets the full width.
const GlobalHeaderCenter = () => { return null; };
const GlobalHeaderRight = () => { return null; };

class Plugin {
    initialize(registry: any) {
        // Register as a product so the plugin gets its own sidebar icon,
        // dedicated URL (/jira), and header area (requires server >= 7.0).
        registry.registerProduct(
            '/jira',
            'product-jira',
            '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0634\u0627\u0631\u064a\u0639',   // إدارة المشاريع
            '/jira',
            PluginRoot,
            GlobalHeaderCenter,
            GlobalHeaderRight,
            true,   // show as sidebar item
        );

        // WebSocket real-time sync
        registry.registerWebSocketEventHandler(
            'custom_com.workspace.plugin.jira_project_updated',
            (msg: any) => {
                const data = msg.data || {};
                window.dispatchEvent(new CustomEvent('jira_project_updated', { detail: data }));
            }
        );
    }
}

// Mattermost plugin registration
window.registerPlugin(PLUGIN_ID, new Plugin());
