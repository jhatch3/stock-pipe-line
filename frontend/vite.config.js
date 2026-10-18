import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // `@/` matches the import paths used by the Untitled UI component sources
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
