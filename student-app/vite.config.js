import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from '@vant/auto-import-resolver';

const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'maskable-icon-512.png'],
  manifest: {
    name: '校园请假管理 Demo 学生端',
    short_name: '请假Demo',
    description: '通用校园请假管理演示项目的学生端',
    theme_color: '#1989fa',
    background_color: '#eef4ff',
    display: 'standalone',
    lang: 'zh-CN',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: '/maskable-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  }
});

export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver({ importStyle: false })]
    }),
    command === 'build' ? pwaPlugin : null
  ].filter(Boolean),
  build: {
    target: ['chrome67', 'edge79', 'safari13']
  },
  server: {
    host: '0.0.0.0',
    fs: {
      allow: ['..']
    },
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0'
  }
}));
