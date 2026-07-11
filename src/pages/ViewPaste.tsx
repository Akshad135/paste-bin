import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { codeToHtml } from 'shiki';
import { api, type Paste, type FileEntry } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { unwrapPasteKey, decryptText, decryptBytes, unwrapPasteKeyFromShare, deriveShareSecrets } from '@/lib/crypto';
import { SharePasteDialog } from '@/components/SharePasteDialog';
import { LockIcon } from '@/components/ui/animated-lock';
import { useOffline } from '@/lib/offlineContext';
import { useTheme } from '@/components/ThemeProvider';
import { getLanguageLabel, timeAgo, isExpired } from '@/lib/constants';
import { cn, truncateFileName } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyIcon } from '@/components/ui/animated-copy';
import { LinkIcon } from '@/components/ui/animated-link';
import { ShareIcon } from '@/components/ui/animated-share';
import { FileTextIcon } from '@/components/ui/animated-file-text';
import { DownloadIcon } from '@/components/ui/animated-download';
import { SquarePenIcon } from '@/components/ui/animated-square-pen';
import { ArrowLeftIcon } from '@/components/ui/animated-arrow-left';
import { ClockIcon } from '@/components/ui/animated-clock';

import { PinIcon } from '@/components/ui/animated-pin';
import { HourglassIcon } from '@/components/ui/animated-hourglass';
import { DeleteIcon } from '@/components/ui/animated-delete';
import { ErrorState } from '@/components/ErrorState';
import { ExpirationTimer } from '@/components/ExpirationTimer';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
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

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function isImageMime(mime: string | null): boolean {
    return !!mime && mime.startsWith('image/');
}

export function ViewPaste() {
    const { slug } = useParams<{ slug: string }>();
    const { isAuthenticated, masterKey } = useAuth();
    const { isOffline, markStale, clearStale, setBackendDown } = useOffline();
    const { mode } = useTheme();
    const navigate = useNavigate();

    const [paste, setPaste] = useState<Paste | null>(null);
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [highlightedHtml, setHighlightedHtml] = useState('');
    const [loadTrigger, setLoadTrigger] = useState(0);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
    
    // Guest unlock state
    const [guestPassword, setGuestPassword] = useState('');
    const [guestPasswordError, setGuestPasswordError] = useState('');
    const [guestUnlocking, setGuestUnlocking] = useState(false);

    // Share state
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [needsPassword, setNeedsPassword] = useState(false);
    const [rawPasteData, setRawPasteData] = useState<{ paste: Paste; files: FileEntry[] } | null>(null);

    const pasteKeyRef = useRef<CryptoKey | null>(null);
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
                    setFiles([]);
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

    // Decrypt paste data using a paste key
    const decryptPasteData = async (rawPaste: Paste, rawFiles: FileEntry[], pasteKey: CryptoKey) => {
        pasteKeyRef.current = pasteKey;

        const title = rawPaste.title ? await decryptText(pasteKey, rawPaste.title) : '';
        const content = rawPaste.content ? await decryptText(pasteKey, rawPaste.content) : '';
        
        const decryptedFiles = await Promise.all(rawFiles.map(async f => ({
            ...f,
            file_name: await decryptText(pasteKey, f.file_name),
            mime_type: await decryptText(pasteKey, f.mime_type),
        })));

        return { paste: { ...rawPaste, title, content }, files: decryptedFiles };
    };

    // Main data load effect
    useEffect(() => {
        if (!slug) return;
        let cancelled = false;

        // Reset state for new slug
        setHighlightedHtml('');
        setPaste(null);
        setFiles([]);
        setNeedsPassword(false);
        setRawPasteData(null);

        const load = async () => {
            if (!hasLoadedOnce.current) {
                setLoading(true);
            }
            setError('');
            try {
                const result = await api.paste.get(slug, async (freshResult) => {
                    if (cancelled) return;
                    // Background refresh for authenticated users
                    if (isAuthenticated && masterKey && freshResult.data.paste.encrypted_paste_key) {
                        try {
                            const pasteKey = await unwrapPasteKey(masterKey, freshResult.data.paste.encrypted_paste_key);
                            const dec = await decryptPasteData(freshResult.data.paste, freshResult.data.files || [], pasteKey);
                            setPaste(dec.paste);
                            setFiles(dec.files);
                            clearStale();
                        } catch (e) {
                            console.error('Failed to decrypt fresh paste data', e);
                        }
                    }
                });

                if (cancelled) return;

                const rawPaste = result.data.paste;
                const rawFiles = result.data.files || [];

                if (isAuthenticated && masterKey && rawPaste.encrypted_paste_key) {
                    // Owner flow: unwrap with master key
                    const pasteKey = await unwrapPasteKey(masterKey, rawPaste.encrypted_paste_key);
                    const dec = await decryptPasteData(rawPaste, rawFiles, pasteKey);
                    setPaste(dec.paste);
                    setFiles(dec.files);
                } else if (!isAuthenticated && (result.data as any).is_shared) {
                    // Guest flow: paste is shared — show PIN prompt.
                    // shared_encrypted_key is intentionally absent from the GET response;
                    // the client must call POST /unlock (rate-limited) to retrieve it.
                    setRawPasteData({ paste: rawPaste, files: rawFiles });
                    setNeedsPassword(true);
                } else {
                    throw new Error('Cannot decrypt paste');
                }

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
    // isAuthenticated and masterKey are intentionally included: if the user
    // logs in via a modal while the page is open (e.g. private paste while
    // logged out), the load must re-run to decrypt with the newly available key.
    }, [slug, loadTrigger, isAuthenticated, masterKey]);

    useEffect(() => {
        if (!pasteKeyRef.current || files.length === 0) return;
        
        let cancelled = false;
        files.filter(f => isImageMime(f.mime_type)).forEach(async (file) => {
            if (imageUrls[file.slug]) return;
            try {
                const res = await fetch(api.file.getFileUrl(file.slug));
                if (!res.ok) throw new Error("Failed to fetch image");
                const encBuf = await res.arrayBuffer();
                const decBuf = await decryptBytes(pasteKeyRef.current!, encBuf);
                const blob = new Blob([decBuf], { type: file.mime_type });
                if (!cancelled) {
                    setImageUrls(prev => ({ ...prev, [file.slug]: URL.createObjectURL(blob) }));
                }
            } catch (e) {
                console.error("Failed to decrypt image preview", e);
            }
        });
        return () => { cancelled = true; };
    }, [files]);

    useEffect(() => {
        if (!paste || !paste.content) return;
        highlightCode();
    }, [paste, mode]);

    const highlightCode = async () => {
        if (!paste || !paste.content) return;
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

    const copyLink = async () => {
        const url = `${window.location.origin}/paste/${slug}`;
        await navigator.clipboard.writeText(url);
        toast.success('Link copied!');
    };

    const handleRevoke = async () => {
        if (!paste) return;
        try {
            await api.paste.revoke(paste.slug);
            setPaste({ ...paste, shared_encrypted_key: null });
            toast.success('Share access revoked');
        } catch {
            toast.error('Failed to revoke share');
        }
    };

    const handleGuestUnlock = async (overridePassword?: any) => {
        const code = typeof overridePassword === 'string' ? overridePassword : guestPassword;
        if (!slug || !rawPasteData || code.length < 8) return;
        setGuestUnlocking(true);
        setGuestPasswordError('');
        try {
            // Step 1: Derive the two secrets from the access code locally.
            // The plaintext code never leaves the browser.
            const { unlockKey, authSecret } = await deriveShareSecrets(code, slug);

            // Step 2: Send authSecret to the server. The server verifies it
            // against the stored slow hash and returns the encrypted payload.
            let unlockResult: { share_wrapped_paste_key: string; paste: any; files: any[] };
            try {
                unlockResult = await api.paste.unlock(slug, authSecret);
            } catch (e: any) {
                if (e.message === 'TOO_MANY_ATTEMPTS') {
                    setGuestPasswordError('Too many attempts. Please wait an hour before trying again.');
                } else if (e.message && e.message.toLowerCase().includes('incorrect')) {
                    setGuestPasswordError('Incorrect access code. Please try again.');
                } else {
                    setGuestPasswordError('Could not reach server. Please try again.');
                }
                return;
            }

            // Step 3: Use unlockKey to unwrap the paste key locally.
            let pasteKey;
            try {
                pasteKey = await unwrapPasteKeyFromShare(unlockKey, unlockResult.share_wrapped_paste_key);
            } catch (e) {
                console.error("Failed to unwrap paste key:", e);
                // If unwrap fails the access code was wrong (server verifier collision is negligible)
                setGuestPasswordError('Incorrect access code. Please try again.');
                return;
            }

            // Step 4: Decrypt the payload entirely in the browser.
            try {
                const rawPaste = unlockResult.paste;
                const rawFiles = unlockResult.files || [];
                const dec = await decryptPasteData(rawPaste, rawFiles, pasteKey);
                setPaste(dec.paste);
                setFiles(dec.files);
                setNeedsPassword(false);
            } catch (e) {
                console.error("Failed to decrypt paste data:", e);
                setGuestPasswordError('Decryption failed. Please try again.');
            }
        } catch (e: any) {
            setGuestPasswordError('Something went wrong. Please try again.');
        } finally {
            setGuestUnlocking(false);
        }
    };

    const downloadFile = async (file: FileEntry) => {
        if (!pasteKeyRef.current) return;
        toast.info('Decrypting file for download...', { duration: 2000 });
        try {
            const res = await fetch(api.file.getFileUrl(file.slug));
            if (!res.ok) throw new Error("Failed to fetch file");
            const encBuf = await res.arrayBuffer();
            const decBuf = await decryptBytes(pasteKeyRef.current, encBuf);
            
            const blob = new Blob([decBuf], { type: file.mime_type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.file_name;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Download error", e);
            toast.error('Failed to download or decrypt file');
        }
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

    const handleDelete = async () => {
        if (!paste) return;
        try {
            await api.paste.delete(paste.slug);
            toast.success('Paste deleted');
            navigate('/');
        } catch {
            toast.error('Failed to delete');
        }
    };

    // Loading state
    if (loading && !paste && !needsPassword) {
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
                <Skeleton className="h-[calc(100dvh-12rem)] w-full rounded-lg" />
            </div>
        );
    }

    // Guest access code prompt
    if (needsPassword && !paste) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto px-4">
                <div className="rounded-full bg-primary/10 p-5 mb-6">
                    <LockIcon className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Access Code Required</h2>
                <p className="text-base text-muted-foreground mt-3">
                    This paste is protected. Enter the 8-character access code to view it.
                </p>
                <div className="w-full mt-6 space-y-4 flex flex-col items-center">
                    <input
                        id="guest-access-code"
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={8}
                        value={guestPassword}
                        onChange={(e) => {
                            setGuestPassword(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
                            setGuestPasswordError('');
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && guestPassword.length === 8) handleGuestUnlock(); }}
                        disabled={guestUnlocking}
                        placeholder="XXXXXXXX"
                        className="w-48 text-center font-mono text-2xl font-bold tracking-[0.3em] uppercase
                                   border rounded-lg px-4 py-3 bg-background
                                   focus:outline-none focus:ring-2 focus:ring-primary
                                   disabled:opacity-50"
                    />

                    {guestPasswordError && (
                        <p className="text-sm text-destructive w-full text-center">{guestPasswordError}</p>
                    )}
                    <Button
                        className="w-full max-w-[250px]"
                        disabled={guestUnlocking || guestPassword.length < 8}
                        onClick={handleGuestUnlock}
                    >
                        {guestUnlocking ? 'Unlocking...' : 'Unlock Paste'}
                    </Button>
                </div>
            </div>
        );
    }

    // Error / expired state
    if (!loading && (error || !paste)) {
        const expired = error?.toLowerCase().includes('expired');
        const errorMessage = error || 'This paste may have been deleted or is private.';
        return <ErrorState type={expired ? 'expired' : 'not-found'} error={expired ? '' : errorMessage} />;
    }

    if (!paste) return null;

    const isShared = !!paste.share_wrapped_paste_key;

    const lineCount = paste.content?.trim() ? paste.content.split('\n').length : 0;
    const canEdit = isAuthenticated && !isOffline;
    const isFilePaste = files.length > 0 && !paste.content.trim();

    return (
        <div className={cn("mx-auto max-w-[90rem] px-4 sm:px-6 pt-4 pb-12 sm:pb-8 flex flex-col box-border", paste.content?.trim() ? "h-full" : "min-h-full")}>
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
                        {paste.title || (isFilePaste && files.length > 0 ? truncateFileName(files[0].file_name) : paste.slug)}
                    </h1>
                </div>

                {/* Metadata badges */}
                <div className="hidden sm:flex items-center gap-2">
                    <Badge variant="default" className="text-[11px] px-2 py-0.5">
                        {getLanguageLabel(paste.language)}
                    </Badge>
                    {isShared && (
                        <Badge variant="secondary" className="text-[11px] px-2 py-0.5 gap-1">
                            <ShareIcon size={12} /> Shared
                        </Badge>
                    )}
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
                    {paste.content?.trim() && (
                        <span className="text-xs text-muted-foreground">
                            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
                        </span>
                    )}
                    {files.length > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileTextIcon size={12} />
                            {files.length} {files.length === 1 ? 'file' : 'files'}
                        </span>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    {paste.content.trim() && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={copyContent}
                        title="Copy content"
                    >
                        <CopyIcon size={16} />
                    </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={copyLink}
                        title="Copy link"
                    >
                        <LinkIcon size={16} />
                    </Button>
                    {paste.content?.trim() && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={viewRaw}
                            title="View raw text"
                        >
                            <FileTextIcon size={16} />
                        </Button>
                    )}
                    {canEdit && (
                        <>
                            {isShared ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10 gap-1.5"
                                    onClick={handleRevoke}
                                    title="Revoke share access"
                                >
                                    <LockIcon size={14} /> Revoke
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                                    onClick={() => setShareDialogOpen(true)}
                                    title="Share paste with password"
                                >
                                    <ShareIcon size={14} /> Share
                                </Button>
                            )}
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
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteOpen(true)}
                                title="Delete"
                            >
                                <DeleteIcon size={16} />
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
                {isShared && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                        <ShareIcon size={10} /> Shared
                    </Badge>
                )}
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

            {/* Attachments Section */}
            {files.length > 0 && (
                <div className="mb-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80 px-1">
                        <FileTextIcon size={16} className="text-primary" />
                        Attachments
                    </h3>
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {files.map(file => (
                            <div key={file.slug} className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 transition-all hover:shadow-md">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                                        <FileTextIcon size={24} className="text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate" title={file.file_name}>{truncateFileName(file.file_name)}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                            <span>{formatFileSize(file.file_size)}</span>
                                            <span className="w-1 h-1 rounded-full bg-border" />
                                            <span className="truncate">{file.mime_type.split('/').pop()}</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 text-primary hover:text-primary hover:bg-primary/10"
                                        onClick={() => downloadFile(file)}
                                        title="Download file"
                                    >
                                        <DownloadIcon size={16} />
                                    </Button>
                                </div>
                                
                                {/* Image Preview */}
                                {isImageMime(file.mime_type) && (
                                    <div className="w-full rounded-md border border-border/40 overflow-hidden bg-muted/20 flex items-center justify-center min-h-[100px] mt-2">
                                        {imageUrls[file.slug] ? (
                                            <img
                                                src={imageUrls[file.slug]}
                                                alt={file.file_name}
                                                className="max-w-full max-h-[200px] object-contain"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                                <span className="text-xs">Decrypting...</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Code / Text Section */}
            {paste.content?.trim() && (
                <div className="flex-1 min-h-0 rounded-lg border border-border/60 overflow-auto code-view-full mt-2">
                    {highlightedHtml ? (
                        <div className="min-h-[200px]" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                    ) : (
                        <pre className="text-sm font-mono leading-relaxed p-5 text-foreground/80 min-h-[200px]">
                            <code>{paste.content}</code>
                        </pre>
                    )}
                </div>
            )}

            {/* Delete confirmation dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Paste</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <span className="font-semibold text-foreground">{paste.title || paste.slug}</span>? This action cannot be undone.
                            {files.length > 0 && " This will also delete all attached files."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                setDeleteOpen(false);
                                handleDelete();
                            }}
                        >
                            <DeleteIcon size={16} className="mr-1.5" />
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Share paste dialog */}
            {paste && (
                <SharePasteDialog
                    open={shareDialogOpen}
                    onOpenChange={setShareDialogOpen}
                    pasteSlug={paste.slug}
                    encryptedPasteKey={paste.encrypted_paste_key || ''}
                    onSuccess={(sharedKey) => setPaste({ ...paste, shared_encrypted_key: sharedKey })}
                />
            )}
        </div>
    );
}
