import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  base: './',
  plugins: [preact()],
  server: {
    port: 5174,
    open: false
  },
  build: {
  target: 'es2017'
  },
  resolve: {
    alias: {
      // Allow importing shared modules from repo root
      '@root': new URL('../..', import.meta.url).pathname
    }
  }
})
