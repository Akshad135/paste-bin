import { Card, CardBody, CardFooter, Chip, Button, addToast } from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import type { Paste } from '@/lib/api';
import { api } from '@/lib/api';
import { getLanguageLabel, timeAgo } from '@/lib/constants';

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
            addToast({ title: `Paste is now ${newVisibility}`, color: 'success' });
        } catch {
            addToast({ title: 'Failed to update visibility', color: 'danger' });
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this paste? This cannot be undone.')) return;
        try {
            await api.paste.delete(paste.slug);
            onDelete?.(paste.slug);
            addToast({ title: 'Paste deleted', color: 'success' });
        } catch {
            addToast({ title: 'Failed to delete', color: 'danger' });
        }
    };

    return (
        <div
            onClick={() => navigate(`/paste/${paste.slug}`)}
            className="glass-card glow-hover transition-all duration-300 rounded-xl cursor-pointer"
        >
            <Card className="bg-transparent shadow-none">
                <CardBody className="gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold truncate flex-1">
                            {paste.title || paste.slug}
                        </h3>
                        <div className="flex gap-1.5 flex-shrink-0 items-center">
                            <Chip size="sm" variant="flat" color="primary" className="text-xs">
                                {getLanguageLabel(paste.language)}
                            </Chip>
                            {isAuthenticated && (
                                <div
                                    className="flex gap-1.5 items-center"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Chip
                                        size="sm"
                                        variant="flat"
                                        color={paste.visibility === 'public' ? 'success' : 'warning'}
                                        className="text-xs cursor-pointer"
                                        onClick={toggleVisibility}
                                    >
                                        {paste.visibility === 'public' ? 'public' : 'private'}
                                    </Chip>
                                    <Button
                                        size="sm"
                                        variant="light"
                                        color="danger"
                                        isIconOnly
                                        className="min-w-6 w-6 h-6"
                                        onPress={handleDelete}
                                    >
                                        x
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                    {paste.preview && (
                        <pre className="text-sm text-default-500 font-mono truncate overflow-hidden leading-relaxed mt-1 max-h-12">
                            {paste.preview}
                        </pre>
                    )}
                </CardBody>
                <CardFooter className="pt-0 px-4 pb-3 flex justify-between">
                    <span className="text-xs text-default-400">{timeAgo(paste.created_at)}</span>
                    <span className="text-xs text-default-500 font-mono">{paste.slug}</span>
                </CardFooter>
            </Card>
        </div>
    );
}
