import type { FC } from 'react';
import { useEffect } from 'react';
import {registerPlugin} from './register';

const BotInputHider = () => {
    useEffect(() => {
        let styleEl = document.getElementById('jira-bot-hide-input');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'jira-bot-hide-input';
            document.head.appendChild(styleEl);
        }

        const updateStyle = () => {
            if (!styleEl) return;

            const headerTitles = document.querySelectorAll('#channelHeaderTitle, .channel-header__title');
            let isBotChannel = false;

            headerTitles.forEach((el) => {
                if (el.textContent && (el.textContent.includes('بوت إدارة المشاريع') || el.textContent.includes('jira.project.bot'))) {
                    isBotChannel = true;
                }
            });

            if (isBotChannel) {
                styleEl.textContent = `
                    #create_post {
                        position: relative !important;
                    }
                    /* Overlay covering the entire input box */
                    #create_post::after {
                        content: "لا يمكن إرسال رسائل لهذا البوت.";
                        position: absolute;
                        inset: 0;
                        background: var(--center-channel-bg);
                        z-index: 9999;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--button-bg);
                        font-weight: bold;
                        font-size: 14px;
                        border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
                        pointer-events: all;
                    }
                    /* Prevent interaction with elements underneath just in case */
                    #create_post * {
                        pointer-events: none !important;
                    }
                `;
            } else {
                styleEl.textContent = '';
            }
        };

        // Run once immediately
        updateStyle();

        // Use MutationObserver to watch for channel header title changes
        const observer = new MutationObserver(() => {
            updateStyle();
        });

        const headerContainer = document.querySelector('#channelHeaderTitle, .channel-header__title');
        if (headerContainer) {
            observer.observe(headerContainer, { childList: true, subtree: true, characterData: true });
        } else {
            // If header not yet in DOM, observe the body for subtree changes
            observer.observe(document.body, { childList: true, subtree: true });
        }

        return () => {
            observer.disconnect();
            const el = document.getElementById('jira-bot-hide-input');
            if (el) el.remove();
        };
    }, []);

    return null;
};

interface MattermostRegistry {
    registerRootComponent: (c: FC) => void;
    registerWebSocketEventHandler: (event: string, handler: (msg: { data?: Record<string, unknown> }) => void) => void;
}

class Plugin {
    initialize(registry: MattermostRegistry, _store: unknown) {
        registerPlugin(registry);
        registry.registerRootComponent(BotInputHider);

        registry.registerWebSocketEventHandler(
            'custom_com.workspace.plugin.jira_project_updated',
            (msg) => {
                const data = msg.data || {};
                window.dispatchEvent(new CustomEvent('jira_project_updated', { detail: data }));
            }
        );
    }
}

// Mattermost plugin registration
declare global {
    interface Window {
        registerPlugin: (pluginId: string, plugin: { initialize: (registry: MattermostRegistry, store: unknown) => void }) => void;
    }
}
window.registerPlugin('com.workspace.plugin.jira', new Plugin());