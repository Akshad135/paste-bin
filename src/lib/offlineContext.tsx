import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface OfflineContextType {
    /** Browser reports no network */
    isOffline: boolean;
    /** Backend server is unreachable (but browser is "online") */
    backendDown: boolean;
    /** True when either the browser is offline OR the backend is unreachable */
    isEffectivelyOffline: boolean;
    /** Mark backend as down (called by api/auth on network errors while online) */
    setBackendDown: (down: boolean) => void;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [backendDown, setBackendDownState] = useState(false);

    useEffect(() => {
        const goOnline = () => setIsOffline(false);
        const goOffline = () => setIsOffline(true);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    const setBackendDown = useCallback((down: boolean) => setBackendDownState(down), []);

    const isEffectivelyOffline = isOffline || backendDown;

    return (
        <OfflineContext.Provider value={{
            isOffline,
            backendDown,
            isEffectivelyOffline,
            setBackendDown,
        }}>
            {children}
        </OfflineContext.Provider>
    );
}

export function useOffline() {
    const context = useContext(OfflineContext);
    if (!context) throw new Error('useOffline must be used within OfflineProvider');
    return context;
}
