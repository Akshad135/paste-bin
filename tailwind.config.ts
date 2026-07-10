import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                'green': 'hsl(var(--green))',
                'yellow': 'hsl(var(--yellow))',
                'red': 'hsl(var(--red))',
                'term-bg': 'hsl(var(--term-bg))',
                'term-sidebar-bg': 'hsl(var(--term-sidebar-bg))',
                'term-active-bg': 'hsl(var(--term-active-bg))',
                'term-tab-bg': 'hsl(var(--term-tab-bg))',
                'term-tab-active-bg': 'hsl(var(--term-tab-active-bg))',
                'term-tab-active-text': 'hsl(var(--term-tab-active-text))',
                'term-border': 'hsl(var(--term-border))',
                'term-text': 'hsl(var(--term-text))',
                'term-muted': 'hsl(var(--term-muted))',
                'term-prompt': 'hsl(var(--term-prompt))',
                'term-cmd': 'hsl(var(--term-cmd))',
                'term-str': 'hsl(var(--term-str))',
                'term-dim': 'hsl(var(--term-dim))',
                'term-blue': 'hsl(var(--term-blue))',
                'term-green-bright': 'hsl(var(--term-green-bright))',
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
            },
        },
    },
    plugins: [tailwindcssAnimate],
};
