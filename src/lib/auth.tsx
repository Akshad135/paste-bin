import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from './api';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (passphrase: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        try {
            const { authenticated } = await api.auth.check();
            setIsAuthenticated(authenticated);
        } catch {
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const login = async (passphrase: string) => {
        await api.auth.login(passphrase);
        setIsAuthenticated(true);
    };

    const logout = async () => {
        await api.auth.logout();
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
