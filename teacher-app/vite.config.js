import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const localApiTarget = 'http://localhost:3000';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    fs: {
      allow: ['..']
    },
    port: 5174,
    proxy: {
      '/api': {
        target: localApiTarget,
        changeOrigin: true
      },
      '/socket.io': {
        target: localApiTarget,
        changeOrigin: true,
        ws: true
      }
    }
  },
  preview: {
    host: '0.0.0.0'
  }
});
