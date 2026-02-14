import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from './api';
import { useOffline } from './offlineContext';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (passphrase: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function AuthProviderInner({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { isOffline, setBackendDown } = useOffline();

    const checkAuth = useCallback(async () => {
        // Don't hit the network if offline
        if (!navigator.onLine) {
            setIsAuthenticated(false);
            setIsLoading(false);
            return;
        }

        try {
            const { authenticated } = await api.auth.check();
            setIsAuthenticated(authenticated);
            setBackendDown(false); // API responded — backend is up
        } catch {
            setIsAuthenticated(false);
            // If we're "online" but the request failed, backend is probably down
            if (navigator.onLine) {
                setBackendDown(true);
            }
        } finally {
            setIsLoading(false);
        }
    }, [setBackendDown]);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Re-check auth when coming back online
    useEffect(() => {
        if (!isOffline) {
            checkAuth();
        }
    }, [isOffline, checkAuth]);

    const login = async (passphrase: string) => {
        await api.auth.login(passphrase);
        setIsAuthenticated(true);
        setBackendDown(false);
    };

    const logout = async () => {
        // If offline, just clear local state
        if (!navigator.onLine) {
            setIsAuthenticated(false);
            return;
        }
        try {
            await api.auth.logout();
        } catch {
            // Logout failed — still clear local state
        }
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * AuthProvider must be rendered inside OfflineProvider so it can access
 * setBackendDown. This wrapper just re-exports under the old name.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    return <AuthProviderInner>{children}</AuthProviderInner>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
