import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Vite多入口开发环境路由重写插件
const htmlRewritePlugin = () => ({
  name: 'html-rewrite',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      // 如果请求的是 /admin 或 /m 等子路径，并且不是静态资源（没有后缀），则重定向到对应的 HTML 文件
      if (req.url?.startsWith('/admin') && !req.url.includes('.')) {
        req.url = '/admin.html'
      } else if (req.url?.startsWith('/m') && !req.url.includes('.')) {
        req.url = '/mobile.html'
      } else if (req.url?.startsWith('/screen') && !req.url.includes('.')) {
        req.url = '/screen.html'
      }
      next()
    })
  }
})

// Vite多入口配置 - 百日奋战管理系统
export default defineConfig({
  plugins: [react(), htmlRewritePlugin()],
  resolve: {
    alias: {
      // 路径别名配置
      '@shared': resolve(__dirname, 'src/shared'),
      '@mobile': resolve(__dirname, 'src/apps/mobile'),
      '@admin': resolve(__dirname, 'src/apps/admin'),
      '@screen': resolve(__dirname, 'src/apps/screen'),
    },
  },
  build: {
    rollupOptions: {
      // 多入口HTML配置
      input: {
        mobile: resolve(__dirname, 'mobile.html'),
        admin: resolve(__dirname, 'admin.html'),
        screen: resolve(__dirname, 'screen.html'),
      },
    },
  },
  server: {
    // 开发服务器配置
    port: 3100,
    proxy: {
      // API代理到新后端端口
      '/api': {
        target: 'http://localhost:8100',
        changeOrigin: true,
      },
      // WebSocket代理到后端
      '/ws': {
        target: 'ws://localhost:8100',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
