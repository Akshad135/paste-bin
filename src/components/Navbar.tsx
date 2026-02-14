import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useTheme, PALETTE_META, type Palette } from '@/components/ThemeProvider';
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
import { Palette as PaletteIcon } from 'lucide-react';
import { SunIcon } from '@/components/ui/animated-sun';
import { MoonIcon } from '@/components/ui/animated-moon';
import { MenuIcon } from '@/components/ui/animated-menu';
import { LogoutIcon } from '@/components/ui/animated-logout';
import { PlusIcon } from '@/components/ui/animated-plus';
import { HomeIcon } from '@/components/ui/animated-home';
import { KeyIcon } from '@/components/ui/animated-key';
import { LoaderPinwheelIcon } from '@/components/ui/animated-loader-pinwheel';
import { toast } from 'sonner';

export function Navbar() {
    const { isAuthenticated, logout, login } = useAuth();
    const { mode, palette, toggleMode, setPalette } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [passphrase, setPassphrase] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);

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
                <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between px-4 sm:px-6">
                    {/* Logo — left */}
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 font-bold text-lg tracking-tight cursor-pointer"
                    >
                        <span className="text-primary text-xl">&lt;/&gt;</span>
                        <span>paste<span className="text-primary">bin</span></span>
                    </button>

                    {/* Desktop center nav — hidden on mobile */}
                    <nav className="hidden sm:flex items-center gap-1">
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
                    <div className="flex items-center gap-1">
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
                            {/* Palette picker */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    >
                                        <PaletteIcon className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                    {(Object.keys(PALETTE_META) as Palette[]).map((p) => (
                                        <DropdownMenuItem
                                            key={p}
                                            onClick={() => setPalette(p)}
                                            className={palette === p ? 'bg-primary/10 text-primary' : ''}
                                        >
                                            <span className="mr-2">{PALETTE_META[p].emoji}</span>
                                            {PALETTE_META[p].name}
                                            {palette === p && <span className="ml-auto text-xs">✓</span>}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Mode toggle */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleMode}
                                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            >
                                {mode === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
                            </Button>

                            {isAuthenticated ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLogout}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    <LogoutIcon size={16} className="mr-1.5" />
                                    Logout
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={() => setIsLoginOpen(true)}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                                {/* Theme toggle */}
                                <DropdownMenuItem onClick={toggleMode}>
                                    {mode === 'dark'
                                        ? <><SunIcon size={16} className="mr-2" /> Light Mode</>
                                        : <><MoonIcon size={16} className="mr-2" /> Dark Mode</>
                                    }
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {/* Palette options */}
                                {(Object.keys(PALETTE_META) as Palette[]).map((p) => (
                                    <DropdownMenuItem
                                        key={p}
                                        onClick={() => setPalette(p)}
                                        className={palette === p ? 'bg-primary/10 text-primary' : ''}
                                    >
                                        <span className="mr-2">{PALETTE_META[p].emoji}</span>
                                        {PALETTE_META[p].name}
                                        {palette === p && <span className="ml-auto text-xs">✓</span>}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                {/* Auth */}
                                {isAuthenticated ? (
                                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                        <LogoutIcon size={16} className="mr-2" /> Logout
                                    </DropdownMenuItem>
                                ) : (
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
        </>
    );
}
