import { config } from '@/lib/config';
import React, { useState, useEffect } from 'react';
import { GhostIcon } from '@/components/GhostIcon';
import { useDynamicFavicon } from '@/hooks/useDynamicFavicon';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { PaletteIcon } from '@/components/ui/animated-palette';


import { MenuIcon } from '@/components/ui/animated-menu';
import { LogoutIcon } from '@/components/ui/animated-logout';
import { PlusIcon } from '@/components/ui/animated-plus';
import { HomeIcon } from '@/components/ui/animated-home';
import { KeyIcon } from '@/components/ui/animated-key';
import { LoaderPinwheelIcon } from '@/components/ui/animated-loader-pinwheel';
import { toast } from 'sonner';

// True when using the bundled ghost icon (not a custom one via env vars)
const faviconEnv = import.meta.env.VITE_FAVICON_URL;
const isDefaultIcon = !faviconEnv || faviconEnv === '/favicon.svg';

const DARK_THEMES = [
    { key: 'catppuccin', label: 'catppuccin' },
    { key: 'dracula', label: 'dracula' },
    { key: 'gruvbox', label: 'gruvbox' },
    { key: 'kanagawa', label: 'kanagawa' },
    { key: 'nord', label: 'nord' },
    { key: 'one', label: 'one dark' },
    { key: 'rose-pine', label: 'rose pine' },
    { key: 'solarized', label: 'solarized' },
    { key: 'terminal', label: 'terminal' },
    { key: 'tokyo', label: 'tokyo night' },
    { key: 'vesper', label: 'vesper' }
];

const LIGHT_THEMES = [
    { key: 'catppuccin', label: 'catppuccin latte' },
    { key: 'gruvbox', label: 'gruvbox light' },
    { key: 'kanagawa', label: 'kanagawa lotus' },
    { key: 'one', label: 'one light' },
    { key: 'rose-pine', label: 'rose pine dawn' },
    { key: 'solarized', label: 'solarized light' },
    { key: 'tokyo', label: 'tokyo day' }
];

const ALL_THEMES = [
    ...DARK_THEMES.map(t => ({ ...t, mode: 'dark' })),
    ...LIGHT_THEMES.map(t => ({ ...t, mode: 'light' }))
];

export function Navbar() {
    const { isAuthenticated, logout, login } = useAuth();

    const navigate = useNavigate();
    const location = useLocation();
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [isThemeOpen, setIsThemeOpen] = useState(false);
    const [passphrase, setPassphrase] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);

    // Dynamically update favicon color when using the default ghost icon
    useDynamicFavicon(isDefaultIcon);

    // Listen for custom open-login events (e.g. from Home page landing button)
    useEffect(() => {
        const handleOpenLogin = () => setIsLoginOpen(true);
        window.addEventListener('open-login', handleOpenLogin);
        return () => window.removeEventListener('open-login', handleOpenLogin);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passphrase.trim()) {
            setLoginError('Passphrase is required');
            return;
        }
        setLoginLoading(true);
        setLoginError('');
        try {
            await login(passphrase);
            setPassphrase('');
            setIsLoginOpen(false);
            toast.success('Logged in!');
        } catch (err) {
            setLoginError(err instanceof Error ? err.message : 'Invalid passphrase');
        } finally {
            setLoginLoading(false);
        }
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <>
            <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg">
                <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between px-4 sm:px-6 relative">
                    {/* Logo — left */}
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 font-bold text-lg tracking-tight cursor-pointer z-10"
                    >
                        {isDefaultIcon
                            ? <GhostIcon size={24} className="h-6 w-6 text-primary" />
                            : <img src={config.faviconUrl} alt="" className="h-6 w-6" />
                        }
                        <span>
                            {config.appNamePrefix}
                            <span className="text-primary">{config.appNameAccent}</span>
                        </span>
                    </button>

                    {/* Desktop center nav — hidden on mobile */}
                    <nav className="hidden sm:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
                        <Button
                            variant={isActive('/') ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => navigate('/')}
                            className={isActive('/')
                                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }
                        >
                            <HomeIcon size={16} className="mr-1.5" />
                            Home
                        </Button>
                        {isAuthenticated && (
                            <Button
                                variant={isActive('/new') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => navigate('/new')}
                                className={isActive('/new')
                                    ? 'bg-primary/15 text-primary hover:bg-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                }
                            >
                                <PlusIcon size={16} className="mr-1.5" />
                                New Paste
                            </Button>
                        )}
                    </nav>

                    {/* Right side */}
                    <div className="flex items-center gap-1 z-10">
                        {/* Mobile: icon-only nav buttons */}
                        <Button
                            variant={isActive('/') ? 'default' : 'ghost'}
                            size="icon"
                            onClick={() => navigate('/')}
                            className={`sm:hidden h-9 w-9 ${isActive('/')
                                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                        >
                            <HomeIcon size={16} />
                        </Button>
                        {isAuthenticated && (
                            <Button
                                variant={isActive('/new') ? 'default' : 'ghost'}
                                size="icon"
                                onClick={() => navigate('/new')}
                                className={`sm:hidden h-9 w-9 ${isActive('/new')
                                    ? 'bg-primary/15 text-primary hover:bg-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                            >
                                <PlusIcon size={16} />
                            </Button>
                        )}

                        {/* Desktop controls: palette + theme + auth */}
                        <div className="hidden sm:flex items-center gap-1">
                            {/* Theme Modal Trigger */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsThemeOpen(true)}
                                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            >
                                <PaletteIcon size={16} />
                            </Button>

                            {isAuthenticated && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLogout}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    <LogoutIcon size={16} className="mr-1.5" />
                                    Logout
                                </Button>
                            )}
                            {!isAuthenticated && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsLoginOpen(true)}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <KeyIcon size={16} className="mr-1.5" />
                                    Login
                                </Button>
                            )}
                        </div>

                        {/* Mobile: hamburger menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="sm:hidden h-9 w-9 text-muted-foreground">
                                    <MenuIcon size={16} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                {/* Theme Modal Trigger */}
                                <DropdownMenuItem onClick={() => setIsThemeOpen(true)}>
                                    <PaletteIcon size={16} className="mr-2" /> Change Theme
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {/* Auth — available online and offline */}
                                {isAuthenticated && (
                                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                        <LogoutIcon size={16} className="mr-2" /> Logout
                                    </DropdownMenuItem>
                                )}
                                {!isAuthenticated && (
                                    <DropdownMenuItem onClick={() => setIsLoginOpen(true)}>
                                        <KeyIcon size={16} className="mr-2" /> Login
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            {/* Login dialog — centered modal like delete confirmation */}
            <Dialog
                open={isLoginOpen}
                onOpenChange={(open) => {
                    setIsLoginOpen(open);
                    if (!open) { setPassphrase(''); setLoginError(''); }
                }}
            >
                <DialogContent className="max-w-xs mx-auto p-5">
                    <DialogHeader>
                        <DialogTitle className="text-center text-base">Login</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleLogin} className="flex flex-col gap-3 mt-1">
                        <Input
                            type="password"
                            placeholder="Enter passphrase"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            className="h-9"
                            autoFocus
                        />
                        {loginError && (
                            <p className="text-xs text-destructive">{loginError}</p>
                        )}
                        <Button
                            type="submit"
                            size="sm"
                            disabled={loginLoading}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            {loginLoading && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                            Login
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Theme picker dialog */}
            <ThemeModal open={isThemeOpen} onOpenChange={setIsThemeOpen} />
        </>
    );
}

function ThemeModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const { mode, palette, setMode, setPalette } = useTheme();
    const [activeIndex, setActiveIndex] = useState(0);

    // Sync active index when opened
    useEffect(() => {
        if (open) {
            const idx = ALL_THEMES.findIndex(t => t.key === palette && t.mode === mode);
            setActiveIndex(idx >= 0 ? idx : 0);
        }
    }, [open, mode, palette]);

    const applyTheme = (index: number) => {
        const t = ALL_THEMES[index];
        setMode(t.mode as any);
        setPalette(t.key as any);
    };

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % ALL_THEMES.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + ALL_THEMES.length) % ALL_THEMES.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                onOpenChange(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        applyTheme(activeIndex);
    }, [activeIndex, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md mx-auto p-0 border border-border/50 bg-background/80 backdrop-blur-2xl overflow-hidden rounded-xl gap-0 shadow-2xl [&>button]:hidden">
                {/* Top Bar with Controls */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/20 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 font-medium">
                        ↑↓ select
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 bg-primary/20 text-primary px-1.5 py-0.5 rounded-md font-medium">
                            <span className="text-[10px]">↵</span> apply
                        </span>
                        <span className="text-muted-foreground px-1">
                            esc close
                        </span>
                        <button 
                            onClick={() => onOpenChange(false)}
                            className="ml-1 flex items-center justify-center h-5 w-5 rounded hover:bg-muted-foreground/20 transition-colors"
                        >
                            <PlusIcon size={14} className="rotate-45" />
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex flex-col p-1.5 outline-none">
                    {ALL_THEMES.map((t, i) => {
                        const isFirstDark = i === 0;
                        const isFirstLight = i === DARK_THEMES.length;

                        return (
                            <React.Fragment key={`${t.mode}-${t.key}`}>
                                {isFirstDark && (
                                    <div className="flex items-center gap-3 px-2 py-1.5 mt-0.5 text-[10px] uppercase font-semibold text-muted-foreground tracking-widest">
                                        dark <div className="h-px bg-border/50 flex-1" />
                                    </div>
                                )}
                                {isFirstLight && (
                                    <div className="flex items-center gap-3 px-2 py-1.5 mt-1.5 text-[10px] uppercase font-semibold text-muted-foreground tracking-widest">
                                        light <div className="h-px bg-border/50 flex-1" />
                                    </div>
                                )}
                                <button
                                    onMouseEnter={() => {
                                        setActiveIndex(i);
                                        applyTheme(i);
                                    }}
                                    onClick={() => {
                                        applyTheme(i);
                                        onOpenChange(false);
                                    }}
                                    className={`flex items-center px-3 py-1 text-sm text-left rounded-md transition-colors duration-75 ${
                                        activeIndex === i 
                                            ? 'bg-primary/15 text-primary font-medium' 
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <span className="w-4 flex justify-center text-primary font-bold mr-1">
                                        {activeIndex === i ? '•' : ''}
                                    </span>
                                    {t.label}
                                    {activeIndex === i && <span className="ml-auto text-xs">✓</span>}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}

