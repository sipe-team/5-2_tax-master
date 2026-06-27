/** 로켓펀치 데이터 선별/매핑 순수 함수 (UI와 분리, 테스트 가능). */
import type { ProductCategory } from "../rules/schema";
import type { RpEvent } from "./types";

/** 절세/재테크와 결이 맞는 이벤트만 골라 마감 임박순으로. */
export function selectFinanceEvents(events: RpEvent[], asOfISO: string, limit = 4): RpEvent[] {
  const asOf = Date.parse(asOfISO);
  return events
    .filter((e) => {
      const subj = e.eventSubjects ?? [];
      const cat = e.eventCategories ?? [];
      // FINANCE/BUSINESS 주제거나, 비즈니스/컨퍼런스/네트워킹 성격
      return (
        subj.includes("FINANCE") ||
        subj.includes("BUSINESS") ||
        cat.includes("BUSINESS") ||
        cat.includes("CONFERENCE") ||
        cat.includes("NETWORKING")
      );
    })
    .filter((e) => !e.endAt || Date.parse(e.endAt) >= asOf) // 이미 끝난 건 제외
    .sort((a, b) => Date.parse(a.endAt ?? a.startAt ?? "") - Date.parse(b.endAt ?? b.startAt ?? ""))
    .slice(0, limit);
}

/** 기준일로부터 남은 일수 (음수=지남). */
export function dDay(fromISO: string, toISO?: string | null): number | undefined {
  if (!toISO) return undefined;
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

/**
 * 워터폴 상품 카테고리 → 채용 검색 키워드.
 * "이 절세 그릇을 다루는 회사/직무" 탐색을 위한 매핑 (D 아이디어).
 */
export function jobKeywordForCategory(category: ProductCategory): string {
  switch (category) {
    case "pension":
      return "연금 운용";
    case "isa":
    case "enhancedIsa":
      return "자산관리";
    case "overseasStock":
      return "해외주식 운용";
    case "youthSavings":
      return "핀테크";
    case "ria":
      return "자산운용";
    default:
      return "핀테크";
  }
}
