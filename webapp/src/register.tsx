import React from 'react';
import {PluginRoot} from './components/PluginRoot';

export const registerPlugin = (registry: any) => {
    registry.registerRootComponent(PluginRoot);
};