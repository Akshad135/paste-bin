import { useEffect, useState, useRef } from 'react';
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
    const { markStale, clearStale, isOffline } = useOffline();
    const navigate = useNavigate();

    // Track whether we've done the initial load — avoid showing
    // the skeleton loader again when switching tabs or navigating back
    const hasLoadedOnce = useRef(false);

    // Reset to page 1 when auth state changes
    useEffect(() => {
        setPage(1);
        hasLoadedOnce.current = false;
    }, [isAuthenticated]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            // Only show full skeleton on very first load (no data yet)
            if (!hasLoadedOnce.current) {
                setLoading(true);
            }
            setError('');

            try {
                const result = await api.paste.list(page, 20, (freshResult) => {
                    if (cancelled) return;
                    // Background refresh callback — silently update UI
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

                // Initial result (possibly from cache)
                if (page === 1) {
                    setPastes(result.data.pastes);
                } else {
                    setPastes((prev) => [...prev, ...result.data.pastes]);
                }
                setHasMore(result.data.hasMore);

                if (result.fromCache) {
                    markStale();
                } else {
                    clearStale();
                }

                hasLoadedOnce.current = true;
            } catch (err) {
                if (cancelled) return;
                console.error('Failed to load pastes:', err);
                setError(err instanceof Error ? err.message : 'Failed to connect to server');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => { cancelled = true; };
    }, [page, isAuthenticated]);

    const handleRetry = () => {
        hasLoadedOnce.current = false;
        setError('');
        setLoading(true);
        // Force re-trigger by toggling page
        setPage(p => p);
        // Actually just directly call the load
        api.paste.list(page, 20).then(result => {
            setPastes(result.data.pastes);
            setHasMore(result.data.hasMore);
            if (result.fromCache) markStale(); else clearStale();
            hasLoadedOnce.current = true;
        }).catch(err => {
            setError(err instanceof Error ? err.message : 'Failed to connect to server');
        }).finally(() => {
            setLoading(false);
        });
    };

    const handleVisibilityChange = (slug: string, newVisibility: 'public' | 'private') => {
        setPastes((prev) =>
            prev.map((p) => (p.slug === slug ? { ...p, visibility: newVisibility } : p))
        );
    };

    const handleDelete = (slug: string) => {
        setPastes((prev) => prev.filter((p) => p.slug !== slug));
    };

    const handlePinChange = (slug: string, pinned: boolean) => {
        setPastes((prev) => {
            const updated = prev.map((p) => (p.slug === slug ? { ...p, pinned: pinned ? 1 : 0 } : p));
            // Re-sort: pinned first, then by created_at desc
            return updated.sort((a, b) => {
                if (a.pinned !== b.pinned) return b.pinned - a.pinned;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
        });
    };

    return (
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 py-4">
            {/* Content */}
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
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="rounded-full bg-destructive/10 p-4 mb-4">
                        <BadgeAlertIcon size={32} className="text-destructive" />
                    </div>
                    <h2 className="text-lg font-semibold">Connection Error</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        {error}. Make sure the API server is running.
                    </p>
                    <Button variant="outline" className="mt-4" onClick={handleRetry}>
                        <RefreshCWIcon size={16} className="mr-1.5" />
                        Retry
                    </Button>
                </div>
            ) : pastes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="rounded-full bg-primary/10 p-4 mb-4">
                        <FileCode2 className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold">No pastes yet</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {isAuthenticated
                            ? 'Create your first paste to get started!'
                            : 'No public pastes available. Login to create one.'}
                    </p>
                    {isAuthenticated && (
                        <Button className="mt-4" onClick={() => navigate('/new')}>
                            <PlusIcon size={16} className="mr-1.5" />
                            Create a Paste
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    <div
                        className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
                        style={{ gridAutoRows: 'calc((100vh - 7rem - 1px) / 3)' }}
                    >
                        {pastes.map((paste) => (
                            <PasteCard
                                key={paste.id}
                                paste={paste}
                                isAuthenticated={isAuthenticated && !isOffline}
                                onVisibilityChange={handleVisibilityChange}
                                onPinChange={handlePinChange}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>

                    {hasMore && (
                        <div className="flex justify-center mt-8">
                            <Button
                                variant="outline"
                                disabled={loading || isOffline}
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
