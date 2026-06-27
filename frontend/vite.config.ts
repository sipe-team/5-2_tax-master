import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 로컬 개발용 키. .env.local 의 RP_API_KEY 를 읽어 dev 프록시에서만 사용.
  // (프로덕션은 Vercel Function 이 process.env.RP_API_KEY 로 처리)
  const env = loadEnv(mode, process.cwd(), '')
  const rpKey = env.RP_API_KEY

  return {
    plugins: [
      tailwindcss(),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    server: {
      // 개발 중 /api/rp/* 를 로켓펀치로 중계 (프로덕션의 Vercel Function 과 동일 경로).
      proxy: {
        '/api/rp': {
          target: 'https://openapi.rocketpunch.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/rp/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (rpKey) proxyReq.setHeader('X-RP-API-Key', rpKey)
            })
          },
        },
      },
    },
  }
})
