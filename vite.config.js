import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    middlewareMode: false
  },
  preview: {
    port: 3000
  },
  build: {
    outDir: 'dist'
  },
  define: {
    'import.meta.env.DEV': mode === 'development'
  }
}));
