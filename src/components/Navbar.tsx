import {
    Navbar as HeroNavbar,
    NavbarBrand,
    NavbarContent,
    NavbarItem,
    NavbarMenuToggle,
    NavbarMenu,
    NavbarMenuItem,
    Button,
    Link,
} from '@heroui/react';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function Navbar() {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <HeroNavbar
            isMenuOpen={isMenuOpen}
            onMenuOpenChange={setIsMenuOpen}
            maxWidth="xl"
            isBordered
            classNames={{
                base: 'bg-background/70 backdrop-blur-xl',
                wrapper: 'px-4 sm:px-6',
            }}
        >
            <NavbarContent>
                <NavbarMenuToggle className="sm:hidden" />
                <NavbarBrand>
                    <button
                        onClick={() => navigate('/')}
                        className="font-bold text-lg flex items-center gap-2 cursor-pointer"
                    >
                        <span className="text-2xl">📋</span>
                        <span className="gradient-text text-xl font-extrabold tracking-tight">
                            pastebin
                        </span>
                    </button>
                </NavbarBrand>
            </NavbarContent>

            <NavbarContent className="hidden sm:flex gap-6" justify="center">
                <NavbarItem isActive={isActive('/')}>
                    <Link
                        className="cursor-pointer text-sm"
                        color={isActive('/') ? 'primary' : 'foreground'}
                        onPress={() => navigate('/')}
                    >
                        Home
                    </Link>
                </NavbarItem>
                {isAuthenticated && (
                    <NavbarItem isActive={isActive('/new')}>
                        <Link
                            className="cursor-pointer text-sm"
                            color={isActive('/new') ? 'primary' : 'foreground'}
                            onPress={() => navigate('/new')}
                        >
                            New Paste
                        </Link>
                    </NavbarItem>
                )}
            </NavbarContent>

            <NavbarContent justify="end">
                {isAuthenticated ? (
                    <NavbarItem>
                        <Button color="danger" variant="flat" size="sm" onPress={handleLogout}>
                            Logout
                        </Button>
                    </NavbarItem>
                ) : (
                    <NavbarItem>
                        <Button
                            color="primary"
                            variant="shadow"
                            size="sm"
                            onPress={() => navigate('/login')}
                            className="font-medium"
                        >
                            Login
                        </Button>
                    </NavbarItem>
                )}
            </NavbarContent>

            {/* Mobile menu */}
            <NavbarMenu className="bg-background/95 backdrop-blur-xl pt-4">
                <NavbarMenuItem>
                    <Link
                        className="w-full cursor-pointer"
                        color={isActive('/') ? 'primary' : 'foreground'}
                        size="lg"
                        onPress={() => { navigate('/'); setIsMenuOpen(false); }}
                    >
                        Home
                    </Link>
                </NavbarMenuItem>
                {isAuthenticated && (
                    <NavbarMenuItem>
                        <Link
                            className="w-full cursor-pointer"
                            color={isActive('/new') ? 'primary' : 'foreground'}
                            size="lg"
                            onPress={() => { navigate('/new'); setIsMenuOpen(false); }}
                        >
                            New Paste
                        </Link>
                    </NavbarMenuItem>
                )}
            </NavbarMenu>
        </HeroNavbar>
    );
}
