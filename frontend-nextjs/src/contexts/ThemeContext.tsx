"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// Theme preset interface
export interface ThemePreset {
    id: string;
    name: string;
    primary: string;
}

// Background preset interface
export interface BackgroundPreset {
    id: string;
    name: string;
    color: string;
}

// Available preset themes
export const THEME_PRESETS: ThemePreset[] = [
    { id: 'blue', name: 'Mặc định', primary: '#20A7DF' },
    { id: 'green', name: 'Green', primary: '#4cdf20' },
    { id: 'pink', name: 'Rose Pink', primary: '#df2080' },
    { id: 'golden', name: 'Golden', primary: '#dfb020' },
    { id: 'purple', name: 'Purple', primary: '#8020df' },
];

// Available background presets
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
    { id: 'dark-blue', name: 'Mặc định', color: '#0F1724' },
    { id: 'dark-green', name: 'Forest', color: '#152111' },
    { id: 'dark-purple', name: 'Deep Purple', color: '#1a1426' },
    { id: 'dark-gray', name: 'Charcoal', color: '#1a1a1a' },
    { id: 'dark-brown', name: 'Mocha', color: '#1c1614' },
];

// Theme config stored in localStorage
interface ThemeConfig {
    primaryMode: 'preset' | 'custom';
    presetId?: string;
    customPrimaryColor?: string;
    backgroundMode: 'preset' | 'custom';
    backgroundPresetId?: string;
    customBackgroundColor?: string;
}

// Context type
interface ThemeContextType {
    currentPrimaryColor: string;
    currentBackgroundColor: string;
    themeConfig: ThemeConfig;
    presets: ThemePreset[];
    backgroundPresets: BackgroundPreset[];
    setPreset: (presetId: string) => void;
    setCustomColor: (color: string) => void;
    setBackgroundPreset: (presetId: string) => void;
    setCustomBackgroundColor: (color: string) => void;
    resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'theme-config';
const DEFAULT_PRIMARY = '#20A7DF';
const DEFAULT_BACKGROUND = '#0F1724';

// Helper: Generate derived colors from primary
function generateDerivedColors(primary: string, background: string) {
    const hex = primary.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    // Background hex parsing
    const bgHex = background.replace('#', '');
    const bgR = parseInt(bgHex.slice(0, 2), 16);
    const bgG = parseInt(bgHex.slice(2, 4), 16);
    const bgB = parseInt(bgHex.slice(4, 6), 16);

    // Darker for hover
    const darken = (v: number) => Math.max(0, Math.round(v * 0.85));
    const primaryHover = `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;

    // Very dark for on-primary (text on primary background)
    const veryDark = (v: number) => Math.max(0, Math.round(v * 0.2));
    const onPrimary = `#${veryDark(r).toString(16).padStart(2, '0')}${veryDark(g).toString(16).padStart(2, '0')}${veryDark(b).toString(16).padStart(2, '0')}`;

    // Surface colors derived from background
    const lightenBg = (v: number, amount: number) => Math.min(255, Math.round(v + amount));
    const surfaceDark = `#${lightenBg(bgR, 15).toString(16).padStart(2, '0')}${lightenBg(bgG, 15).toString(16).padStart(2, '0')}${lightenBg(bgB, 15).toString(16).padStart(2, '0')}`;
    const surfaceHighlight = `#${lightenBg(bgR, 30).toString(16).padStart(2, '0')}${lightenBg(bgG, 30).toString(16).padStart(2, '0')}${lightenBg(bgB, 30).toString(16).padStart(2, '0')}`;
    const borderColor = surfaceHighlight;

    // Text secondary with primary tint
    const lighten = (v: number) => Math.min(255, Math.round(v * 0.6 + 100));
    const textSecondary = `#${lighten(r).toString(16).padStart(2, '0')}${lighten(g).toString(16).padStart(2, '0')}${lighten(b).toString(16).padStart(2, '0')}`;

    return {
        '--color-primary': primary,
        '--color-primary-hover': primaryHover,
        '--color-on-primary': onPrimary,
        '--color-background-dark': background,
        '--color-surface-dark': surfaceDark,
        '--color-surface-highlight': surfaceHighlight,
        '--color-border-color': borderColor,
        '--color-text-secondary': textSecondary,
    };
}

// Apply theme to document
function applyThemeToDocument(primary: string, background: string) {
    const colors = generateDerivedColors(primary, background);
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
}

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>({
        primaryMode: 'preset',
        presetId: 'green',
        backgroundMode: 'preset',
        backgroundPresetId: 'dark-green',
    });

    const [currentPrimaryColor, setCurrentPrimaryColor] = useState(DEFAULT_PRIMARY);
    const [currentBackgroundColor, setCurrentBackgroundColor] = useState(DEFAULT_BACKGROUND);

    // Load theme from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const config: ThemeConfig = JSON.parse(stored);
                setThemeConfig(config);

                // Get primary color
                let primary = DEFAULT_PRIMARY;
                if (config.primaryMode === 'preset' && config.presetId) {
                    const preset = THEME_PRESETS.find(p => p.id === config.presetId);
                    if (preset) primary = preset.primary;
                } else if (config.primaryMode === 'custom' && config.customPrimaryColor) {
                    primary = config.customPrimaryColor;
                }

                // Get background color
                let background = DEFAULT_BACKGROUND;
                if (config.backgroundMode === 'preset' && config.backgroundPresetId) {
                    const preset = BACKGROUND_PRESETS.find(p => p.id === config.backgroundPresetId);
                    if (preset) background = preset.color;
                } else if (config.backgroundMode === 'custom' && config.customBackgroundColor) {
                    background = config.customBackgroundColor;
                }

                setCurrentPrimaryColor(primary);
                setCurrentBackgroundColor(background);
                applyThemeToDocument(primary, background);
            }
        } catch (err) {
            console.error('Failed to load theme:', err);
        }
    }, []);

    // Save and apply helper
    const saveAndApply = useCallback((config: ThemeConfig, primary: string, background: string) => {
        setThemeConfig(config);
        setCurrentPrimaryColor(primary);
        setCurrentBackgroundColor(background);
        applyThemeToDocument(primary, background);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }, []);

    // Set preset theme
    const setPreset = useCallback((presetId: string) => {
        const preset = THEME_PRESETS.find(p => p.id === presetId);
        if (!preset) return;

        const config: ThemeConfig = {
            ...themeConfig,
            primaryMode: 'preset',
            presetId,
            customPrimaryColor: undefined,
        };
        saveAndApply(config, preset.primary, currentBackgroundColor);
    }, [themeConfig, currentBackgroundColor, saveAndApply]);

    // Set custom primary color
    const setCustomColor = useCallback((color: string) => {
        const config: ThemeConfig = {
            ...themeConfig,
            primaryMode: 'custom',
            customPrimaryColor: color,
        };
        saveAndApply(config, color, currentBackgroundColor);
    }, [themeConfig, currentBackgroundColor, saveAndApply]);

    // Set background preset
    const setBackgroundPreset = useCallback((presetId: string) => {
        const preset = BACKGROUND_PRESETS.find(p => p.id === presetId);
        if (!preset) return;

        const config: ThemeConfig = {
            ...themeConfig,
            backgroundMode: 'preset',
            backgroundPresetId: presetId,
            customBackgroundColor: undefined,
        };
        saveAndApply(config, currentPrimaryColor, preset.color);
    }, [themeConfig, currentPrimaryColor, saveAndApply]);

    // Set custom background color
    const setCustomBackgroundColor = useCallback((color: string) => {
        const config: ThemeConfig = {
            ...themeConfig,
            backgroundMode: 'custom',
            customBackgroundColor: color,
        };
        saveAndApply(config, currentPrimaryColor, color);
    }, [themeConfig, currentPrimaryColor, saveAndApply]);

    // Reset to default
    const resetToDefault = useCallback(() => {
        const config: ThemeConfig = {
            primaryMode: 'preset',
            presetId: 'green',
            backgroundMode: 'preset',
            backgroundPresetId: 'dark-green',
        };
        saveAndApply(config, DEFAULT_PRIMARY, DEFAULT_BACKGROUND);
    }, [saveAndApply]);

    const value: ThemeContextType = {
        currentPrimaryColor,
        currentBackgroundColor,
        themeConfig,
        presets: THEME_PRESETS,
        backgroundPresets: BACKGROUND_PRESETS,
        setPreset,
        setCustomColor,
        setBackgroundPreset,
        setCustomBackgroundColor,
        resetToDefault,
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Custom hook
export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export default ThemeContext;
