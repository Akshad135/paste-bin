import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useOffline } from '@/lib/offlineContext';
import { api, type Paste } from '@/lib/api';
import { unwrapPasteKey, decryptText, encryptText, encryptBytes } from '@/lib/crypto';
import { LANGUAGES, validateBurnRule, type BurnAction, type BurnUnit } from '@/lib/constants';
import { config } from '@/lib/config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { ArrowLeftIcon } from '@/components/ui/animated-arrow-left';

import { DeleteIcon } from '@/components/ui/animated-delete';
import { LoaderPinwheelIcon } from '@/components/ui/animated-loader-pinwheel';
import { BadgeAlertIcon } from '@/components/ui/animated-badge-alert';
import { PinIcon } from '@/components/ui/animated-pin';
import { UploadIcon } from '@/components/ui/animated-upload';
import { FileTextIcon } from '@/components/ui/animated-file-text';
import { BurnRulesControl } from '@/components/BurnRulesControl';
import { cn, truncateFileName, formatFileSize } from '@/lib/utils';
import { toast } from 'sonner';

// When editing a paste that already has a time-based burn, we do NOT
// reverse-engineer the remaining seconds back into a duration because that
// would cause the user to accidentally shrink the burn window on every save
// (e.g. a 1-day paste edited 12 hours later would re-submit "12 hours").
// Instead we leave the value blank and show a warning in the UI.
function inferBurnTimeFields(burnAt: string | null): { value: string; unit: BurnUnit; isPast: boolean } {
    if (!burnAt) return { value: '', unit: 'hour', isPast: false };
    const remaining = new Date(burnAt + 'Z').getTime() - Date.now();
    if (remaining <= 0) return { value: '', unit: 'minute', isPast: true };
    // Return blank value — the UI will show a notice about the existing deadline
    return { value: '', unit: 'hour', isPast: false };
}

interface Attachment {
    slug?: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    uploading: boolean;
    error?: string;
    isNew?: boolean; // to differentiate newly uploaded vs existing
}

export function EditPaste() {
    const { slug } = useParams<{ slug: string }>();
    const { isAuthenticated, masterKey, isLoading: authLoading } = useAuth();
    const { isEffectivelyOffline } = useOffline();
    const navigate = useNavigate();

    const [paste, setPaste] = useState<Paste | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [pasteKey, setPasteKey] = useState<CryptoKey | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [language, setLanguage] = useState('plaintext');

    const [isPinned, setIsPinned] = useState(false);
    const [burnTrigger, setBurnTrigger] = useState('off');
    const [burnValue, setBurnValue] = useState('');
    const [burnUnit, setBurnUnit] = useState<BurnUnit>('hour');
    const [burnUnlocks, setBurnUnlocks] = useState('1');
    const [burnAction, setBurnAction] = useState<BurnAction>('delete');
    const [burnTimeWarning, setBurnTimeWarning] = useState<string | null>(null);
    // Tracks the action that was loaded from the server so we can detect
    // whether the user changed it while leaving burnValue blank.
    const [originalBurnAction, setOriginalBurnAction] = useState<BurnAction>('delete');

    // Attachments state
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [removedSlugs, setRemovedSlugs] = useState<string[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (authLoading) return; // Wait until session restore is complete
        if (!isAuthenticated) {
            navigate('/');
            return;
        }
        if (!slug) return;
        loadPaste();
    // masterKey is included: during session restore isAuthenticated flips to
    // true before the key is available from IndexedDB. When masterKey
    // arrives the effect re-runs and retries the load successfully.
    }, [slug, isAuthenticated, masterKey, authLoading]);

    const loadPaste = async () => {
        setLoading(true);
        setError('');
        // Reset attachment state before loading so that switching between
        // /edit/:slug routes never carries over files or queued removals from
        // the previously-viewed paste (React Router reuses this component).
        setAttachments([]);
        setRemovedSlugs([]);
        try {
            const result = await api.paste.get(slug!);
            const p = result.paste;
            setPaste(p);
            
            let key: CryptoKey | null = null;
            if (isAuthenticated && p.encrypted_paste_key) {
                key = await unwrapPasteKey(masterKey!, p.encrypted_paste_key);
            }
            if (!key) throw new Error("Could not decrypt paste for editing");
            setPasteKey(key);

            const decTitle = p.title ? await decryptText(key, p.title) : '';
            const decContent = p.content ? await decryptText(key, p.content) : '';
            
            setTitle(decTitle);
            setContent(decContent);
            setLanguage(p.language || 'plaintext');

            setIsPinned(p.pinned === 1);
            setBurnTrigger(p.burn_trigger || 'off');
            const resolvedAction: BurnAction =
                (p.burn_action as BurnAction) ||
                (p.burn_trigger === 'unlock_count' ? 'revoke_share' : 'delete');
            setBurnAction(resolvedAction);
            setOriginalBurnAction(resolvedAction);
            const burnTime = inferBurnTimeFields(p.burn_at);
            setBurnValue(burnTime.value);
            setBurnUnit(burnTime.unit);
            setBurnUnlocks(String(p.burn_after_unlocks || 1));
            
            if (p.burn_trigger === 'time' && p.burn_at) {
                const remaining = new Date(p.burn_at + 'Z').getTime() - Date.now();
                if (remaining > 0) {
                    const d = new Date(p.burn_at + 'Z');
                    setBurnTimeWarning(
                        `This paste already burns at ${d.toLocaleString()}. Changing the burn value below will set a new deadline from now.`
                    );
                } else {
                    setBurnTimeWarning(null);
                }
            } else {
                setBurnTimeWarning(null);
            }
            
            const existingFiles = result.files;
            if (existingFiles && existingFiles.length > 0) {
                const decAttachments = await Promise.all(existingFiles.map(async f => ({
                    slug: f.slug,
                    file_name: await decryptText(key!, f.file_name),
                    file_size: f.file_size,
                    mime_type: await decryptText(key!, f.mime_type),
                    uploading: false,
                    isNew: false
                })));
                setAttachments(decAttachments);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load paste');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isEffectivelyOffline) {
            toast.error('You are offline. Please reconnect to save changes.');
            return;
        }

        if (attachments.some(a => a.uploading)) {
            toast.error('Please wait for files to finish uploading');
            return;
        }

        if (!content.trim() && attachments.length === 0) {
            toast.error('Please provide some content or attach a file');
            return;
        }

        // If the trigger is 'time' but burnValue is blank, the user hasn't changed
        // the existing deadline (inferBurnTimeFields returns '' intentionally).
        // Skip validation and don't send burn fields so the backend preserves the
        // existing burn_at unchanged.
        // If the user changed the burn action while leaving burnValue blank we must
        // NOT silently drop the action change — turn off keepExistingTimeBurn so
        // validation fires and asks the user to re-enter the time.
        const keepExistingTimeBurn =
            burnTrigger === 'time' && burnValue === '' && burnAction === originalBurnAction;
        if (!keepExistingTimeBurn) {
            const burnError = validateBurnRule(burnTrigger, burnValue, burnUnit, burnUnlocks);
            if (burnError) {
                toast.error(burnError);
                return;
            }
        }

        setSaving(true);
        try {
            if (!pasteKey) throw new Error("Encryption key missing");

            const contentBytes = new Blob([content]).size;
            if (contentBytes > config.maxTextSize) {
                toast.error(`Text content is too large (${(contentBytes / 1024).toFixed(1)} KB). Maximum is ${config.maxTextSize / 1024} KB. Please attach large content as a file instead.`);
                return;
            }

            const new_file_slugs = attachments
                .filter(a => a.isNew && !a.error && a.slug)
                .map(a => a.slug as string);

            const encTitle = title.trim() ? await encryptText(pasteKey, title.trim()) : '';
            const encContent = content ? await encryptText(pasteKey, content) : '';

            // Build burn fields: omit them entirely when the user left an existing
            // time-based deadline unchanged (blank burnValue) so the backend
            // treats it as "no change" and keeps the current burn_at.
            const burnFields = keepExistingTimeBurn
                ? {}
                : {
                    burn_trigger: burnTrigger === 'off' ? null : burnTrigger as 'time' | 'unlock_count',
                    burn_action: burnAction,
                    burn_after_value: burnTrigger === 'time' ? Number(burnValue) : undefined,
                    burn_after_unit: burnTrigger === 'time' ? burnUnit : undefined,
                    burn_after_unlocks: burnTrigger === 'unlock_count' ? Number(burnUnlocks) : undefined,
                };

            await api.paste.update(slug!, {
                title: encTitle,
                content: encContent,
                language,
                pinned: isPinned ? 1 : 0,
                ...burnFields,
                new_file_slugs,
                removed_file_slugs: removedSlugs,
            });
            
            toast.success('Paste updated!');
            navigate(`/paste/${slug}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update paste');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            await api.paste.delete(slug!);
            toast.success('Paste deleted');
            navigate('/');
        } catch {
            toast.error('Failed to delete');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const value = target.value;
            const newValue = value.substring(0, start) + '  ' + value.substring(end);
            setContent(newValue);
            requestAnimationFrame(() => {
                target.selectionStart = target.selectionEnd = start + 2;
            });
        }
    };

    const processFiles = async (files: FileList) => {
        if (isEffectivelyOffline) {
            toast.error('You are offline. File uploads require a connection.');
            return;
        }
        if (!pasteKey) {
            toast.error('Encryption key not ready');
            return;
        }

        const newFiles = Array.from(files);
        if (newFiles.length === 0) return;

        for (const file of newFiles) {
            const attachment: Attachment = {
                file_name: file.name,
                file_size: file.size,
                mime_type: file.type || 'application/octet-stream',
                uploading: true,
                isNew: true,
            };

            setAttachments(prev => [...prev, attachment]);

            try {
                const encName = await encryptText(pasteKey, file.name);
                const encMime = await encryptText(pasteKey, file.type || 'application/octet-stream');
                const encBytes = await encryptBytes(pasteKey, await file.arrayBuffer());
                const encBlob = new Blob([encBytes]);

                const res = await api.file.upload(encBlob, encName, encMime);
                setAttachments(prev => prev.map(a =>
                    a === attachment ? { ...a, uploading: false, slug: res.slug } : a
                ));
                toast.success(`Uploaded ${file.name}`);
            } catch (err) {
                setAttachments(prev => prev.map(a =>
                    a === attachment ? { ...a, uploading: false, error: (err as Error).message } : a
                ));
                toast.error(`Failed to upload ${file.name}`);
            }
        }
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        processFiles(e.dataTransfer.files);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(e.target.files);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeAttachment = async (index: number) => {
        const attachment = attachments[index];
        setAttachments(prev => prev.filter((_, i) => i !== index));

        if (attachment.slug && !attachment.error) {
            if (attachment.isNew) {
                // If it's a new file (not yet saved to the paste), delete it immediately from backend
                try {
                    await api.file.delete(attachment.slug);
                    toast.success(`Removed ${attachment.file_name}`);
                } catch (err) {
                    console.error("Failed to delete remote file", err);
                }
            } else {
                // If it's an existing file, just queue it for removal when they save
                setRemovedSlugs(prev => [...prev, attachment.slug as string]);
                toast.success(`Queued ${attachment.file_name} for removal`);
            }
        }
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="rounded-lg border p-6 space-y-5">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-[320px] w-full" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
        );
    }

    if (error || !paste) {
        return (
            <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20">
                <div className="flex flex-col items-center text-center">
                    <BadgeAlertIcon size={48} className="text-destructive mb-4" />
                    <h2 className="text-lg font-semibold">{error || 'Paste not found'}</h2>
                    <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
                        Go Home
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 min-h-[calc(100dvh-5rem)] flex flex-col justify-center">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10">
                        <ArrowLeftIcon size={16} />
                    </Button>
                    <h1 className="text-2xl font-bold tracking-tight">Edit Paste</h1>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteOpen(true)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <DeleteIcon size={16} className="mr-1.5" />
                    Delete
                </Button>
            </div>

            <form onSubmit={handleSave}>
                <Card className="overflow-hidden">
                    <CardContent className="p-0">
                        {/* Settings Bar */}
                        <div className="p-4 sm:p-6 border-b border-border/40 bg-muted/10">
                            <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
                                <div className="space-y-1.5">
                                    <Label htmlFor="title" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Title</Label>
                                    <Input
                                        id="title"
                                        placeholder="Untitled paste"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="bg-background shadow-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Language</Label>
                                    <Select value={language} onValueChange={setLanguage}>
                                        <SelectTrigger className="bg-background shadow-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {LANGUAGES.map((lang) => (
                                                <SelectItem key={lang.value} value={lang.value}>
                                                    {lang.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Editor Area */}
                        <div className="p-4 sm:p-6 space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between mb-1">
                                    <Label htmlFor="content" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Content</Label>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="h-7 text-xs flex items-center gap-1.5 px-3 rounded-md"
                                        onClick={() => setUploadDialogOpen(true)}
                                    >
                                        <UploadIcon size={12} />
                                        Attach Files
                                    </Button>
                                </div>
                                <Textarea
                                    id="content"
                                    placeholder="Paste your code or text here..."
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="paste-editor min-h-[300px] font-mono text-sm resize-y shadow-sm"
                                />
                            </div>

                        {attachments.length > 0 && (
                            <div className="px-4 sm:px-6 pb-6 space-y-3">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                    Attachments ({attachments.length})
                                </Label>
                                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                                    {attachments.map((attachment, idx) => (
                                        <div key={idx} className={cn(
                                            "group relative border border-border/60 rounded-lg p-2 flex items-center gap-3 overflow-hidden",
                                            attachment.error ? "bg-destructive/5 border-destructive/20" : "bg-muted/10 hover:bg-muted/30 transition-colors"
                                        )}>
                                            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                                                {attachment.uploading ? (
                                                    <LoaderPinwheelIcon size={20} className="text-primary animate-spin" />
                                                ) : (
                                                    <FileTextIcon size={20} className={attachment.error ? "text-destructive" : "text-primary"} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 pr-8">
                                                <p className="text-sm font-medium truncate" title={attachment.file_name}>
                                                    {truncateFileName(attachment.file_name)}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {attachment.error ? (
                                                        <span className="text-destructive">{attachment.error}</span>
                                                    ) : (
                                                        formatFileSize(attachment.file_size)
                                                    )}
                                                </p>
                                            </div>
                                            
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    className="h-8 w-8 shadow-sm"
                                                    onClick={() => removeAttachment(idx)}
                                                >
                                                    <DeleteIcon size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        </div>

                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 py-4 px-4 sm:px-6 bg-muted/10 border-t border-border/40 rounded-b-xl">
                            {/* Left group */}
                            <div className="flex flex-row flex-wrap items-center justify-center md:justify-start gap-3 sm:gap-4 md:gap-6 w-full md:w-auto order-1 md:order-none">
                                <div className="flex items-center gap-2">
                                    <Label
                                        htmlFor="pin-toggle"
                                        className={cn(
                                            "text-sm font-medium cursor-pointer select-none flex items-center gap-1.5 transition-colors whitespace-nowrap",
                                            isPinned ? "text-primary" : "text-muted-foreground"
                                        )}
                                    >
                                        <PinIcon size={14} className={cn("transition-transform", isPinned && "rotate-45")} />
                                        <span className="inline">Pinned</span>
                                    </Label>
                                    <Switch
                                        checked={isPinned}
                                        onCheckedChange={setIsPinned}
                                        id="pin-toggle"
                                    />
                                </div>
                                <div className="h-3 w-px bg-border/60 hidden sm:block" />
                                <BurnRulesControl
                                    burnTrigger={burnTrigger}
                                    setBurnTrigger={(v) => { setBurnTrigger(v); setBurnTimeWarning(null); }}
                                    burnValue={burnValue}
                                    setBurnValue={setBurnValue}
                                    burnUnit={burnUnit}
                                    setBurnUnit={setBurnUnit}
                                    burnUnlocks={burnUnlocks}
                                    setBurnUnlocks={setBurnUnlocks}
                                    burnAction={burnAction}
                                    setBurnAction={setBurnAction}
                                    isShared={!!paste?.share_wrapped_paste_key}
                                />
                                {burnTimeWarning && (
                                    <p className="text-xs text-amber-500 max-w-xs mt-2 md:mt-0">
                                        ⚠️ {burnTimeWarning}
                                    </p>
                                )}
                            </div>

                            {/* Right group */}
                            <div className="flex items-center justify-center md:justify-end gap-3 w-full md:w-auto order-2 md:order-none">
                                <Button
                                    type="submit"
                                    disabled={saving || attachments.some(a => a.uploading)}
                                    className="w-full md:w-auto h-10 px-8 text-sm font-medium shadow-sm"
                                >
                                    {saving ? (
                                        <LoaderPinwheelIcon size={14} className="animate-spin" />
                                    ) : (
                                        "Save Changes"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </form>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Paste</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this paste? This action cannot be undone.
                            {attachments.length > 0 && " This will also delete all attached files."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
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

            {/* Upload Files Dialog */}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Upload Files</DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex flex-col gap-4 mt-2">
                        <div
                            className={cn(
                                "border-2 border-dashed rounded-lg transition-all duration-200 cursor-pointer flex flex-col items-center justify-center p-8 gap-4 min-h-[200px]",
                                isDragOver
                                    ? "border-primary bg-primary/5 scale-[1.02]"
                                    : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
                            )}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleFileDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className={cn(
                                "rounded-full p-4 transition-colors",
                                isDragOver ? "bg-primary/10" : "bg-muted/50"
                            )}>
                                <UploadIcon size={32} className={cn(
                                    "transition-colors",
                                    isDragOver ? "text-primary" : "text-muted-foreground"
                                )} />
                            </div>
                            <div className="text-center">
                                <p className={cn(
                                    "text-sm font-medium transition-colors",
                                    isDragOver ? "text-primary" : "text-foreground"
                                )}>
                                    {isDragOver ? "Drop files here" : "Drag & drop files here"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    or click to browse • Max 50 MB
                                </p>
                            </div>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            multiple
                            onChange={handleFileSelect}
                        />
                        
                        {attachments.length > 0 && (
                            <div className="mt-2 space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                {attachments.map((attachment, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/40 text-sm">
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                            {attachment.uploading ? (
                                                <LoaderPinwheelIcon size={14} className="text-primary animate-spin shrink-0" />
                                            ) : attachment.error ? (
                                                <FileTextIcon size={14} className="text-destructive shrink-0" />
                                            ) : (
                                                <FileTextIcon size={14} className="text-primary shrink-0" />
                                            )}
                                            <span className="truncate text-foreground/90 font-medium" title={attachment.file_name}>
                                                {truncateFileName(attachment.file_name)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs text-muted-foreground hidden sm:inline-block">
                                                {attachment.error ? (
                                                    <span className="text-destructive">{attachment.error}</span>
                                                ) : (
                                                    formatFileSize(attachment.file_size)
                                                )}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => removeAttachment(idx)}
                                                title="Remove file"
                                            >
                                                <DeleteIcon size={12} />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <Button variant="default" onClick={() => setUploadDialogOpen(false)}>
                                Done
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
