import React from 'react';
import {PluginRoot} from './components/PluginRoot';

// Global toggle state for plugin visibility
let pluginVisible = localStorage.getItem('jira_plugin_visible') === 'true' || window.location.hash === '#jira';

// Sync initial hash if localStorage was true but hash wasn't there
if (pluginVisible && window.location.hash !== '#jira') {
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#jira');
}

const toggleListeners: Array<() => void> = [];

export function togglePlugin(forceState?: boolean) {
    if (typeof forceState === 'boolean') {
        pluginVisible = forceState;
    } else {
        pluginVisible = !pluginVisible;
    }
    
    localStorage.setItem('jira_plugin_visible', String(pluginVisible));
    
    if (pluginVisible && window.location.hash !== '#jira') {
        window.history.pushState(null, '', window.location.pathname + window.location.search + '#jira');
    } else if (!pluginVisible && window.location.hash === '#jira') {
        window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
    
    toggleListeners.forEach((fn) => fn());
}

// Listen to browser Back/Forward buttons
window.addEventListener('popstate', () => {
    const shouldBeVisible = window.location.hash === '#jira';
    if (pluginVisible !== shouldBeVisible) {
        togglePlugin(shouldBeVisible);
    }
});

export function usePluginVisible(): [boolean, () => void] {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

    React.useEffect(() => {
        toggleListeners.push(forceUpdate);
        return () => {
            const idx = toggleListeners.indexOf(forceUpdate);
            if (idx >= 0) toggleListeners.splice(idx, 1);
        };
    }, []);

    return [pluginVisible, togglePlugin];
}

export const registerPlugin = (registry: any) => {
    // Register the main plugin component (renders in the DOM)
    registry.registerRootComponent(PluginRoot);

    // Register a channel header button so users can open the plugin
    registry.registerChannelHeaderButtonAction(
        // Kanban board icon
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="2" y="3" width="6" height="8" rx="1"/>
            <rect x="9" y="3" width="6" height="5" rx="1"/>
            <rect x="16" y="3" width="6" height="11" rx="1"/>
            <rect x="2" y="13" width="6" height="8" rx="1"/>
            <rect x="9" y="10" width="6" height="11" rx="1"/>
            <rect x="16" y="16" width="6" height="5" rx="1"/>
        </svg>,
        // Action: toggle the plugin panel
        () => togglePlugin(),
    );
};