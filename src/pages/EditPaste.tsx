import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api, type Paste } from '@/lib/api';
import { LANGUAGES, EXPIRATION_OPTIONS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { EarthIcon } from '@/components/ui/animated-earth';
import { LockIcon } from '@/components/ui/animated-lock';
import { DeleteIcon } from '@/components/ui/animated-delete';
import { LoaderPinwheelIcon } from '@/components/ui/animated-loader-pinwheel';
import { BadgeAlertIcon } from '@/components/ui/animated-badge-alert';
import { PinIcon } from '@/components/ui/animated-pin';
import { HourglassIcon } from '@/components/ui/animated-hourglass';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function EditPaste() {
    const { slug } = useParams<{ slug: string }>();
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [paste, setPaste] = useState<Paste | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [deleteOpen, setDeleteOpen] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [language, setLanguage] = useState('plaintext');
    const [isPublic, setIsPublic] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [expiresIn, setExpiresIn] = useState('never');

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/');
            return;
        }
        if (!slug) return;
        loadPaste();
    }, [slug, isAuthenticated]);

    const loadPaste = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await api.paste.get(slug!);
            const p = result.data.paste;
            setPaste(p);
            setTitle(p.title || '');
            setContent(p.content);
            setLanguage(p.language || 'plaintext');
            setIsPublic(p.visibility === 'public');
            setIsPinned(p.pinned === 1);
            // Derive expiresIn state — if paste has expires_at, show remaining time label
            setExpiresIn(p.expires_at ? '__current__' : 'never');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load paste');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) {
            toast.error('Content is required');
            return;
        }
        setSaving(true);
        try {
            await api.paste.update(slug!, {
                title: title.trim(),
                content,
                language,
                visibility: isPublic ? 'public' : 'private',
                pinned: isPinned ? 1 : 0,
                expires_in: expiresIn === '__current__' ? undefined : expiresIn,
            } as any);
            toast.success('Paste updated!');
            navigate('/');
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
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
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
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Edit snippet</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    placeholder="Untitled paste"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Language</Label>
                                <Select value={language} onValueChange={setLanguage}>
                                    <SelectTrigger>
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

                        <div className="space-y-2">
                            <Label htmlFor="content">Content</Label>
                            <Textarea
                                id="content"
                                placeholder="Paste your code or text here..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="paste-editor min-h-[320px]"
                            />
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-6 pt-6 mt-4 border-t border-border/40">

                            {/* Line 1 (Mobile): Toggles */}
                            {/* Desktop: First part of the row */}
                            <div className="flex items-center justify-center md:justify-start gap-6 w-full md:w-auto order-1 md:order-none">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={isPinned}
                                        onCheckedChange={setIsPinned}
                                        id="pin-toggle"
                                        className="scale-90 md:scale-75 md:origin-left"
                                    />
                                    <Label
                                        htmlFor="pin-toggle"
                                        className={cn(
                                            "text-sm md:text-xs font-medium cursor-pointer select-none flex items-center gap-1.5 transition-colors whitespace-nowrap",
                                            isPinned ? "text-primary" : "text-muted-foreground"
                                        )}
                                    >
                                        <PinIcon size={14} className={cn("transition-transform", isPinned && "rotate-45")} />
                                        <span className="inline">Pinned</span>
                                    </Label>
                                </div>

                                <div className="h-3 w-px bg-border/60" />

                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={isPublic}
                                        onCheckedChange={setIsPublic}
                                        id="public-toggle"
                                        className="scale-90 md:scale-75 md:origin-left"
                                    />
                                    <Label
                                        htmlFor="public-toggle"
                                        className="text-sm md:text-xs font-medium cursor-pointer select-none flex items-center gap-1.5 text-muted-foreground whitespace-nowrap w-[70px] md:w-[70px]"
                                    >
                                        {isPublic ? (
                                            <><EarthIcon size={14} className="text-emerald-500" /> Public</>
                                        ) : (
                                            <><LockIcon size={14} className="text-amber-500" /> Private</>
                                        )}
                                    </Label>
                                </div>
                            </div>

                            {/* Line 2 (Mobile): Expiration */}
                            {/* Desktop: Middle part of the row */}
                            <div className="flex items-center justify-center md:justify-start w-full md:w-auto gap-3 order-2 md:order-none md:border-l md:border-border/60 md:pl-6">
                                <HourglassIcon size={14} className="text-muted-foreground shrink-0" />
                                <div className="flex items-center gap-2 text-sm text-muted-foreground md:hidden">
                                    <span>Expires in</span>
                                </div>
                                <Select value={expiresIn} onValueChange={setExpiresIn}>
                                    <SelectTrigger className="w-[140px] md:w-[120px] h-9 md:h-8 text-sm md:text-xs bg-transparent border-border/60 focus:ring-1 focus:ring-primary/20 px-3 md:px-2">
                                        <SelectValue placeholder="Expires" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {paste.expires_at && (
                                            <SelectItem value="__current__">
                                                Keep current expiration
                                            </SelectItem>
                                        )}
                                        {EXPIRATION_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Line 3 (Mobile): Buttons */}
                            {/* Desktop: End of the row */}
                            <div className="flex items-center justify-center md:justify-end gap-3 w-full md:w-auto order-3 md:order-none">
                                <Button
                                    variant="ghost"
                                    type="button"
                                    onClick={() => navigate('/')}
                                    className="w-auto md:w-auto h-10 md:h-8 px-6 md:px-3 text-sm md:text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={saving}
                                    className="w-auto md:w-auto h-10 md:h-8 px-6 md:px-3 text-sm md:text-xs font-medium min-w-[120px] md:min-w-0"
                                >
                                    {saving ? <LoaderPinwheelIcon size={14} className="animate-spin" /> : "Save Changes"}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </form>

            {/* Delete confirmation dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete this paste?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. The paste "{paste.title || paste.slug}" will be permanently deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
