import { useEffect, useState, useRef, useCallback } from 'react';
import { api, type Paste } from '@/lib/api';
import { PasteCard } from '@/components/PasteCard';
import { useAuth } from '@/lib/auth';
import { useOffline } from '@/lib/offlineContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileCode2 } from 'lucide-react';
import { PlusIcon } from '@/components/ui/animated-plus';
import { RefreshCWIcon } from '@/components/ui/animated-refresh-cw';
import { BadgeAlertIcon } from '@/components/ui/animated-badge-alert';

export function Home() {
    const [pastes, setPastes] = useState<Paste[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState('');
    const { isAuthenticated } = useAuth();
    const { markStale, clearStale, isOffline, isEffectivelyOffline, setBackendDown } = useOffline();
    const navigate = useNavigate();

    const hasLoadedOnce = useRef(false);
    // A counter we bump whenever we want to trigger a fresh load
    const [loadTrigger, setLoadTrigger] = useState(0);

    // Reset to page 1 when auth changes
    useEffect(() => {
        setPage(1);
        hasLoadedOnce.current = false;
        setLoadTrigger(t => t + 1);
    }, [isAuthenticated]);

    // When coming back online, trigger a refresh
    useEffect(() => {
        const handleOnline = () => setLoadTrigger(t => t + 1);
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    // SSE: auto-refresh when pastes change on another device
    useEffect(() => {
        const unsubscribe = api.events.subscribe(() => {
            setLoadTrigger(t => t + 1);
        });
        return unsubscribe;
    }, []);

    // Main data load effect
    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!hasLoadedOnce.current) {
                setLoading(true);
            }
            setError('');

            if (!isAuthenticated) {
                setLoading(false);
                return;
            }

            try {
                const result = await api.paste.list(page, 20, (freshResult) => {
                    if (cancelled) return;
                    if (page === 1) {
                        setPastes(freshResult.data.pastes);
                    } else {
                        setPastes((prev) => {
                            const existing = new Set(prev.slice(0, (page - 1) * 20).map(p => p.slug));
                            const newPastes = freshResult.data.pastes.filter(p => !existing.has(p.slug));
                            return [...prev.slice(0, (page - 1) * 20), ...newPastes];
                        });
                    }
                    setHasMore(freshResult.data.hasMore);
                    clearStale();
                });

                if (cancelled) return;

                if (page === 1) {
                    setPastes(result.data.pastes);
                } else {
                    // Use the same deduplication logic as the background
                    // freshResult callback — never blindly append, always
                    // replace the current page's slice in case a loadTrigger
                    // fires while page > 1 (SSE, online event, auth change).
                    setPastes((prev) => {
                        const existing = new Set(prev.slice(0, (page - 1) * 20).map(p => p.slug));
                        const newPastes = result.data.pastes.filter(p => !existing.has(p.slug));
                        return [...prev.slice(0, (page - 1) * 20), ...newPastes];
                    });
                }
                setHasMore(result.data.hasMore);

                if (result.fromCache) {
                    markStale();
                } else {
                    clearStale();
                    setBackendDown(false);
                }
                hasLoadedOnce.current = true;
            } catch (err) {
                if (cancelled) return;
                console.warn('[pastebin] Could not load pastes:', err instanceof Error ? err.message : err);
                setError(err instanceof Error ? err.message : 'Failed to connect to server');
                if (navigator.onLine && (err as Error).name !== 'HttpError') setBackendDown(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [page, loadTrigger, markStale, clearStale]);

    const handleRetry = useCallback(() => {
        hasLoadedOnce.current = false;
        setLoadTrigger(t => t + 1);
    }, []);



    const handleDelete = (slug: string) => {
        setPastes((prev) => prev.filter((p) => p.slug !== slug));
    };

    const handlePinChange = (slug: string, pinned: boolean) => {
        setPastes((prev) => {
            const updated = prev.map((p) => (p.slug === slug ? { ...p, pinned: pinned ? 1 : 0 } : p));
            return updated.sort((a, b) => {
                if (a.pinned !== b.pinned) return b.pinned - a.pinned;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
        });
    };

    return (
        <div className="mx-auto max-w-[90rem] w-full px-4 sm:px-6 py-4 h-full flex flex-col">
            {loading && pastes.length === 0 ? (
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="rounded-lg border border-border/60 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-5 w-5 rounded" />
                            </div>
                            <Skeleton className="h-20 w-full rounded-md" />
                            <div className="flex justify-between">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : !isAuthenticated ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
                    <div className="rounded-full bg-primary/10 p-5 mb-6">
                        <FileCode2 className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">It's a secret to everybody.</h2>
                    <div className="text-base text-muted-foreground mt-3 space-y-1.5">
                        <p>The server has no idea what you're looking for (and prefers it that way).</p>
                        <p>Log in to access your secure vault, or paste a share link in your address bar!</p>
                    </div>
                    <Button className="mt-8 px-8" onClick={() => window.dispatchEvent(new Event('open-login'))}>
                        Login to Vault
                    </Button>
                </div>
            ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
                    <div className="rounded-full bg-destructive/10 p-4 mb-4">
                        <BadgeAlertIcon size={32} className="text-destructive" />
                    </div>
                    <h2 className="text-lg font-semibold">Connection Error</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        {isOffline
                            ? 'You are offline and no cached data is available. Connect to the internet and try again.'
                            : `${error}. Make sure the API server is running.`
                        }
                    </p>
                    <Button variant="outline" className="mt-4" onClick={handleRetry}>
                        <RefreshCWIcon size={16} className="mr-1.5" />
                        Retry
                    </Button>
                </div>
            ) : pastes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
                    <div className="rounded-full bg-primary/10 p-4 mb-4">
                        <FileCode2 className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold">No pastes yet</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Create your first paste to get started!
                    </p>
                    <Button className="mt-4" onClick={() => navigate('/new')}>
                            <PlusIcon size={16} className="mr-1.5" />
                            Create a Paste
                    </Button>
                </div>
            ) : (
                <>
                    <div
                        className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
                        style={{ gridAutoRows: 'calc((100dvh - 7rem - 1px) / 3)' }}
                    >
                        {pastes.map((paste) => (
                            <PasteCard
                                key={paste.id}
                                paste={paste}
                                isAuthenticated={isAuthenticated && !isEffectivelyOffline}
                                onPinChange={handlePinChange}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>

                    {hasMore && (
                        <div className="flex justify-center mt-8">
                            <Button
                                variant="outline"
                                disabled={loading || isEffectivelyOffline}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                {loading ? (
                                    <RefreshCWIcon size={16} className="mr-1.5 animate-spin" />
                                ) : null}
                                Load More
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
