import { useEffect, useState } from 'react';
import { api, type Paste } from '@/lib/api';
import { PasteCard } from '@/components/PasteCard';
import { useAuth } from '@/lib/auth';
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
    const navigate = useNavigate();

    useEffect(() => {
        loadPastes();
    }, [page, isAuthenticated]);

    // Reset to page 1 when auth state changes
    useEffect(() => {
        setPage(1);
    }, [isAuthenticated]);

    const loadPastes = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api.paste.list(page);
            if (page === 1) {
                setPastes(data.pastes);
            } else {
                setPastes((prev) => [...prev, ...data.pastes]);
            }
            setHasMore(data.hasMore);
        } catch (err) {
            console.error('Failed to load pastes:', err);
            setError(err instanceof Error ? err.message : 'Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    const handleVisibilityChange = (slug: string, newVisibility: 'public' | 'private') => {
        setPastes((prev) =>
            prev.map((p) => (p.slug === slug ? { ...p, visibility: newVisibility } : p))
        );
    };

    const handleDelete = (slug: string) => {
        setPastes((prev) => prev.filter((p) => p.slug !== slug));
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
                    <Button variant="outline" className="mt-4" onClick={loadPastes}>
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
                        style={{ gridAutoRows: 'calc((100vh - 7rem) / 3)' }}
                    >
                        {pastes.map((paste) => (
                            <PasteCard
                                key={paste.id}
                                paste={paste}
                                isAuthenticated={isAuthenticated}
                                onVisibilityChange={handleVisibilityChange}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>

                    {hasMore && (
                        <div className="flex justify-center mt-8">
                            <Button
                                variant="outline"
                                disabled={loading}
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
