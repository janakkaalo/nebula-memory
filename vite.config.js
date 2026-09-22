import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages: relative base so it works on user pages and project pages.
// For a project page like username.github.io/repo-name, relative paths avoid 404s.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three/ }],
        },
      },
    },
  },
})
