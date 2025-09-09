import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/parfumNotebook/',   // обовʼязково для GitHub Pages
  plugins: [react()],
  server: {
    port: 5176,
    proxy: {
      '/api': 'http://localhost:4000'
    }
  },
  resolve: {
    alias: {
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom')
    }
  }
})
