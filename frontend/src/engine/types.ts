/** 엔진 출력 타입 (DESIGN Q1·Q9·Q16). */

export type BadgeKind = "assumed" | "upsell" | "warning" | "info";

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

/** 긴급 트랙 항목: 마감 임박 일회성 액션 (DESIGN Q9). */
export interface UrgentAction {
  productId: string;
  name: string;
  deadline: string; // ISO
  dDay: number; // 기준일로부터 남은 일수 (음수=마감)
  description: string;
  estimatedBenefit?: number;
  badges: Badge[];
}

export interface Recommendation {
  asOf: string;
  urgent: UrgentAction[];
  waterfall: Allocation[];
  /** 워터폴에 못 담고 남은 월 금액(일반계좌행). */
  leftoverMonthly: number;
  assumptions: Badge[];
  disclaimers: string[];
}
