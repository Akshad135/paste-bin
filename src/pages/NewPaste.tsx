import { useState } from 'react';
import {
    Card,
    CardBody,
    Input,
    Button,
    Textarea,
    Select,
    SelectItem,
    Switch,
    addToast,
} from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { LANGUAGES } from '@/lib/constants';

export function NewPaste() {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [language, setLanguage] = useState('plaintext');
    const [isPublic, setIsPublic] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!isAuthenticated) {
        navigate('/login');
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) {
            addToast({ title: 'Content is required', color: 'danger' });
            return;
        }

        setLoading(true);
        try {
            const result = await api.paste.create({
                title: title.trim(),
                content,
                language,
                visibility: isPublic ? 'public' : 'private',
            });
            addToast({ title: 'Paste created!', color: 'success' });
            navigate(`/paste/${result.slug}`);
        } catch (err) {
            addToast({
                title: err instanceof Error ? err.message : 'Failed to create paste',
                color: 'danger',
            });
        } finally {
            setLoading(false);
        }
    };

    // Handle tab key in textarea
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const value = target.value;
            const newValue = value.substring(0, start) + '  ' + value.substring(end);
            setContent(newValue);
            // Set cursor position after the tab
            requestAnimationFrame(() => {
                target.selectionStart = target.selectionEnd = start + 2;
            });
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-8">
                New Paste
            </h1>

            <form onSubmit={handleSubmit}>
                <Card className="border border-divider bg-content1/50 backdrop-blur-sm">
                    <CardBody className="gap-5 p-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Input
                                label="Title"
                                placeholder="Untitled paste"
                                value={title}
                                onValueChange={setTitle}
                                variant="bordered"
                                className="flex-1"
                            />
                            <Select
                                label="Language"
                                selectedKeys={[language]}
                                onSelectionChange={(keys) => {
                                    const value = Array.from(keys)[0] as string;
                                    if (value) setLanguage(value);
                                }}
                                variant="bordered"
                                className="sm:w-48"
                            >
                                {LANGUAGES.map((lang) => (
                                    <SelectItem key={lang.value}>
                                        {lang.label}
                                    </SelectItem>
                                ))}
                            </Select>
                        </div>

                        <Textarea
                            label="Content"
                            placeholder="Paste your code or text here..."
                            value={content}
                            onValueChange={setContent}
                            variant="bordered"
                            minRows={15}
                            maxRows={40}
                            classNames={{
                                input: 'paste-editor',
                            }}
                            onKeyDown={handleKeyDown}
                        />

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Switch
                                    isSelected={isPublic}
                                    onValueChange={setIsPublic}
                                    size="sm"
                                    color="success"
                                />
                                <span className="text-sm text-default-600">
                                    {isPublic ? '🌍 Public — visible to everyone' : '🔒 Private — only you can see this'}
                                </span>
                            </div>

                            <Button
                                type="submit"
                                color="primary"
                                variant="shadow"
                                size="lg"
                                isLoading={loading}
                            >
                                Create Paste
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            </form>
        </div>
    );
}
