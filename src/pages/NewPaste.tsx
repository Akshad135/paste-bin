import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { LANGUAGES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeftIcon } from '@/components/ui/animated-arrow-left';
import { EarthIcon } from '@/components/ui/animated-earth';
import { LockIcon } from '@/components/ui/animated-lock';
import { LoaderPinwheelIcon } from '@/components/ui/animated-loader-pinwheel';
import { toast } from 'sonner';

export function NewPaste() {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [language, setLanguage] = useState('plaintext');
    const [isPublic, setIsPublic] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!isAuthenticated) {
        navigate('/');
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) {
            toast.error('Content is required');
            return;
        }
        setLoading(true);
        try {
            await api.paste.create({
                title: title.trim(),
                content,
                language,
                visibility: isPublic ? 'public' : 'private',
            });
            toast.success('Paste created!');
            navigate('/');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create paste');
        } finally {
            setLoading(false);
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

    return (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
            <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10">
                    <ArrowLeftIcon size={16} />
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">New Paste</h1>
            </div>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Create a new snippet</CardTitle>
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

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-3">
                                <Switch
                                    checked={isPublic}
                                    onCheckedChange={setIsPublic}
                                />
                                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    {isPublic ? (
                                        <><EarthIcon size={14} className="text-emerald-400" /> Public — visible to everyone</>
                                    ) : (
                                        <><LockIcon size={14} className="text-amber-400" /> Private — only you can see this</>
                                    )}
                                </span>
                            </div>
                            <Button type="submit" disabled={loading}>
                                {loading && <LoaderPinwheelIcon size={16} className="mr-1.5 animate-spin" />}
                                Create Paste
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
