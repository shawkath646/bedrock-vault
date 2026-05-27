import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const alias = {
  '@': fileURLToPath(new URL('./src/renderer', import.meta.url)),
  '@main': fileURLToPath(new URL('./src/main', import.meta.url)),
  '@renderer': fileURLToPath(new URL('./src/renderer', import.meta.url)),
  '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
  '@native': fileURLToPath(new URL('./src/native', import.meta.url)),
}

export default defineConfig({
  resolve: { alias },
  base: './',
  build: {
    outDir: 'dist/renderer',
  },

  plugins: [
    tailwindcss(),
    react(),
    electron({
      main: {
        entry: 'src/main/main.ts',
        vite: {
          resolve: { alias },
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              input: {
                main: 'src/main/main.ts',
                'handlers/encryption/encryption-worker':
                  'src/main/handlers/encryption/encryption-worker.ts',
              },
              external: [
                'os',
                'path',
                'fs',
                'crypto',
                'stream',
                'util',
                'events',
                'buffer',
                'http',
                'https',
                'url',
                'querystring',
                'zlib',
                'systeminformation',
                'proper-lockfile',
                'piscina',
                'fs-extra'
              ],
            },
          },
        },
      },
      preload: {
        input: 'src/preload/preload.ts',
        vite: {
          resolve: { alias },
          build: {
            outDir: 'dist/preload',
            rollupOptions: {
              external: [
                'os',
                'path',
                'fs',
                'crypto',
                'stream',
                'util',
                'events',
                'buffer',
              ],
            },
          },
        },
      },
    }),
  ],
})