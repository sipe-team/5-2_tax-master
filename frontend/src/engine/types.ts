/** 엔진 출력 타입 (DESIGN Q1·Q9·Q16). */

type BadgeKind = "assumed" | "upsell" | "warning" | "info";

export interface Badge {
  kind: BadgeKind;
  text: string;
}

/** 워터폴 한 칸: 그릇 + 금액 + 순서 + 이유 (DESIGN Q1·Q17). */
export interface Allocation {
  productId: string;
  variantId?: string;
  name: string;
  monthlyAmount: number;
  annualAmount: number;
  /** 이 그릇의 연 납입 한도(채움 비율 표시용). */
  annualCap: number;
  /** 투입 1원당 첫 해 세제혜택 (정렬 키, Q8). */
  efficiency: number;
  firstYearBenefit: number;
  rationale: string;
  badges: Badge[];
}

/**
 * 액션 시급도 (PRD Decision B — duty URGENCY 가중치 계승).
 * immediate=마감 임박 일회성 / partial=부분 실행 / structural=구조적 전략 / warning=주의.
 */
export type ActionUrgency = "immediate" | "partial" | "structural" | "warning";

export const URGENCY_WEIGHT: Record<ActionUrgency, number> = {
  immediate: 2.0,
  partial: 1.5,
  structural: 1.0,
  warning: 0.8,
};

/**
 * 전략·긴급 액션 카드 (PRD: 그릇=워터폴, 전략·마감=액션).
 * 워터폴(월 적립)과 달리 "조건부로 실행하는" 일회성/상황별 행동.
 */
export interface ActionCard {
  id: string;
  name: string;
  category: string; // "마감 임박" | "해외주식 전략" | "배당" | "금융소득" | "연금 연계" ...
  urgency: ActionUrgency;
  /** 정렬 키 = 절세효과(만원) × 시급도 가중치 (DESIGN Q8 정신 계승). */
  score: number;
  estimatedBenefit: number | null; // 원 (추정 불가면 null)
  reason: string; // 왜 추천하는지
  action: string; // 사용자가 할 일
  warning: string | null;
  deadline?: string; // ISO (한시/마감)
  dDay?: number; // 기준일로부터 남은 일수
  badges: Badge[];
}

export interface Recommendation {
  asOf: string;
  /** 전략·긴급 액션 (시급도×절세효과 점수순). DESIGN Q9 긴급 트랙을 흡수. */
  actions: ActionCard[];
  waterfall: Allocation[];
  /** 워터폴에 못 담고 남은 월 금액(일반계좌행). */
  leftoverMonthly: number;
  assumptions: Badge[];
  disclaimers: string[];
}
