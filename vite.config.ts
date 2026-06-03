import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const isProd = process.env.NODE_ENV === 'production'

const alias = {
  '@': fileURLToPath(new URL('./src/renderer', import.meta.url)),
  '@main': fileURLToPath(new URL('./src/main', import.meta.url)),
  '@renderer': fileURLToPath(new URL('./src/renderer', import.meta.url)),
  '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
  '@native': fileURLToPath(new URL('./src/native', import.meta.url)),
}

const nodeBuiltins = [
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
  'worker_threads',
]

export default defineConfig({
  resolve: { alias },

  base: './',

  build: {
    outDir: 'dist/renderer',
    minify: 'esbuild',
    sourcemap: !isProd,
    reportCompressedSize: true,

    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
      },
    },
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
            minify: 'esbuild',
            sourcemap: !isProd,

            rollupOptions: {
              input: {
                main: 'src/main/main.ts',
                'handlers/encryption/helpers/run-pool-job':
                  'src/main/handlers/encryption/helpers/run-pool-job.ts',
              },

              treeshake: {
                moduleSideEffects: false,
              },

              external: [
                ...nodeBuiltins,
                'systeminformation',
                'piscina',
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
            minify: 'esbuild',
            sourcemap: !isProd,

            rollupOptions: {
              treeshake: {
                moduleSideEffects: false,
              },

              external: nodeBuiltins,
            },
          },
        },
      },
    }),
  ],
})