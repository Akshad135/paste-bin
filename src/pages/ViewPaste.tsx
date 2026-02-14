import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { codeToHtml } from 'shiki';
import { api, type Paste } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getLanguageLabel, timeAgo } from '@/lib/constants';
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
    const navigate = useNavigate();

    const [paste, setPaste] = useState<Paste | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [highlightedHtml, setHighlightedHtml] = useState('');

    useEffect(() => {
        if (!slug) return;
        loadPaste();
    }, [slug]);

    useEffect(() => {
        if (!paste) return;
        highlightCode();
    }, [paste]);

    const loadPaste = async () => {
        setLoading(true);
        setError('');
        try {
            const { paste: data } = await api.paste.get(slug!);
            setPaste(data);
        } catch (err) {
            console.error('Failed to load paste:', err);
            setError(err instanceof Error ? err.message : 'Failed to load paste');
        } finally {
            setLoading(false);
        }
    };

    const highlightCode = async () => {
        if (!paste) return;
        const lang = LANG_MAP[paste.language] || paste.language;
        try {
            const html = await codeToHtml(paste.content, {
                lang,
                theme: 'github-dark-default',
            });
            setHighlightedHtml(html);
        } catch {
            // Fallback to plaintext
            try {
                const html = await codeToHtml(paste.content, {
                    lang: 'text',
                    theme: 'github-dark-default',
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

    // Loading state
    if (loading) {
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

    // Error state
    if (error || !paste) {
        return (
            <div className="mx-auto max-w-[90rem] px-4 sm:px-6 py-6">
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="rounded-full bg-destructive/10 p-4 mb-4">
                        <BadgeAlertIcon size={32} className="text-destructive" />
                    </div>
                    <h2 className="text-lg font-semibold">Paste not found</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {error || 'This paste may have been deleted or is private.'}
                    </p>
                    <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
                        <ArrowLeftIcon size={16} className="mr-1.5" />
                        Back to Home
                    </Button>
                </div>
            </div>
        );
    }

    const lineCount = paste.content.split('\n').length;

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
                    {isAuthenticated && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => navigate(`/edit/${paste.slug}`)}
                            title="Edit"
                        >
                            <SquarePenIcon size={16} />
                        </Button>
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
