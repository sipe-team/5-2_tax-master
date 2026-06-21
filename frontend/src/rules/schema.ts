/**
 * tax-master 규칙 스키마 (v1)
 *
 * 정답지: ../../TAX_SAVING.md  /  설계 근거: ../../DESIGN.md
 *
 * 핵심 원칙
 * - 규칙은 "데이터", 계산은 "엔진(순수함수)" — 둘을 분리한다. (DESIGN Q5)
 * - 법적 근거가 있는 모든 수치는 Sourced<T>로 감싸 status(확정/추진)를 단다.
 *   엔진은 status==='confirmed' 필드로만 계산한다. (DESIGN Q11)
 * - 혜택은 성격이 제각각이라 판별 유니온(Benefit)으로 표현하고,
 *   엔진이 종류별로 "투입 1원당 첫 해 세제혜택(원)"을 환산해 그리디 정렬한다. (DESIGN Q8)
 */

// ─────────────────────────────────────────────────────────────
// 공통: 법적 근거가 붙은 값
// ─────────────────────────────────────────────────────────────

/** 확정(입법 완료) | 추진(발표됐으나 미확정). 엔진은 confirmed만 계산. */
export type RuleStatus = "confirmed" | "proposed";

export interface Sourced<T> {
  value: T;
  status: RuleStatus;
  /** 법령/근거. 예: "소득세법 §59의3", "조특법 부칙(2026)" */
  source: string;
  /** 시행일 ISO. 기준일(DESIGN Q9)과 비교해 적용 여부 판단 */
  effectiveFrom: string;
  /** 한시 제도 종료일 ISO. 지나면 자동 비활성 */
  effectiveTo?: string;
  note?: string;
}

// ─────────────────────────────────────────────────────────────
// 입력 측 타입 (사용자 프로필) — 엔진 입력
// ─────────────────────────────────────────────────────────────

export type IncomeType = "earned" | "comprehensive"; // 총급여 | 종합소득

/** 자격 판정에 쓰는 사용자 상태. 미입력 항목은 엔진이 하이브리드 기본값으로 채움(Q16). */
export interface UserProfile {
  age: number;
  incomeType: IncomeType; // 직장인/사업자 토글 (Q15)
  income: number; // 위 유형 기준 연소득(원)
  monthlyInvestable: number; // 월 투자가능액(원)
  horizonYears: number; // 기간 = 언제 쓸 돈인지 (Q14, 기본 3)
  asOf: string; // 기준일 ISO (Q9, 기본 오늘)

  // 선택 입력 (점진공개). undefined면 기본값 가정 + 배지.
  householdMedianPct?: number; // 가구중위소득 %
  isFinanceTopTaxpayer?: boolean; // 금융소득종합과세 대상 여부
  overseasHoldings?: OverseasHoldings; // RIA 조건부 입력 (Q13)
}

/** RIA 계산용 보유 해외주식 (Q13). */
export interface OverseasHoldings {
  marketValue: number; // 평가액
  costBasis: number; // 취득가액
}

// ─────────────────────────────────────────────────────────────
// 자격 요건 (Q15·Q16)
// ─────────────────────────────────────────────────────────────

export interface Eligibility {
  ageMin?: number;
  ageMax?: number;
  /** 소득 유형별 상한 (총급여/종합소득 각각). 사용자 incomeType에 맞는 키 적용. */
  incomeCap?: Partial<Record<IncomeType, Sourced<number>>>;
  /** 가구중위소득 상한(%). */
  householdMedianPctMax?: Sourced<number>;
  /** 직전 3년 금융소득종합과세 대상자 배제 여부. */
  excludeFinanceTopTaxpayer?: boolean;
  /** 소득이 있어야 가입 가능. */
  requiresIncome?: boolean;
}

// ─────────────────────────────────────────────────────────────
// 락업 (Q14: 기간 하드 제약)
// ─────────────────────────────────────────────────────────────

export interface Lockup {
  /** 이 나이까지 인출 불가 (연금/IRP = 55). 실제 묶임 = untilAge - 사용자나이. */
  untilAge?: number;
  /** 의무 보유 연수 (ISA/청년적금 = 3). */
  minYears?: number;
  earlyPenaltyNote?: string;
}

// ─────────────────────────────────────────────────────────────
// 납입 한도
// ─────────────────────────────────────────────────────────────

export interface ContributionCap {
  period: "annual" | "monthly";
  amount: Sourced<number>;
}

// ─────────────────────────────────────────────────────────────
// 한시 창 (Q9: 긴급 트랙)
// ─────────────────────────────────────────────────────────────

export interface TimeWindow {
  /** 신청 가능 구간 (청년적금). */
  application?: { open: string; close: string };
  /** 적용 기한 (RIA = 2026-12-31). */
  applyBy?: string;
}

// ─────────────────────────────────────────────────────────────
// 혜택 (Q8): 판별 유니온. 엔진이 kind별로 1원당 세제혜택을 환산.
// ─────────────────────────────────────────────────────────────

/** 세액공제 — 연금저축/IRP. 효율 = 공제율(소득구간별). */
export interface TaxCreditBenefit {
  kind: "taxCredit";
  /** 소득유형·구간별 공제율. threshold 이하면 rate 적용. */
  rateByIncome: Array<{
    incomeType: IncomeType;
    upTo: number; // 이 금액 이하 구간
    rate: Sourced<number>;
  }>;
  /** 세액공제 대상 납입 한도(원). 이 금액까지만 공제. */
  creditCap: Sourced<number>;
}

/** 소득공제 — 청년형 강화ISA. 효율 = 공제율 × 한계세율(엔진의 소득세율표 참조). */
export interface IncomeDeductionBenefit {
  kind: "incomeDeduction";
  rate: Sourced<number>;
  deductionCap: Sourced<number>; // 연 최대 공제액(원)
}

/** 비과세 + 분리과세 — ISA. 효율 = 운용수익 × (일반세율 − 분리세율), 비과세분은 전액. */
export interface SepTaxBenefit {
  kind: "sepTax";
  exemptLimit: Sourced<number>; // 비과세 한도(순이익 기준)
  sepRate: Sourced<number>; // 분리과세율 (0.099)
  normalRate: number; // 비교 기준 일반 금융소득세율 (0.154)
}

/** 정부기여금 + 이자비과세 — 청년적금. 효율 = 기여율(+비과세 효과). */
export interface GovMatchBenefit {
  kind: "govMatch";
  matchRate: Sourced<number>; // 납입액 대비 정부기여율
  interestTaxExempt: Sourced<boolean>;
  baseInterestRate?: Sourced<number>; // 기본금리(참고)
}

/** 양도세 기본공제 — 해외주식 직투. 효율 = 250만 비과세분 × 22%. */
export interface CapGainsExemptBenefit {
  kind: "capGainsExempt";
  annualExempt: Sourced<number>; // 연 250만
  taxRate: Sourced<number>; // 0.22
}

/** 양도세 감면(한시) — RIA. 기존 보유분 일회성. 워터폴 아닌 긴급 트랙. */
export interface CapGainsReductionBenefit {
  kind: "capGainsReduction";
  /** 매도(결제) 시기별 감면율. until 이전이면 rate 적용. */
  schedule: Array<{ until: string; rate: Sourced<number> }>;
  baseTaxRate: Sourced<number>; // 감면 전 양도세율 0.22
  annualExempt: Sourced<number>; // 기본공제 250만
  benefitCapBySaleAmount: Sourced<number>; // 매도금액 기준 한도 5,000만
  basis: "existingHoldings"; // 신규 적립과 무관함을 명시
}

export type Benefit =
  | TaxCreditBenefit
  | IncomeDeductionBenefit
  | SepTaxBenefit
  | GovMatchBenefit
  | CapGainsExemptBenefit
  | CapGainsReductionBenefit;

// ─────────────────────────────────────────────────────────────
// 상품
// ─────────────────────────────────────────────────────────────

export type ProductCategory =
  | "pension" // 연금저축/IRP
  | "isa"
  | "overseasStock"
  | "youthSavings"
  | "ria"
  | "enhancedIsa";

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;

  /** 기본 등급의 자격/한도/혜택. */
  eligibility: Eligibility;
  contributionCap?: ContributionCap;
  benefit: Benefit;

  /**
   * 더 좋은 등급(서민형/우대형 등). 자격 충족 시 base를 덮어씀.
   * 미입력으로 자격 불명확하면 base(보수적, Q16) 유지 + 업셀 배지.
   */
  variants?: ProductVariant[];

  lockup?: Lockup;
  window?: TimeWindow; // 한시 상품 (Q9)
  poolId?: string; // 공유풀 소속 (Q10)
  assetScope?: string; // 자산군 카테고리 힌트 (Q17)
  /** 신규 적립 워터폴이 아니라 기존자산 일회성 액션 (RIA). */
  oneTimeOnExistingAssets?: boolean;
}

/** 등급 변형. base 대비 달라지는 부분만 덮어씀(partial). */
export interface ProductVariant {
  id: string;
  name: string; // "서민형", "우대형", "비과세만"
  /** 이 등급 자격(추가 조건). 충족 시 적용. */
  eligibility: Eligibility;
  /** 등급별 혜택 차이. */
  benefit?: Partial<Benefit>;
}

// ─────────────────────────────────────────────────────────────
// 공유풀 / 상호작용 (Q10) — 개별 상품 밖의 전역 규칙
// ─────────────────────────────────────────────────────────────

export interface SharedPool {
  id: string;
  members: string[]; // product id들
  /** 합산 세액공제 한도(원). */
  annualCreditCap?: Sourced<number>;
  /** 합산 납입 한도(원). */
  annualContributionCap?: Sourced<number>;
  /** 채우는 우선순위 (연금 먼저 → IRP). */
  fillOrder: string[];
}

export interface Interaction {
  kind: "suppress"; // A를 추천하면 B를 억제
  whenActive: string; // product id (예: ria)
  suppress: string; // product id (예: overseas-stock)
  note: string;
}

// ─────────────────────────────────────────────────────────────
// 엔진 공용 테이블
// ─────────────────────────────────────────────────────────────

/** 소득공제 효율 계산용 한계세율(종합소득세 누진). Q8의 incomeDeduction kind에서 사용. */
export interface MarginalRateBracket {
  upTo: number;
  rate: Sourced<number>;
}

// ─────────────────────────────────────────────────────────────
// 규칙 묶음 (엔진 입력)
// ─────────────────────────────────────────────────────────────

export interface RuleSet {
  /** 기준 시점 메타 (이 규칙셋이 유효한 시점 설명). */
  asOfLabel: string; // 예: "2026-06 기준"
  products: Product[];
  pools: SharedPool[];
  interactions: Interaction[];
  marginalRates: MarginalRateBracket[];
  /** 비교 기준 일반 금융소득세율 등 전역 상수. */
  constants: {
    financialIncomeTaxRate: number; // 0.154
    /** 기본모드 숨은 수익률 (DESIGN Q3). */
    assumedReturnRate: Sourced<number>;
  };
}
