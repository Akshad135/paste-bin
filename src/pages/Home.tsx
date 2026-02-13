import { useEffect, useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { api, type Paste } from '@/lib/api';
import { PasteCard } from '@/components/PasteCard';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';

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
    }, [page]);

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
            prev.map((p) =>
                p.slug === slug ? { ...p, visibility: newVisibility } : p
            )
        );
    };

    const handleDelete = (slug: string) => {
        setPastes((prev) => prev.filter((p) => p.slug !== slug));
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">
                        Recent Pastes
                    </h1>
                    <p className="text-default-500 mt-1">
                        {isAuthenticated ? 'All your pastes' : 'Public pastes'}
                    </p>
                </div>
                {isAuthenticated && (
                    <Button
                        color="primary"
                        variant="shadow"
                        onPress={() => navigate('/new')}
                    >
                        + New Paste
                    </Button>
                )}
            </div>

            {loading && pastes.length === 0 ? (
                <div className="flex justify-center py-20">
                    <Spinner size="lg" color="primary" />
                </div>
            ) : error ? (
                <div className="empty-state">
                    <span className="text-5xl mb-4">!</span>
                    <h2 className="text-xl font-semibold text-default-600">Connection Error</h2>
                    <p className="text-default-400 mt-2 max-w-md">
                        {error}. Make sure the API server is running.
                    </p>
                    <Button className="mt-4" color="primary" variant="flat" onPress={loadPastes}>
                        Retry
                    </Button>
                </div>
            ) : pastes.length === 0 ? (
                <div className="empty-state">
                    <span className="text-5xl mb-4">-</span>
                    <h2 className="text-xl font-semibold text-default-600">No pastes yet</h2>
                    <p className="text-default-400 mt-2">
                        {isAuthenticated
                            ? 'Create your first paste to get started!'
                            : 'No public pastes available. Login to create one.'}
                    </p>
                    {isAuthenticated && (
                        <Button
                            className="mt-4"
                            color="primary"
                            variant="flat"
                            onPress={() => navigate('/new')}
                        >
                            Create a Paste
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid gap-3">
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
                                variant="flat"
                                isLoading={loading}
                                onPress={() => setPage((p) => p + 1)}
                            >
                                Load More
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
