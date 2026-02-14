import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Mode = 'light' | 'dark';
export type Palette = 'a' | 'b' | 'c' | 'd';

export const PALETTE_META: Record<Palette, { name: string; emoji: string }> = {
    a: { name: 'Purple Mint', emoji: '🟣' },
    b: { name: 'Orange Fire', emoji: '🟠' },
    c: { name: 'Pink Cream', emoji: '🩷' },
    d: { name: 'Rose Peach', emoji: '🌸' },
};

interface ThemeContextType {
    mode: Mode;
    palette: Palette;
    toggleMode: () => void;
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
        if (stored && ['a', 'b', 'c', 'd'].includes(stored)) return stored as Palette;
        return 'a';
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
        <ThemeContext.Provider value={{ mode, palette, toggleMode, setPalette }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
