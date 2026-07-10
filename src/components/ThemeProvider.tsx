import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Mode = 'light' | 'dark';
export type Palette = 'catppuccin' | 'terminal' | 'tokyo' | 'dracula' | 'nord' | 'gruvbox' | 'one' | 'solarized' | 'kanagawa' | 'rose-pine' | 'vesper';

export const PALETTE_META: Record<Palette, { name: string; emoji: string }> = {
    'catppuccin': { name: 'Catppuccin', emoji: '' },
    'terminal': { name: 'Terminal', emoji: '' },
    'tokyo': { name: 'Tokyo Night', emoji: '' },
    'dracula': { name: 'Dracula', emoji: '' },
    'nord': { name: 'Nord', emoji: '' },
    'gruvbox': { name: 'Gruvbox', emoji: '' },
    'one': { name: 'One Dark', emoji: '' },
    'solarized': { name: 'Solarized', emoji: '' },
    'kanagawa': { name: 'Kanagawa', emoji: '' },
    'rose-pine': { name: 'Rose Pine', emoji: '' },
    'vesper': { name: 'Vesper', emoji: '' },
};

interface ThemeContextType {
    mode: Mode;
    palette: Palette;
    toggleMode: () => void;
    setMode: (m: Mode) => void;
    setPalette: (p: Palette) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<Mode>(() => {
        const stored = localStorage.getItem('theme-mode');
        if (stored === 'light' || stored === 'dark') return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    const [palette, setPaletteState] = useState<Palette>(() => {
        const stored = localStorage.getItem('theme-palette');
        if (stored && ['catppuccin', 'terminal', 'tokyo', 'dracula', 'nord', 'gruvbox', 'one', 'solarized', 'kanagawa', 'rose-pine', 'vesper'].includes(stored)) return stored as Palette;
        return 'catppuccin';
    });

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', mode === 'dark');
        root.classList.toggle('light', mode === 'light');
        root.setAttribute('data-palette', palette);
        localStorage.setItem('theme-mode', mode);
        localStorage.setItem('theme-palette', palette);
    }, [mode, palette]);

    const toggleMode = () => setMode(prev => prev === 'dark' ? 'light' : 'dark');
    const setPalette = (p: Palette) => setPaletteState(p);

    return (
        <ThemeContext.Provider value={{ mode, palette, toggleMode, setMode, setPalette }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
