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
    target: 'baseline-widely-available',
    cssCodeSplit: true,
    cssMinify: true,
    sourcemap: false,
    reportCompressedSize: true,
    modulePreload: {
      polyfill: false,
    },
    rolldownOptions: {
      output: {
        // three.js (~550KB) only loads when the nebula/cube scenes mount.
        // react vendor is separate so game chunks stay 2-12KB each.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three/ },
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)/ },
          ],
        },
      },
    },
  },
})
