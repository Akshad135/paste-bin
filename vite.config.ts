import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { manifestPlugin } from './vite-plugin-manifest'

export default defineConfig(({ mode }) => {
  // Load env vars so they're available during build
  const env = loadEnv(mode, process.cwd(), '')
  // Spread into process.env so the manifest plugin can read them
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
