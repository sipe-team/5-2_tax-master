/**
 * 로켓펀치 Open API 얇은 프록시 — 런타임 비의존(Vite dev 미들웨어 / 서버리스 공용).
 * DESIGN_ROCKETPUNCH §3.
 *
 * 책임: ① API Key 부착 ② 경로/파라미터 화이트리스트 ③ 응답 필드 화이트리스트
 *       ④ 단순 메모리 캐시(공개데이터) ⑤ CORS 허용.
 * 금지: 개인정보(절세입력) 수신·로깅. 이 프록시는 **공개 채용/코드 질의만** 다룬다.
 *
 * ⚠️ 문서 스펙은 `/api/v1`이지만 실제 동작 경로는 `/v1`이다(게이트웨이 이중 prefix 이슈).
 */

const RP_BASE = "https://openapi.rocketpunch.com/v1";

/** 허용 하위 경로(그 외 404). */
const ALLOWED_PATHS = new Set([
  "jobs",
  "events",
  "codes/job-categories",
  "codes/seniorities",
  "codes/employment-types",
  "codes/job-industries",
]);

/** /jobs 허용 쿼리 파라미터(그 외 폐기). */
const ALLOWED_JOB_PARAMS = new Set([
  "keyword",
  "companyId",
  "jobCategories",
  "seniorities",
  "employmentTypes",
  "companySizes",
  "workTypes",
  "sort",
  "page",
  "pageSize",
]);

/** /events 허용 쿼리 파라미터(그 외 폐기). 이벤트는 서버 필터가 불안정해 page/pageSize만 신뢰. */
const ALLOWED_EVENT_PARAMS = new Set(["page", "pageSize"]);

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; status: number; body: string }>();

export interface ProxyResult {
  status: number;
  body: string;
  headers: Record<string, string>;
}

const JSON_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function err(status: number, message: string): ProxyResult {
  return { status, body: JSON.stringify({ error: message }), headers: JSON_HEADERS };
}

interface RawJobsResponse {
  totalItems?: number;
  totalPages?: number;
  page?: number;
  pageSize?: number;
  items?: Array<Record<string, unknown>>;
}

/** /jobs 응답에서 필요한 필드만 통과(과다 노출 방지). */
function whitelistJobs(raw: RawJobsResponse): unknown {
  const items = (raw.items ?? []).map((it) => {
    const company = (it.company ?? {}) as Record<string, unknown>;
    return {
      jobId: it.jobId,
      title: it.title,
      subtitle: it.subtitle,
      jobCategory: it.jobCategory,
      seniorities: it.seniorities,
      employmentTypes: it.employmentTypes,
      workType: it.workType,
      company: {
        id: company.id,
        name: company.name,
        logoUrl: company.logoUrl,
        industry: company.industry,
        size: company.size,
      },
      endAt: it.endAt,
      webUrl: it.webUrl,
    };
  });
  return {
    totalItems: raw.totalItems,
    totalPages: raw.totalPages,
    page: raw.page,
    pageSize: raw.pageSize,
    items,
  };
}

/** /events 응답에서 필요한 필드만 통과(과다 노출 방지). */
function whitelistEvents(raw: RawJobsResponse): unknown {
  const items = (raw.items ?? []).map((it) => {
    const location = (it.location ?? {}) as Record<string, unknown>;
    return {
      eventId: it.eventId,
      eventName: it.eventName,
      eventCategories: it.eventCategories,
      eventSubjects: it.eventSubjects,
      startAt: it.startAt,
      endAt: it.endAt,
      eventOpenType: it.eventOpenType,
      location: { country: location.country, region: location.region, locality: location.locality },
      bannerUrl: it.bannerUrl,
      webUrl: it.webUrl,
    };
  });
  return {
    totalItems: raw.totalItems,
    totalPages: raw.totalPages,
    page: raw.page,
    pageSize: raw.pageSize,
    items,
  };
}

/**
 * @param subpath  /api/rp 이후의 하위 경로 (예: "jobs", "events", "codes/seniorities")
 * @param search   원본 쿼리스트링 파라미터
 * @param apiKey   RP_APP_KEY (없으면 503)
 */
export async function rpProxy(
  subpath: string,
  search: URLSearchParams,
  apiKey: string | undefined,
): Promise<ProxyResult> {
  const path = subpath.replace(/^\/+|\/+$/g, "");
  if (!ALLOWED_PATHS.has(path)) return err(404, `허용되지 않은 경로: ${path}`);
  if (!apiKey) return err(503, "RP_APP_KEY가 설정되지 않았습니다(.env.local).");

  // 파라미터 화이트리스트(jobs/events만 쿼리 허용, codes는 무시).
  const out = new URLSearchParams();
  if (path === "jobs") {
    for (const [k, v] of search.entries()) {
      if (ALLOWED_JOB_PARAMS.has(k)) out.append(k, v);
    }
  } else if (path === "events") {
    for (const [k, v] of search.entries()) {
      if (ALLOWED_EVENT_PARAMS.has(k)) out.append(k, v);
    }
  }
  const qs = out.toString();
  const cacheKey = `${path}?${qs}`;

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { status: hit.status, body: hit.body, headers: { ...JSON_HEADERS, "x-rp-cache": "HIT" } };
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${RP_BASE}/${path}${qs ? `?${qs}` : ""}`, {
      headers: { "X-RP-API-Key": apiKey, "Accept-Language": "ko" },
    });
  } catch {
    return err(502, "업스트림(RocketPunch) 연결 실패");
  }

  const text = await upstream.text();
  let body = text;
  if (upstream.ok && path === "jobs") {
    try {
      body = JSON.stringify(whitelistJobs(JSON.parse(text)));
    } catch {
      body = text; // 파싱 실패 시 원문(드묾)
    }
  } else if (upstream.ok && path === "events") {
    try {
      body = JSON.stringify(whitelistEvents(JSON.parse(text)));
    } catch {
      body = text;
    }
  }

  if (upstream.ok) cache.set(cacheKey, { at: Date.now(), status: upstream.status, body });
  return { status: upstream.status, body, headers: { ...JSON_HEADERS, "x-rp-cache": "MISS" } };
}
