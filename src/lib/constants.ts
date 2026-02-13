// Supported languages for syntax highlighting
export const LANGUAGES = [
    { value: 'plaintext', label: 'Plain Text' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'rust', label: 'Rust' },
    { value: 'go', label: 'Go' },
    { value: 'java', label: 'Java' },
    { value: 'c', label: 'C' },
    { value: 'cpp', label: 'C++' },
    { value: 'csharp', label: 'C#' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'json', label: 'JSON' },
    { value: 'yaml', label: 'YAML' },
    { value: 'toml', label: 'TOML' },
    { value: 'xml', label: 'XML' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'bash', label: 'Bash' },
    { value: 'powershell', label: 'PowerShell' },
    { value: 'sql', label: 'SQL' },
    { value: 'graphql', label: 'GraphQL' },
    { value: 'dockerfile', label: 'Dockerfile' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'php', label: 'PHP' },
    { value: 'swift', label: 'Swift' },
    { value: 'kotlin', label: 'Kotlin' },
    { value: 'scala', label: 'Scala' },
    { value: 'r', label: 'R' },
    { value: 'lua', label: 'Lua' },
    { value: 'perl', label: 'Perl' },
    { value: 'haskell', label: 'Haskell' },
    { value: 'elixir', label: 'Elixir' },
    { value: 'clojure', label: 'Clojure' },
    { value: 'dart', label: 'Dart' },
    { value: 'zig', label: 'Zig' },
    { value: 'vue', label: 'Vue' },
    { value: 'svelte', label: 'Svelte' },
    { value: 'astro', label: 'Astro' },
    { value: 'jsx', label: 'JSX' },
    { value: 'tsx', label: 'TSX' },
    { value: 'scss', label: 'SCSS' },
    { value: 'less', label: 'Less' },
    { value: 'ini', label: 'INI' },
    { value: 'nginx', label: 'Nginx' },
    { value: 'diff', label: 'Diff' },
    { value: 'makefile', label: 'Makefile' },
    { value: 'shellscript', label: 'Shell Script' },
    { value: 'terraform', label: 'Terraform' },
    { value: 'proto', label: 'Protobuf' },
];

export function getLanguageLabel(value: string): string {
    return LANGUAGES.find((l) => l.value === value)?.label || value;
}

export function timeAgo(dateString: string): string {
    const date = new Date(dateString + 'Z'); // D1 stores UTC
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
    return `${Math.floor(seconds / 31536000)}y ago`;
}
