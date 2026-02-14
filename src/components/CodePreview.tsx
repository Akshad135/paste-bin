import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

// Map our language values to shiki language identifiers
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

interface CodePreviewProps {
    code: string;
    language: string;
    maxLines?: number;
    className?: string;
}

export function CodePreview({ code, language, maxLines = 4, className = '' }: CodePreviewProps) {
    const [html, setHtml] = useState<string>('');

    const lines = code.split('\n').slice(0, maxLines);
    const preview = lines.join('\n');
    const isTruncated = code.split('\n').length > maxLines || code.length > 200;
    const displayCode = preview + (isTruncated ? '\n…' : '');

    useEffect(() => {
        let cancelled = false;

        const lang = LANG_MAP[language] || language;

        codeToHtml(displayCode, {
            lang,
            theme: 'github-dark-default',
        })
            .then((result) => {
                if (!cancelled) setHtml(result);
            })
            .catch(() => {
                // Fallback: if language not supported, try plaintext
                if (!cancelled) {
                    codeToHtml(displayCode, {
                        lang: 'text',
                        theme: 'github-dark-default',
                    })
                        .then((result) => {
                            if (!cancelled) setHtml(result);
                        })
                        .catch(() => {
                            // Give up on highlighting, leave html empty
                        });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [displayCode, language]);

    if (!html) {
        // Fallback: plain pre/code while shiki loads
        return (
            <pre
                className={`text-xs font-mono leading-relaxed rounded-md p-3 overflow-hidden flex-1 bg-black/5 dark:bg-white/[0.06] text-foreground/70 border border-border/40 ${className}`}
            >
                <code>{displayCode}</code>
            </pre>
        );
    }

    return (
        <div
            className={`code-preview-card overflow-hidden flex-1 rounded-md border border-border/40 ${className}`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
