import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@electron': fileURLToPath(new URL('./electron', import.meta.url)),
  '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
}

export default defineConfig({
  resolve: { alias },

  plugins: [
    tailwindcss(),
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          resolve: { alias },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          resolve: { alias },
        },
      },
    }),
  ],
})