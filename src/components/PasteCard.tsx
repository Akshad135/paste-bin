import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CodePreview } from '@/components/CodePreview';
import type { Paste } from '@/lib/api';
import { api } from '@/lib/api';
import { getLanguageLabel, timeAgo } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { EyeIcon } from '@/components/ui/animated-eye';
import { EyeOffIcon } from '@/components/ui/animated-eye-off';
import { DeleteIcon } from '@/components/ui/animated-delete';
import { ClockIcon } from '@/components/ui/animated-clock';
import { toast } from 'sonner';

interface PasteCardProps {
    paste: Paste;
    isAuthenticated?: boolean;
    onVisibilityChange?: (slug: string, newVisibility: 'public' | 'private') => void;
    onDelete?: (slug: string) => void;
}

export function PasteCard({ paste, isAuthenticated = false, onVisibilityChange, onDelete }: PasteCardProps) {
    const navigate = useNavigate();
    const [deleteOpen, setDeleteOpen] = useState(false);

    const toggleVisibility = async () => {
        const newVisibility = paste.visibility === 'public' ? 'private' : 'public';
        try {
            await api.paste.update(paste.slug, { visibility: newVisibility });
            onVisibilityChange?.(paste.slug, newVisibility);
            toast.success(`Paste is now ${newVisibility}`);
        } catch {
            toast.error('Failed to update visibility');
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

    const copyContent = async () => {
        try {
            const { paste: full } = await api.paste.get(paste.slug);
            await navigator.clipboard.writeText(full.content);
            toast.success('Copied to clipboard!');
        } catch {
            toast.error('Failed to copy content');
        }
    };

    const shareLink = async () => {
        const url = `${window.location.origin}/edit/${paste.slug}`;
        await navigator.clipboard.writeText(url);
        toast.success('Link copied!');
    };

    const rawContent = paste.content || (paste as any).preview || '';

    return (
        <>
            <Card
                className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 border-border/60 h-full flex flex-col"
                onClick={() => navigate(`/paste/${paste.slug}`)}
            >
                <CardContent className="p-3 gap-2 flex-1 flex flex-col">
                    {/* Header: title + badges + menu all in one row */}
                    <div className="flex items-center gap-1.5">
                        <h3 className="font-medium text-sm truncate text-foreground flex-1 min-w-0">
                            {paste.title || paste.slug}
                        </h3>
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">
                            {getLanguageLabel(paste.language)}
                        </Badge>
                        <Badge
                            variant={paste.visibility === 'public' ? 'secondary' : 'outline'}
                            className="text-[10px] px-1.5 py-0 shrink-0"
                        >
                            {paste.visibility === 'public' ? 'public' : 'private'}
                        </Badge>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
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
                                        <DropdownMenuItem onClick={() => navigate(`/edit/${paste.slug}`)}>
                                            <SquarePenIcon size={14} className="mr-2" /> Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={toggleVisibility}>
                                            {paste.visibility === 'public'
                                                ? <><EyeOffIcon size={14} className="mr-2" /> Make private</>
                                                : <><EyeIcon size={14} className="mr-2" /> Make public</>
                                            }
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

                    {/* Code preview */}
                    <CodePreview code={rawContent} language={paste.language} />

                    {/* Footer */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto">
                        <span className="flex items-center gap-1">
                            <ClockIcon size={12} className="text-primary/60" />
                            {timeAgo(paste.created_at)}
                        </span>
                        <span className="font-mono opacity-60 truncate ml-2">{paste.slug}</span>
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
        </>
    );
}
