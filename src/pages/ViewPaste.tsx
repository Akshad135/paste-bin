import { useEffect, useState, useRef } from 'react';
import {
    Button,
    Chip,
    Spinner,
    addToast,
    Tooltip,
    Card,
    CardBody,
} from '@heroui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type Paste } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getLanguageLabel, timeAgo } from '@/lib/constants';
import { codeToHtml } from 'shiki';

export function ViewPaste() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [paste, setPaste] = useState<Paste | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [highlightedHtml, setHighlightedHtml] = useState('');
    const [showRaw, setShowRaw] = useState(false);
    const codeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!slug) return;
        loadPaste();
    }, [slug]);

    useEffect(() => {
        if (paste && !showRaw) {
            highlightCode();
        }
    }, [paste, showRaw]);

    const loadPaste = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api.paste.get(slug!);
            setPaste(data.paste);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load paste');
        } finally {
            setLoading(false);
        }
    };

    const highlightCode = async () => {
        if (!paste) return;
        try {
            const html = await codeToHtml(paste.content, {
                lang: paste.language || 'plaintext',
                theme: 'github-dark-default',
            });
            setHighlightedHtml(html);
        } catch {
            // Fallback: if language isn't supported, use plaintext
            try {
                const html = await codeToHtml(paste.content, {
                    lang: 'plaintext',
                    theme: 'github-dark-default',
                });
                setHighlightedHtml(html);
            } catch {
                setHighlightedHtml('');
            }
        }
    };

    const copyToClipboard = async () => {
        if (!paste) return;
        await navigator.clipboard.writeText(paste.content);
        addToast({ title: 'Copied to clipboard!', color: 'success' });
    };

    const copyUrl = async () => {
        await navigator.clipboard.writeText(window.location.href);
        addToast({ title: 'URL copied!', color: 'success' });
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Spinner size="lg" color="primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-20">
                <div className="empty-state">
                    <span className="text-5xl mb-4">
                        {error.includes('private') ? '🔒' : '😕'}
                    </span>
                    <h2 className="text-xl font-semibold text-default-600">
                        {error.includes('private') ? 'Private Paste' : 'Not Found'}
                    </h2>
                    <p className="text-default-400 mt-2">{error}</p>
                    <Button className="mt-4" variant="flat" onPress={() => navigate('/')}>
                        Go Home
                    </Button>
                </div>
            </div>
        );
    }

    if (!paste) return null;

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold truncate">
                        {paste.title || paste.slug}
                    </h1>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Chip size="sm" variant="flat" color="primary">
                            {getLanguageLabel(paste.language)}
                        </Chip>
                        <Chip
                            size="sm"
                            variant="flat"
                            color={paste.visibility === 'public' ? 'success' : 'warning'}
                        >
                            {paste.visibility === 'public' ? '🌍 Public' : '🔒 Private'}
                        </Chip>
                        <span className="text-xs text-default-400">
                            {timeAgo(paste.created_at)}
                        </span>
                    </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                    <Tooltip content="Copy code">
                        <Button size="sm" variant="flat" onPress={copyToClipboard}>
                            📋 Copy
                        </Button>
                    </Tooltip>
                    <Tooltip content="Copy URL">
                        <Button size="sm" variant="flat" onPress={copyUrl}>
                            🔗 Share
                        </Button>
                    </Tooltip>
                    <Button
                        size="sm"
                        variant="flat"
                        onPress={() => setShowRaw(!showRaw)}
                    >
                        {showRaw ? '🎨 Highlight' : '📝 Raw'}
                    </Button>
                    {isAuthenticated && (
                        <Button
                            size="sm"
                            variant="flat"
                            color="danger"
                            onPress={async () => {
                                try {
                                    await api.paste.delete(paste.slug);
                                    addToast({ title: 'Paste deleted', color: 'success' });
                                    navigate('/');
                                } catch {
                                    addToast({ title: 'Failed to delete', color: 'danger' });
                                }
                            }}
                        >
                            🗑️ Delete
                        </Button>
                    )}
                </div>
            </div>

            {/* Code block */}
            <Card className="border border-divider overflow-hidden">
                <CardBody className="p-0">
                    {showRaw ? (
                        <pre className="p-4 font-mono text-sm leading-relaxed overflow-x-auto whitespace-pre">
                            {paste.content}
                        </pre>
                    ) : highlightedHtml ? (
                        <div
                            ref={codeRef}
                            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                            className="overflow-x-auto"
                        />
                    ) : (
                        <pre className="p-4 font-mono text-sm leading-relaxed overflow-x-auto whitespace-pre">
                            {paste.content}
                        </pre>
                    )}
                </CardBody>
            </Card>

            {/* Slug footer */}
            <div className="mt-4 text-center">
                <span className="text-xs text-default-400 font-mono">{paste.slug}</span>
            </div>
        </div>
    );
}
