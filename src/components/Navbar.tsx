import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useTheme, PALETTE_META, type Palette } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sun, Moon, Menu, LogOut, Plus, Home, KeyRound, Loader2, Palette as PaletteIcon } from 'lucide-react';
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
        <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
                {/* Logo */}
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 font-bold text-lg tracking-tight cursor-pointer"
                >
                    <span className="text-primary text-xl">&lt;/&gt;</span>
                    <span>paste<span className="text-primary">bin</span></span>
                </button>

                {/* Desktop nav */}
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
                        <Home className="h-4 w-4 mr-1.5" />
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
                            <Plus className="h-4 w-4 mr-1.5" />
                            New Paste
                        </Button>
                    )}
                </nav>

                {/* Right side: palette + theme + auth */}
                <div className="flex items-center gap-1">
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
                        {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>

                    {isAuthenticated ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogout}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            <LogOut className="h-4 w-4 mr-1.5" />
                            <span className="hidden sm:inline">Logout</span>
                        </Button>
                    ) : (
                        <Popover
                            open={isLoginOpen}
                            onOpenChange={(open) => {
                                setIsLoginOpen(open);
                                if (!open) { setPassphrase(''); setLoginError(''); }
                            }}
                        >
                            <PopoverTrigger asChild>
                                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                    <KeyRound className="h-4 w-4 mr-1.5" />
                                    Login
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-72">
                                <form onSubmit={handleLogin} className="flex flex-col gap-3">
                                    <p className="text-sm font-semibold text-center">Login</p>
                                    <Input
                                        type="password"
                                        placeholder="Enter passphrase"
                                        value={passphrase}
                                        onChange={(e) => setPassphrase(e.target.value)}
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
                                        {loginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Login
                                    </Button>
                                </form>
                            </PopoverContent>
                        </Popover>
                    )}

                    {/* Mobile hamburger */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="sm:hidden h-9 w-9 text-muted-foreground">
                                <Menu className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate('/')}>
                                <Home className="h-4 w-4 mr-2 text-primary" /> Home
                            </DropdownMenuItem>
                            {isAuthenticated && (
                                <DropdownMenuItem onClick={() => navigate('/new')}>
                                    <Plus className="h-4 w-4 mr-2 text-primary" /> New Paste
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {(Object.keys(PALETTE_META) as Palette[]).map((p) => (
                                <DropdownMenuItem
                                    key={p}
                                    onClick={() => setPalette(p)}
                                    className={palette === p ? 'bg-primary/10 text-primary' : ''}
                                >
                                    <span className="mr-2">{PALETTE_META[p].emoji}</span>
                                    {PALETTE_META[p].name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
