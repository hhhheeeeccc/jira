import {registerPlugin} from './register';

declare global {
    interface Window {
        registerPlugin: any;
    }
}

// Mattermost plugin registration
window.registerPlugin('com.mattermost.plugin.jira', registerPlugin);