import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { codeToHtml } from 'shiki';
import { api, type Paste } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOffline } from '@/lib/offlineContext';
import { useTheme } from '@/components/ThemeProvider';
import { getLanguageLabel, timeAgo, isExpired } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyIcon } from '@/components/ui/animated-copy';
import { LinkIcon } from '@/components/ui/animated-link';
import { FileTextIcon } from '@/components/ui/animated-file-text';
import { DownloadIcon } from '@/components/ui/animated-download';
import { SquarePenIcon } from '@/components/ui/animated-square-pen';
import { ArrowLeftIcon } from '@/components/ui/animated-arrow-left';
import { ClockIcon } from '@/components/ui/animated-clock';
import { BadgeAlertIcon } from '@/components/ui/animated-badge-alert';
import { PinIcon } from '@/components/ui/animated-pin';
import { HourglassIcon } from '@/components/ui/animated-hourglass';
import { ExpirationTimer } from '@/components/ExpirationTimer';
import { toast } from 'sonner';

// Map language values to shiki identifiers
const LANG_MAP: Record<string, string> = {
    plaintext: 'text',
    shellscript: 'shellscript',
    cpp: 'cpp',
    csharp: 'csharp',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    proto: 'protobuf',
    terraform: 'hcl',
    jsx: 'jsx',
    tsx: 'tsx',
    vue: 'vue',
    svelte: 'svelte',
    astro: 'astro',
    nginx: 'nginx',
};

// Map language values to file extensions
const EXT_MAP: Record<string, string> = {
    plaintext: 'md', javascript: 'js', typescript: 'ts', python: 'py',
    rust: 'rs', go: 'go', java: 'java', c: 'c', cpp: 'cpp', csharp: 'cs',
    ruby: 'rb', php: 'php', swift: 'swift', kotlin: 'kt', scala: 'scala',
    r: 'r', perl: 'pl', lua: 'lua', shellscript: 'sh', powershell: 'ps1',
    sql: 'sql', html: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', yaml: 'yaml', toml: 'toml', xml: 'xml', markdown: 'md',
    latex: 'tex', dockerfile: 'Dockerfile', makefile: 'Makefile',
    graphql: 'graphql', proto: 'proto', terraform: 'tf',
    jsx: 'jsx', tsx: 'tsx', vue: 'vue', svelte: 'svelte', astro: 'astro',
    nginx: 'conf', zig: 'zig', elixir: 'ex', clojure: 'clj',
    haskell: 'hs', ocaml: 'ml', dart: 'dart',
};

export function ViewPaste() {
    const { slug } = useParams<{ slug: string }>();
    const { isAuthenticated } = useAuth();
    const { isOffline, markStale, clearStale, setBackendDown } = useOffline();
    const { mode } = useTheme();
    const navigate = useNavigate();

    const [paste, setPaste] = useState<Paste | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [highlightedHtml, setHighlightedHtml] = useState('');
    const [loadTrigger, setLoadTrigger] = useState(0);

    const hasLoadedOnce = useRef(false);

    // When coming back online, trigger a refresh
    useEffect(() => {
        const handleOnline = () => setLoadTrigger(t => t + 1);
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    // SSE: auto-refresh or navigate away when paste is changed/deleted
    useEffect(() => {
        if (!slug) return;
        const unsubscribe = api.events.subscribe((event) => {
            if (event.slug === slug) {
                if (event.type === 'paste_deleted') {
                    setPaste(null);
                    setError('This paste has been deleted.');
                    setLoading(false);
                } else {
                    // paste_updated — reload
                    setLoadTrigger(t => t + 1);
                }
            }
        });
        return unsubscribe;
    }, [slug]);

    // Main data load effect
    useEffect(() => {
        if (!slug) return;
        let cancelled = false;

        // Reset state for new slug
        setHighlightedHtml('');
        setPaste(null);

        const load = async () => {
            if (!hasLoadedOnce.current) {
                setLoading(true);
            }
            setError('');
            try {
                const result = await api.paste.get(slug, (freshResult) => {
                    if (cancelled) return;
                    setPaste(freshResult.data.paste);
                    clearStale();
                });

                if (cancelled) return;

                setPaste(result.data.paste);

                if (result.fromCache) {
                    markStale();
                } else {
                    clearStale();
                    setBackendDown(false);
                }
                hasLoadedOnce.current = true;
            } catch (err) {
                if (cancelled) return;
                console.warn('[pastebin] Could not load paste:', err instanceof Error ? err.message : err);
                setError(err instanceof Error ? err.message : 'Failed to load paste');
                if (navigator.onLine) setBackendDown(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [slug, loadTrigger]);

    useEffect(() => {
        if (!paste) return;
        highlightCode();
    }, [paste, mode]);

    const highlightCode = async () => {
        if (!paste) return;
        const lang = LANG_MAP[paste.language] || paste.language;
        try {
            const html = await codeToHtml(paste.content, {
                lang,
                theme: mode === 'dark' ? 'github-dark-default' : 'github-light-default',
            });
            setHighlightedHtml(html);
        } catch {
            // Fallback to plaintext
            try {
                const html = await codeToHtml(paste.content, {
                    lang: 'text',
                    theme: mode === 'dark' ? 'github-dark-default' : 'github-light-default',
                });
                setHighlightedHtml(html);
            } catch {
                // Give up
            }
        }
    };

    const copyContent = async () => {
        if (!paste) return;
        await navigator.clipboard.writeText(paste.content);
        toast.success('Copied to clipboard!');
    };

    const shareLink = async () => {
        const url = `${window.location.origin}/paste/${slug}`;
        await navigator.clipboard.writeText(url);
        toast.success('Link copied!');
    };

    const downloadPaste = () => {
        if (!paste) return;
        const ext = EXT_MAP[paste.language] || paste.language;
        const filename = `${paste.title || paste.slug}.${ext}`;
        const blob = new Blob([paste.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Download started!');
    };

    const viewRaw = () => {
        if (!paste) return;
        const blob = new Blob([paste.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    const togglePin = async () => {
        if (!paste || isOffline) return;
        const newPinned = !paste.pinned;
        try {
            await api.paste.pin(paste.slug, newPinned);
            setPaste({ ...paste, pinned: newPinned ? 1 : 0 });
            toast.success(newPinned ? 'Paste pinned' : 'Paste unpinned');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update pin status';
            toast.error(message);
        }
    };

    // Loading state — only show skeleton if we have no data yet
    if (loading && !paste) {
        return (
            <div className="mx-auto max-w-[90rem] px-4 sm:px-6 py-6">
                <div className="flex items-center gap-3 mb-6">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-7 w-64" />
                    <div className="ml-auto flex gap-2">
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                    </div>
                </div>
                <Skeleton className="h-[calc(100vh-12rem)] w-full rounded-lg" />
            </div>
        );
    }

    // Error / expired state — only show after loading is complete
    if (!loading && (error || !paste)) {
        const expired = error?.toLowerCase().includes('expired');
        return (
            <div className="mx-auto max-w-[90rem] px-4 sm:px-6 py-6">
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className={cn('rounded-full p-4 mb-4', expired ? 'bg-amber-500/10' : 'bg-destructive/10')}>
                        {expired ? (
                            <HourglassIcon size={32} className="text-amber-500" />
                        ) : (
                            <BadgeAlertIcon size={32} className="text-destructive" />
                        )}
                    </div>
                    <h2 className="text-lg font-semibold">{expired ? 'Paste expired' : 'Paste not found'}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {expired ? 'This paste has expired and is no longer available.' : (error || 'This paste may have been deleted or is private.')}
                    </p>
                    <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
                        <ArrowLeftIcon size={16} className="mr-1.5" />
                        Back to Home
                    </Button>
                </div>
            </div>
        );
    }

    // Still loading or no paste data yet (shouldn't reach here, but satisfy TS)
    if (!paste) return null;

    const lineCount = paste.content.split('\n').length;
    const canEdit = isAuthenticated && !isOffline;

    return (
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 py-4 flex flex-col h-full box-border">
            {/* Header bar */}
            <div className="flex items-center gap-3 mb-3 shrink-0">
                {/* Back button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => navigate('/')}
                >
                    <ArrowLeftIcon size={18} />
                </Button>

                {/* Title + metadata */}
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-semibold truncate">
                        {paste.title || paste.slug}
                    </h1>
                </div>

                {/* Metadata badges */}
                <div className="hidden sm:flex items-center gap-2">
                    <Badge variant="default" className="text-[11px] px-2 py-0.5">
                        {getLanguageLabel(paste.language)}
                    </Badge>
                    <Badge
                        variant={paste.visibility === 'public' ? 'secondary' : 'outline'}
                        className="text-[11px] px-2 py-0.5"
                    >
                        {paste.visibility}
                    </Badge>
                    {paste.pinned === 1 && (
                        <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-primary/50 text-primary bg-primary/5 gap-1">
                            <PinIcon size={12} className="rotate-45" /> Pinned
                        </Badge>
                    )}
                    {paste.expires_at && !isExpired(paste.expires_at) && (
                        <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-amber-500/50 text-amber-500 bg-amber-500/5 gap-1">
                            <HourglassIcon size={12} />
                            <ExpirationTimer
                                expiresAt={paste.expires_at}
                                onExpire={() => {
                                    toast.error('Paste expired');
                                    navigate('/');
                                }}
                            />
                        </Badge>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <ClockIcon size={12} />
                        {timeAgo(paste.created_at)}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                        {paste.slug}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {lineCount} {lineCount === 1 ? 'line' : 'lines'}
                    </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={copyContent}
                        title="Copy content"
                    >
                        <CopyIcon size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={shareLink}
                        title="Copy share link"
                    >
                        <LinkIcon size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={viewRaw}
                        title="View raw"
                    >
                        <FileTextIcon size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={downloadPaste}
                        title="Download"
                    >
                        <DownloadIcon size={16} />
                    </Button>
                    {canEdit && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-8 w-8 text-muted-foreground hover:text-foreground",
                                    paste.pinned && "text-primary hover:text-primary"
                                )}
                                onClick={togglePin}
                                title={paste.pinned ? "Unpin" : "Pin"}
                            >
                                <PinIcon size={16} className={cn(paste.pinned && "fill-current rotate-45")} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => navigate(`/edit/${paste.slug}`)}
                                title="Edit"
                            >
                                <SquarePenIcon size={16} />
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile metadata (hidden on sm+) */}
            <div className="flex sm:hidden items-center gap-2 mb-3 flex-wrap">
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                    {getLanguageLabel(paste.language)}
                </Badge>
                <Badge
                    variant={paste.visibility === 'public' ? 'secondary' : 'outline'}
                    className="text-[10px] px-1.5 py-0"
                >
                    {paste.visibility}
                </Badge>
                {paste.expires_at && !isExpired(paste.expires_at) && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-500 bg-amber-500/5 gap-1">
                        <HourglassIcon size={10} />
                        <ExpirationTimer
                            expiresAt={paste.expires_at}
                            onExpire={() => {
                                toast.error('Paste expired');
                                navigate('/');
                            }}
                        />
                    </Badge>
                )}
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ClockIcon size={10} />
                    {timeAgo(paste.created_at)}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                    {paste.slug}
                </span>
            </div>

            {/* Code view */}
            <div className="flex-1 min-h-0 rounded-lg border border-border/60 overflow-auto code-view-full">
                {highlightedHtml ? (
                    <div className="min-h-full" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                ) : (
                    <pre className="text-sm font-mono leading-relaxed p-5 text-foreground/80 min-h-full">
                        <code>{paste.content}</code>
                    </pre>
                )}
            </div>
        </div>
    );
}
