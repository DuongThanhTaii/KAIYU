"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// Theme mode type
export type ThemeMode = 'light' | 'dark' | 'system';

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

// Light mode defaults
const LIGHT_BACKGROUND = '#FFFFFF';
const LIGHT_SURFACE = '#F8FAFC';
const LIGHT_SURFACE_HIGHLIGHT = '#F1F5F9';

// Theme config stored in localStorage
interface ThemeConfig {
    themeMode: ThemeMode;
    primaryMode: 'preset' | 'custom';
    presetId?: string;
    customPrimaryColor?: string;
    backgroundMode: 'preset' | 'custom';
    backgroundPresetId?: string;
    customBackgroundColor?: string;
}

// Context type
interface ThemeContextType {
    themeMode: ThemeMode;
    currentPrimaryColor: string;
    currentBackgroundColor: string;
    themeConfig: ThemeConfig;
    presets: ThemePreset[];
    backgroundPresets: BackgroundPreset[];
    setThemeMode: (mode: ThemeMode) => void;
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

// Helper: Get luminance of a color
function getLuminance(hex: string) {
    const rgb = hex.replace('#', '').match(/.{2}/g)?.map(x => parseInt(x, 16) / 255) || [0, 0, 0];
    const [r, g, b] = rgb.map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Helper: Get contrast color (light or dark)
function getContrastColor(hex: string, darkOverride?: string) {
    const L = getLuminance(hex);
    return L > 0.45 ? (darkOverride || '#0F1724') : '#FFFFFF';
}

// Helper: Generate derived colors from primary
function generateDerivedColors(primary: string, background: string, mode: 'light' | 'dark') {
    const hex = primary.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    const isLight = mode === 'light';
    const bg = isLight ? LIGHT_BACKGROUND : background;

    // Background hex parsing
    const bgHex = bg.replace('#', '');
    const bgR = parseInt(bgHex.slice(0, 2), 16);
    const bgG = parseInt(bgHex.slice(2, 4), 16);
    const bgB = parseInt(bgHex.slice(4, 6), 16);

    // Derived colors logic
    const darken = (v: number, amount = 0.85) => Math.max(0, Math.round(v * amount));
    const lighten = (v: number, amount = 0.2) => Math.min(255, Math.round(v + (255 - v) * amount));

    const primaryHover = isLight 
        ? `#${darken(r, 0.9).toString(16).padStart(2, '0')}${darken(g, 0.9).toString(16).padStart(2, '0')}${darken(b, 0.9).toString(16).padStart(2, '0')}`
        : `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;

    const onPrimary = getContrastColor(primary);

    // Surface colors adaptive logic
    let surfaceDark, surfaceHighlight;
    if (isLight) {
        surfaceDark = LIGHT_SURFACE;
        surfaceHighlight = LIGHT_SURFACE_HIGHLIGHT;
    } else {
        const lightenBg = (v: number, amount: number) => Math.min(255, Math.round(v + amount));
        surfaceDark = `#${lightenBg(bgR, 15).toString(16).padStart(2, '0')}${lightenBg(bgG, 15).toString(16).padStart(2, '0')}${lightenBg(bgB, 15).toString(16).padStart(2, '0')}`;
        surfaceHighlight = `#${lightenBg(bgR, 30).toString(16).padStart(2, '0')}${lightenBg(bgG, 30).toString(16).padStart(2, '0')}${lightenBg(bgB, 30).toString(16).padStart(2, '0')}`;
    }
    
    const borderColor = isLight ? '#E2E8F0' : surfaceHighlight;

    // Text colors
    const textBase = isLight ? '#0F1724' : '#FFFFFF';
    const textSecondary = isLight ? '#64748B' : `#${lighten(r, 0.4).toString(16).padStart(2, '0')}${lighten(g, 0.4).toString(16).padStart(2, '0')}${lighten(b, 0.4).toString(16).padStart(2, '0')}`;

    return {
        '--color-primary': primary,
        '--color-primary-hover': primaryHover,
        '--color-on-primary': onPrimary,
        '--color-background-dark': bg,
        '--color-surface-dark': surfaceDark,
        '--color-surface-highlight': surfaceHighlight,
        '--color-border-color': borderColor,
        '--color-text-base': textBase,
        '--color-text-secondary': textSecondary,
    };
}

// Apply theme to document
function applyThemeToDocument(primary: string, background: string, mode: ThemeMode) {
    let resolvedMode: 'light' | 'dark' = 'dark';
    if (mode === 'system') {
        resolvedMode = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } else {
        resolvedMode = mode;
    }

    const colors = generateDerivedColors(primary, background, resolvedMode);
    const root = document.documentElement;
    
    // Set theme class for Tailwind dark: prefix
    if (resolvedMode === 'light') {
        root.classList.remove('dark');
        root.classList.add('light');
    } else {
        root.classList.remove('light');
        root.classList.add('dark');
    }

    Object.entries(colors).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
}

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>({
        themeMode: 'dark',
        primaryMode: 'preset',
        presetId: 'blue',
        backgroundMode: 'preset',
        backgroundPresetId: 'dark-blue',
    });

    const [currentPrimaryColor, setCurrentPrimaryColor] = useState(DEFAULT_PRIMARY);
    const [currentBackgroundColor, setCurrentBackgroundColor] = useState(DEFAULT_BACKGROUND);

    // Load theme from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            let config: ThemeConfig;
            
            if (stored) {
                config = JSON.parse(stored);
                // Migrating old config if themeMode is missing
                if (!config.themeMode) config.themeMode = 'dark';
            } else {
                config = {
                    themeMode: 'dark',
                    primaryMode: 'preset',
                    presetId: 'blue',
                    backgroundMode: 'preset',
                    backgroundPresetId: 'dark-blue',
                };
            }

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
            applyThemeToDocument(primary, background, config.themeMode);
        } catch (err) {
            console.error('Failed to load theme:', err);
        }
    }, []);

    // Listen for system theme changes
    useEffect(() => {
        if (themeConfig.themeMode !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
        const handleChange = () => {
            applyThemeToDocument(currentPrimaryColor, currentBackgroundColor, 'system');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [themeConfig.themeMode, currentPrimaryColor, currentBackgroundColor]);

    // Save and apply helper
    const saveAndApply = useCallback((config: ThemeConfig, primary: string, background: string) => {
        setThemeConfig(config);
        setCurrentPrimaryColor(primary);
        setCurrentBackgroundColor(background);
        applyThemeToDocument(primary, background, config.themeMode);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }, []);

    // Set theme mode
    const setThemeMode = useCallback((mode: ThemeMode) => {
        const config: ThemeConfig = { ...themeConfig, themeMode: mode };
        saveAndApply(config, currentPrimaryColor, currentBackgroundColor);
    }, [themeConfig, currentPrimaryColor, currentBackgroundColor, saveAndApply]);

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
            themeMode: 'dark',
            primaryMode: 'preset',
            presetId: 'blue',
            backgroundMode: 'preset',
            backgroundPresetId: 'dark-blue',
        };
        saveAndApply(config, DEFAULT_PRIMARY, DEFAULT_BACKGROUND);
    }, [saveAndApply]);

    const value: ThemeContextType = {
        themeMode: themeConfig.themeMode,
        currentPrimaryColor,
        currentBackgroundColor,
        themeConfig,
        presets: THEME_PRESETS,
        backgroundPresets: BACKGROUND_PRESETS,
        setThemeMode,
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
