import re

# 1. Update constants.ts
with open('src/lib/constants.ts', 'r') as f:
    constants = f.read()

# Add LANG_MAP after LANGUAGES
lang_map = """
export const LANG_MAP: Record<string, string> = {
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
"""
constants = constants.replace("export function getLanguageLabel", lang_map + "\nexport function getLanguageLabel")

# Add max unlock limit
constants = constants.replace(
    "if (Number(unlocks) < 1) return 'Unlock count must be at least 1';",
    "const count = Number(unlocks);\n        if (count < 1) return 'Unlock count must be at least 1';\n        if (count > 100000) return 'Unlock count cannot exceed 100,000';"
)
with open('src/lib/constants.ts', 'w') as f:
    f.write(constants)


# 2. Update CodePreview.tsx
try:
    with open('src/components/CodePreview.tsx', 'r') as f:
        cp = f.read()

    cp = cp.replace("import { getLanguageLabel } from '@/lib/constants';", "import { getLanguageLabel, LANG_MAP } from '@/lib/constants';")
    cp = re.sub(r'const LANG_MAP.*?};\n*', '', cp, flags=re.DOTALL)
    with open('src/components/CodePreview.tsx', 'w') as f:
        f.write(cp)
except Exception as e:
    print(f"Error CodePreview: {e}")


# 3. Update ViewPaste.tsx
with open('src/pages/ViewPaste.tsx', 'r') as f:
    vp = f.read()

# Remove LANG_MAP and formatFileSize
vp = re.sub(r'const LANG_MAP.*?};\n*', '', vp, flags=re.DOTALL)
vp = re.sub(r'function formatFileSize.*?}\n*', '', vp, flags=re.DOTALL)

# Add imports
vp = vp.replace("import { getLanguageLabel, timeAgo, isExpired } from '@/lib/constants';", "import { getLanguageLabel, timeAgo, isExpired, LANG_MAP } from '@/lib/constants';")
vp = vp.replace("import { cn, truncateFileName } from '@/lib/utils';", "import { cn, truncateFileName, formatFileSize } from '@/lib/utils';")

# Fix Blob Leaks
vp = vp.replace("const [imageUrls, setImageUrls] = useState<Record<string, string>>({});", 
"""const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
    const createdBlobs = useRef<Set<string>>(new Set());

    useEffect(() => {
        return () => {
            createdBlobs.current.forEach(url => URL.revokeObjectURL(url));
        };
    }, []);""")

vp = vp.replace(
"""                if (!cancelled) {
                    setImageUrls(prev => ({ ...prev, [file.slug]: URL.createObjectURL(blob) }));
                }""",
"""                if (!cancelled) {
                    const url = URL.createObjectURL(blob);
                    createdBlobs.current.add(url);
                    setImageUrls(prev => ({ ...prev, [file.slug]: url }));
                }""")

vp = vp.replace(
"""    const viewRaw = () => {
        if (!paste) return;
        const blob = new Blob([paste.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    };""",
"""    const viewRaw = () => {
        if (!paste) return;
        const win = window.open('', '_blank');
        if (win) {
            win.document.title = paste.title || 'Raw Paste';
            win.document.write(`<pre style="word-wrap: break-word; white-space: pre-wrap;">${paste.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`);
            win.document.close();
        }
    };""")

with open('src/pages/ViewPaste.tsx', 'w') as f:
    f.write(vp)

print("Done")
