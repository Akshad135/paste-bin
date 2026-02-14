import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { manifestPlugin } from './vite-plugin-manifest'

/**
 * Reads config.yaml and returns a flat Record<string, string>.
 * Handles only simple `key: value` lines (no nesting needed).
 */
function loadYamlConfig(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf-8')
  const result: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf(':')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    // Strip surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

/**
 * Maps YAML snake_case keys → VITE_* env var names.
 */
const YAML_TO_ENV: Record<string, string> = {
  app_name: 'VITE_APP_NAME',
  app_name_accent: 'VITE_APP_NAME_ACCENT',
  app_description: 'VITE_APP_DESCRIPTION',
  favicon_url: 'VITE_FAVICON_URL',
  pwa_icon_192: 'VITE_PWA_ICON_192',
  pwa_icon_512: 'VITE_PWA_ICON_512',
  pwa_icon_maskable: 'VITE_PWA_ICON_MASKABLE',
  pwa_icon_svg: 'VITE_PWA_ICON_SVG',
  pwa_icon_maskable_svg: 'VITE_PWA_ICON_MASKABLE_SVG',
  apple_touch_icon: 'VITE_APPLE_TOUCH_ICON',
}

export default defineConfig(({ mode }) => {
  // 1. Load config.yaml → VITE_* env vars (committed defaults)
  const yamlConfig = loadYamlConfig(path.resolve(__dirname, 'config.yaml'))
  for (const [yamlKey, envKey] of Object.entries(YAML_TO_ENV)) {
    if (yamlConfig[yamlKey] && !process.env[envKey]) {
      process.env[envKey] = yamlConfig[yamlKey]
    }
  }

  // 2. Load .env / .env.local (secrets + overrides)
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [react(), manifestPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
          cookieDomainRewrite: { '*': '' },
        },
      },
    },
  }
})
