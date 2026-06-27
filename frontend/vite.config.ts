import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { rpProxy } from "./server/rpProxy";

/**
 * 로켓펀치 프록시 dev 미들웨어 (DESIGN_ROCKETPUNCH §3).
 * /api/rp/* 요청을 가로채 서버 측에서 RP_APP_KEY로 업스트림 호출.
 * 키는 이 미들웨어(서버)에만 있고 클라이언트 번들에는 포함되지 않는다.
 * 배포 시 동일한 server/rpProxy.ts 로직을 서버리스 함수로 이식 가능.
 */
function rpProxyPlugin(apiKey: string | undefined): PluginOption {
  return {
    name: "rp-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/rp/")) return next();
        const url = new URL(req.url, "http://localhost");
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("access-control-allow-origin", "*");
          res.setHeader("access-control-allow-methods", "GET,OPTIONS");
          res.setHeader("access-control-allow-headers", "content-type");
          return res.end();
        }
        const subpath = url.pathname.replace(/^\/api\/rp\//, "");
        rpProxy(subpath, url.searchParams, apiKey)
          .then((result) => {
            res.statusCode = result.status;
            for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
            res.end(result.body);
          })
          .catch(() => {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "proxy internal error" }));
          });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // "" prefix → .env / .env.local 의 모든 키 로드(RP_APP_KEY 포함). 서버에서만 사용.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [tailwindcss(), react(), rpProxyPlugin(env.RP_APP_KEY)],
  };
});
