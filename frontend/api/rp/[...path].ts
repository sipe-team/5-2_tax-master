/**
 * 로켓펀치 프록시 — Vercel Edge Function (프로덕션/베타).
 * DESIGN_ROCKETPUNCH §3: dev는 vite 미들웨어, 배포는 동일 rpProxy 로직을 서버리스로 이식.
 *
 * 경로: /api/rp/*  →  이 함수 (catch-all [...path])
 * 키:   Vercel 프로젝트 환경변수 RP_APP_KEY (브라우저 번들에 미포함)
 */
import { rpProxy } from "../../server/rpProxy";

export const config = { runtime: "edge" };

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const subpath = url.pathname.replace(/^\/api\/rp\//, "").replace(/^\/+/, "");
  const result = await rpProxy(subpath, url.searchParams, process.env.RP_APP_KEY);
  return new Response(result.body, { status: result.status, headers: result.headers });
}
