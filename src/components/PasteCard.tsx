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
import { MoreVertical, Copy, Link2, Pencil, Eye, EyeOff, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface PasteCardProps {
    paste: Paste;
    isAuthenticated?: boolean;
    onVisibilityChange?: (slug: string, newVisibility: 'public' | 'private') => void;
    onDelete?: (slug: string) => void;
}

export function PasteCard({ paste, isAuthenticated = false, onVisibilityChange, onDelete }: PasteCardProps) {
    const navigate = useNavigate();

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
            // List endpoint may only return preview, fetch full content
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
                                <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={copyContent}>
                                <Copy className="h-3.5 w-3.5 mr-2 text-primary" /> Copy content
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={shareLink}>
                                <Link2 className="h-3.5 w-3.5 mr-2 text-primary" /> Share link
                            </DropdownMenuItem>
                            {isAuthenticated && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => navigate(`/edit/${paste.slug}`)}>
                                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={toggleVisibility}>
                                        {paste.visibility === 'public'
                                            ? <><EyeOff className="h-3.5 w-3.5 mr-2" /> Make private</>
                                            : <><Eye className="h-3.5 w-3.5 mr-2" /> Make public</>
                                        }
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
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
                        <Clock className="h-3 w-3 text-primary/60" />
                        {timeAgo(paste.created_at)}
                    </span>
                    <span className="font-mono opacity-60 truncate ml-2">{paste.slug}</span>
                </div>
            </CardContent>
        </Card>
    );
}
