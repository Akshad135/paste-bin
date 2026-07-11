import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { unwrapPasteKey, decryptText } from '@/lib/crypto';
import { CodePreview } from '@/components/CodePreview';
import type { Paste } from '@/lib/api';
import { api } from '@/lib/api';
import { getLanguageLabel, timeAgo, isExpired } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SharePasteDialog } from '@/components/SharePasteDialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { MenuIcon } from '@/components/ui/animated-menu';
import { CopyIcon } from '@/components/ui/animated-copy';
import { LinkIcon } from '@/components/ui/animated-link';
import { SquarePenIcon } from '@/components/ui/animated-square-pen';

import { DeleteIcon } from '@/components/ui/animated-delete';
import { FileTextIcon } from '@/components/ui/animated-file-text';
import { ClockIcon } from '@/components/ui/animated-clock';
import { PinIcon } from '@/components/ui/animated-pin';
import { HourglassIcon } from '@/components/ui/animated-hourglass';
import { ShareIcon } from '@/components/ui/animated-share';
import { LockIcon } from '@/components/ui/animated-lock';
import { ExpirationTimer } from '@/components/ExpirationTimer';
import { toast } from 'sonner';

interface PasteCardProps {
    paste: Paste;
    isAuthenticated?: boolean;
    onPinChange?: (slug: string, pinned: boolean) => void;
    onDelete?: (slug: string) => void;
}

export function PasteCard({ paste, isAuthenticated = false, onPinChange, onDelete }: PasteCardProps) {
    const navigate = useNavigate();
    const { masterKey } = useAuth();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [decryptedTitle, setDecryptedTitle] = useState('');
    const [decryptedContent, setDecryptedContent] = useState('');
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [localSharedKey, setLocalSharedKey] = useState<string | null | undefined>(paste.share_wrapped_paste_key);

    useEffect(() => {
        let cancelled = false;
        const decrypt = async () => {
            if (!masterKey || !paste.encrypted_paste_key) {
                if (!cancelled) {
                    setDecryptedTitle(paste.slug);
                    setDecryptedContent('Encrypted content...');
                }
                return;
            }
            try {
                const pasteKey = await unwrapPasteKey(masterKey, paste.encrypted_paste_key);
                const title = paste.title ? await decryptText(pasteKey, paste.title) : paste.slug;
                const content = paste.content ? await decryptText(pasteKey, paste.content) : '';
                if (!cancelled) {
                    setDecryptedTitle(title);
                    setDecryptedContent(content);
                }
            } catch (e) {
                if (!cancelled) {
                    setDecryptedTitle(paste.slug);
                    setDecryptedContent('Failed to decrypt');
                }
            }
        };
        decrypt();
        return () => { cancelled = true; };
    }, [paste, masterKey]);



    const togglePin = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const newPinned = !paste.pinned;
        try {
            await api.paste.pin(paste.slug, newPinned);
            onPinChange?.(paste.slug, newPinned);
            toast.success(newPinned ? 'Paste pinned' : 'Paste unpinned');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update pin status';
            toast.error(message);
        }
    };

    const handleDelete = async () => {
        try {
            await api.paste.delete(paste.slug);
            onDelete?.(paste.slug);
            toast.success('Paste deleted');
        } catch {
            toast.error('Failed to delete');
        }
    };

    const handleRevoke = async () => {
        try {
            await api.paste.revoke(paste.slug);
            setLocalSharedKey(null);
            toast.success('Share access revoked');
        } catch {
            toast.error('Failed to revoke share');
        }
    };

    const copyContent = async () => {
        try {
            if (!decryptedContent.trim()) {
                toast.info('No text content to copy');
                return;
            }
            await navigator.clipboard.writeText(decryptedContent);
            toast.success('Copied to clipboard!');
        } catch {
            toast.error('Failed to copy content');
        }
    };

    const shareLink = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const url = `${window.location.origin}/paste/${paste.slug}`;
        await navigator.clipboard.writeText(url);
        toast.success('Link copied!');
    };

    const rawContent = decryptedContent.slice(0, 500);
    const hasFiles = paste.file_count !== undefined && paste.file_count > 0;

    return (
        <>
            <Card
                className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 border-border/60 h-full flex flex-col"
                onClick={() => navigate(`/paste/${paste.slug}`)}
            >
                <CardContent className="p-3 gap-2 flex-1 flex flex-col">
                    {/* Header: title + badges + menu all in one row */}
                    <div className="flex items-center gap-1.5">
                        {paste.pinned === 1 && (
                            <PinIcon size={14} className="text-primary shrink-0 rotate-45" />
                        )}
                        <h3 className="font-medium text-sm truncate text-foreground flex-1 min-w-0">
                            {decryptedTitle}
                        </h3>
                        
                        {hasFiles && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 shrink-0 gap-1 border-primary/20 bg-primary/5 text-primary">
                                <FileTextIcon size={10} />
                                {paste.file_count}
                            </Badge>
                        )}
                        
                        <Badge variant="default" className="text-[10px] px-1.5 py-0.5 shrink-0">
                            {getLanguageLabel(paste.language)}
                        </Badge>
                        

                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                >
                                    <MenuIcon size={14} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={copyContent}>
                                    <CopyIcon size={14} className="mr-2 text-primary" /> Copy content
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={shareLink}>
                                    <LinkIcon size={14} className="mr-2 text-primary" /> Share link
                                </DropdownMenuItem>
                                {isAuthenticated && (
                                    <>
                                        <DropdownMenuSeparator />
                                        
                                        {localSharedKey ? (
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRevoke(); }} className="text-destructive focus:text-destructive">
                                                <LockIcon size={14} className="mr-2" /> Revoke access
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShareDialogOpen(true); }}>
                                                <ShareIcon size={14} className="mr-2" /> Share with PIN
                                            </DropdownMenuItem>
                                        )}
                                        
                                        <DropdownMenuItem onClick={() => navigate(`/edit/${paste.slug}`)}>
                                            <SquarePenIcon size={14} className="mr-2" /> Edit
                                        </DropdownMenuItem>

                                        <DropdownMenuItem onClick={() => togglePin()}>
                                            <PinIcon size={14} className="mr-2" />
                                            {paste.pinned ? 'Unpin' : 'Pin'}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={() => setDeleteOpen(true)}
                                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                        >
                                            <DeleteIcon size={14} className="mr-2" /> Delete
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Code preview or file indicator */}
                    {rawContent.trim() ? (
                        <CodePreview code={rawContent} language={paste.language} />
                    ) : hasFiles ? (
                        <div className="flex-1 flex items-center justify-center rounded-md border border-dashed border-border/40 bg-muted/10 py-6 gap-2 text-muted-foreground">
                            <FileTextIcon size={16} className="text-primary/60" />
                            <span className="text-xs font-medium">{paste.file_count} {paste.file_count === 1 ? 'file' : 'files'} attached</span>
                        </div>
                    ) : (
                        <CodePreview code={rawContent} language={paste.language} />
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1">
                                <ClockIcon size={12} className="text-primary/60" />
                                {timeAgo(paste.created_at)}
                            </span>
                            {paste.expires_at && !isExpired(paste.expires_at) && (
                                <span className="flex items-center gap-1 text-amber-500">
                                    <HourglassIcon size={12} />
                                    <ExpirationTimer
                                        expiresAt={paste.expires_at}
                                        onExpire={() => onDelete?.(paste.slug)}
                                    />
                                </span>
                            )}
                        </div>
                        <span className="font-mono truncate ml-2">{paste.slug}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Delete confirmation dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <DialogHeader>
                        <DialogTitle>Delete Paste</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <span className="font-semibold text-foreground">{paste.title || paste.slug}</span>? This action cannot be undone.
                            {hasFiles && " This will also delete all attached files."}
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
            <SharePasteDialog
                open={shareDialogOpen}
                onOpenChange={setShareDialogOpen}
                pasteSlug={paste.slug}
                encryptedPasteKey={paste.encrypted_paste_key || ''}
                onSuccess={(sharedKey) => setLocalSharedKey(sharedKey)}
            />
        </>
    );
}
