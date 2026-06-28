import {registerPlugin} from './register';

declare global {
    interface Window {
        registerPlugin: any;
    }
}

class Plugin {
    initialize(registry: any, store: any) {
        registerPlugin(registry);

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
window.registerPlugin('com.workspace.plugin.jira', new Plugin());