import React, { useEffect } from 'react';
import {registerPlugin} from './register';

const BotInputHider = () => {
    useEffect(() => {
        let styleEl = document.getElementById('jira-bot-hide-input');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'jira-bot-hide-input';
            document.head.appendChild(styleEl);
        }

        const interval = setInterval(() => {
            // Check if we are in the Bot channel by looking at the header title
            // Mattermost puts the channel name in the header
            const headerTitles = document.querySelectorAll('#channelHeaderTitle, .channel-header__title');
            let isBotChannel = false;
            
            headerTitles.forEach((el) => {
                if (el.textContent && (el.textContent.includes('بوت إدارة المشاريع') || el.textContent.includes('jira.project.bot'))) {
                    isBotChannel = true;
                }
            });

            if (isBotChannel) {
                styleEl!.textContent = `
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
                styleEl!.textContent = '';
            }
        }, 500);

        return () => {
            clearInterval(interval);
            const el = document.getElementById('jira-bot-hide-input');
            if (el) el.remove();
        };
    }, []);
    
    return null;
};

declare global {
    interface Window {
        registerPlugin: any;
    }
}

class Plugin {
    initialize(registry: any, store: any) {
        registerPlugin(registry);
        registry.registerRootComponent(BotInputHider);

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