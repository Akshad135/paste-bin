import { type Plugin } from 'vite';

/**
 * Vite plugin that generates manifest.json from environment variables.
 * Falls back to sensible defaults if env vars aren't set.
 */
export function manifestPlugin(): Plugin {
    return {
        name: 'generate-manifest',
        generateBundle() {
            const name = process.env.VITE_APP_NAME || 'pastebin';
            const description = process.env.VITE_APP_DESCRIPTION || 'A simple, private-first pastebin with syntax highlighting';
            const themeColor = process.env.VITE_THEME_COLOR || '#4338ca';
            const bgColor = process.env.VITE_BG_COLOR || '#0a0a0f';
            const icon192 = process.env.VITE_PWA_ICON_192 || '/icon-192.png';
            const icon512 = process.env.VITE_PWA_ICON_512 || '/icon-512.png';
            const iconMaskable = process.env.VITE_PWA_ICON_MASKABLE || '/icon-maskable-512.png';
            const iconSvg = process.env.VITE_PWA_ICON_SVG || '/icon.svg';
            const iconMaskableSvg = process.env.VITE_PWA_ICON_MASKABLE_SVG || '/icon-maskable.svg';

            const manifest = {
                id: '/',
                name,
                short_name: name,
                description,
                start_url: '/',
                scope: '/',
                display: 'standalone',
                background_color: bgColor,
                theme_color: themeColor,
                orientation: 'any',
                categories: ['utilities', 'developer-tools'],
                prefer_related_applications: false,
                icons: [
                    { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
                    { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: iconMaskable, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                    { src: iconSvg, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
                    { src: iconMaskableSvg, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
                ],
                shortcuts: [
                    {
                        name: 'Home',
                        short_name: 'Home',
                        url: '/',
                        icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }],
                    },
                ],
            };

            this.emitFile({
                type: 'asset',
                fileName: 'manifest.json',
                source: JSON.stringify(manifest, null, 2),
            });
        },
    };
}
