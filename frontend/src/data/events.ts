/**
 * 로켓펀치 이벤트 조회 클라이언트 (DESIGN_ROCKETPUNCH §4.3 — 채용과 동일 패턴).
 *
 * 브라우저 → 얇은 프록시(/api/rp) → 로켓펀치. API Key는 프록시에만.
 * 개인 절세입력은 이 레이어로 가지 않는다(공개 이벤트 데이터만).
 *
 * ⚠️ 이벤트는 서버 사이드 필터(eventSubjects 등)가 불안정해, 전체를 받아
 *    클라이언트에서 골라낸다(총 20건 미만이라 비용 무시 가능).
 */
import { type Page, ProxyError } from "./jobs";

const PROXY_BASE = "/api/rp";

/** 화면에 붙는 이벤트 칩(프록시 화이트리스트 필드만). */
export interface EventChip {
  eventId: string;
  eventName: string;
  eventCategories: string[];
  eventSubjects: string[];
  startAt?: string;
  endAt?: string;
  eventOpenType?: "OFFLINE" | "ONLINE";
  region?: string;
  bannerUrl?: string;
  webUrl?: string;
}

interface RawEventItem {
  eventId: string;
  eventName: string;
  eventCategories?: string[];
  eventSubjects?: string[];
  startAt?: string;
  endAt?: string;
  eventOpenType?: "OFFLINE" | "ONLINE";
  location?: { region?: string };
  bannerUrl?: string;
  webUrl?: string;
}

function toChip(raw: RawEventItem): EventChip {
  return {
    eventId: raw.eventId,
    eventName: raw.eventName,
    eventCategories: raw.eventCategories ?? [],
    eventSubjects: raw.eventSubjects ?? [],
    startAt: raw.startAt,
    endAt: raw.endAt,
    eventOpenType: raw.eventOpenType,
    region: raw.location?.region,
    bannerUrl: raw.bannerUrl,
    webUrl: raw.webUrl,
  };
}

export async function fetchEvents(pageSize = 20): Promise<Page<EventChip>> {
  const params = new URLSearchParams({ page: "1", pageSize: String(pageSize) });

  let res: Response;
  try {
    res = await fetch(`${PROXY_BASE}/events?${params.toString()}`);
  } catch {
    throw new ProxyError(0, "프록시에 연결할 수 없어요(dev 서버/네트워크 확인).");
  }

  if (!res.ok) {
    let msg = `프록시 오류 (HTTP ${res.status})`;
    if (res.status === 503) msg = "프록시에 RocketPunch 키가 설정되지 않았어요(.env.local).";
    throw new ProxyError(res.status, msg);
  }

  const data = (await res.json()) as Partial<Page<RawEventItem>>;
  return {
    totalItems: data.totalItems ?? 0,
    totalPages: data.totalPages ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 0,
    items: (data.items ?? []).map(toChip),
  };
}

/** 절세/재테크와 결이 맞는 이벤트만 골라 마감 임박순으로(이미 끝난 건 제외). */
export function selectFinanceEvents(events: EventChip[], asOfISO: string, limit = 4): EventChip[] {
  const asOf = Date.parse(asOfISO);
  return events
    .filter((e) => {
      const subj = e.eventSubjects;
      const cat = e.eventCategories;
      return (
        subj.includes("FINANCE") ||
        subj.includes("BUSINESS") ||
        cat.includes("BUSINESS") ||
        cat.includes("CONFERENCE") ||
        cat.includes("NETWORKING")
      );
    })
    .filter((e) => !e.endAt || Date.parse(e.endAt) >= asOf)
    .sort((a, b) => Date.parse(a.endAt ?? a.startAt ?? "") - Date.parse(b.endAt ?? b.startAt ?? ""))
    .slice(0, limit);
}
