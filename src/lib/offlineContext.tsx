import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface OfflineContextType {
    /** Browser reports no network */
    isOffline: boolean;
    /** Currently showing data from cache instead of fresh server data */
    isStaleData: boolean;
    /** Mark that we're showing stale/cached data */
    markStale: () => void;
    /** Clear the stale flag (e.g., after a successful fresh fetch) */
    clearStale: () => void;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isStaleData, setIsStaleData] = useState(false);

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

    // When coming back online, clear stale flag (fresh fetches will happen)
    useEffect(() => {
        if (!isOffline) setIsStaleData(false);
    }, [isOffline]);

    const markStale = useCallback(() => setIsStaleData(true), []);
    const clearStale = useCallback(() => setIsStaleData(false), []);

    return (
        <OfflineContext.Provider value={{ isOffline, isStaleData, markStale, clearStale }}>
            {children}
        </OfflineContext.Provider>
    );
}

export function useOffline() {
    const context = useContext(OfflineContext);
    if (!context) throw new Error('useOffline must be used within OfflineProvider');
    return context;
}
