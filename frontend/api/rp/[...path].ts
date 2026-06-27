/**
 * 로켓펀치 Open API 읽기 전용 프록시 (Vercel Function)
 *
 * 왜 프록시인가 (DESIGN.md 원칙과의 정합):
 * - 키 은닉: RP_API_KEY 는 서버 env 에만. 프론트 번들엔 안 나감.
 * - PII 미전송 유지: 이 프록시엔 카테고리/키워드만 흐르고, 사용자 나이·소득은 절대 안 감.
 * - Rate limit(분당 60) 흡수: s-maxage 캐싱으로 사용자 수와 무관하게 상류 호출 수 고정.
 * - CORS 우회: 브라우저가 openapi.rocketpunch.com 을 직접 못 부를 때 동일 출처로 우회.
 *
 * Read 전용: GET + 화이트리스트 경로만 허용. POST(뉴스피드 작성) 등은 차단.
 */

const UPSTREAM = "https://openapi.rocketpunch.com";

/** 허용 경로(정규식) + 캐시 TTL(초). 이벤트는 거의 안 변하므로 길게. */
const ALLOW: Array<{ re: RegExp; sMaxAge: number }> = [
  { re: /^v1\/events$/, sMaxAge: 3600 }, // 이벤트 목록: 1시간
  { re: /^v1\/events\/[^/]+$/, sMaxAge: 3600 }, // 이벤트 상세
  { re: /^v1\/jobs$/, sMaxAge: 600 }, // 채용 목록: 10분
  { re: /^v1\/jobs\/[^/]+$/, sMaxAge: 600 }, // 채용 상세
];

/** 상류로 그대로 넘길 쿼리 파라미터 화이트리스트 (오남용 방지). */
const ALLOWED_QUERY = new Set([
  "keyword",
  "page",
  "pageSize",
  "jobCategory",
  "employmentTypes",
  "seniorities",
  "workType",
  "eventCategories",
  "eventSubjects",
  "eventOpenType",
]);

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return json(405, { error: "method_not_allowed", message: "이 프록시는 읽기(GET) 전용입니다." });
  }

  const apiKey = process.env.RP_API_KEY;
  if (!apiKey) {
    return json(500, { error: "missing_api_key", message: "서버에 RP_API_KEY 가 설정되지 않았습니다." });
  }

  const url = new URL(req.url);
  // /api/rp/v1/events → path = "v1/events"
  const path = url.pathname.replace(/^\/api\/rp\//, "").replace(/\/+$/, "");

  const rule = ALLOW.find((a) => a.re.test(path));
  if (!rule) {
    return json(403, { error: "path_not_allowed", message: `허용되지 않은 경로: ${path}` });
  }

  // 쿼리 화이트리스트 적용
  const upstreamUrl = new URL(`${UPSTREAM}/${path}`);
  for (const [k, v] of url.searchParams) {
    if (ALLOWED_QUERY.has(k)) upstreamUrl.searchParams.append(k, v);
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { "X-RP-API-Key": apiKey, accept: "application/json" },
    });
  } catch (e) {
    return json(502, { error: "upstream_unreachable", message: String(e) });
  }

  const text = await upstream.text();
  const cacheHeaders: Record<string, string> = upstream.ok
    ? { "cache-control": `public, s-maxage=${rule.sMaxAge}, stale-while-revalidate=86400` }
    : { "cache-control": "no-store" };

  return new Response(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      ...cacheHeaders,
    },
  });
}
