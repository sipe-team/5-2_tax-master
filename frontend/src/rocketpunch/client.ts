/**
 * 로켓펀치 API 클라이언트 — 항상 동일 출처 프록시(/api/rp/*)를 통해서만 호출.
 * 키는 프록시(서버)에만 있으므로 여기엔 PII/키가 일절 없음 (DESIGN.md 원칙 유지).
 */
import type { Paged, RpEvent, RpJob } from "./types";

const BASE = "/api/rp/v1";

async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.append(k, String(v));
  }
  const res = await fetch(`${BASE}/${path}?${qs.toString()}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`rocketpunch ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

/** 채용 검색. keyword 는 한글/영문 모두 동작(검증됨). */
export function fetchJobs(opts: {
  keyword?: string;
  employmentTypes?: string;
  pageSize?: number;
}): Promise<Paged<RpJob>> {
  return get<Paged<RpJob>>("jobs", {
    keyword: opts.keyword,
    employmentTypes: opts.employmentTypes,
    pageSize: opts.pageSize ?? 5,
  });
}

/**
 * 이벤트 조회.
 * ⚠️ 서버 사이드 필터(eventSubjects 등)가 신뢰 불가(검증됨) → 전체를 받아 클라에서 필터링한다.
 * 전체가 17~18건뿐이라 비용 무시 가능.
 */
export function fetchAllEvents(pageSize = 20): Promise<Paged<RpEvent>> {
  return get<Paged<RpEvent>>("events", { pageSize });
}
