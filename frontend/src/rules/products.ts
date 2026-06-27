/**
 * tax-master 규칙 데이터 — 그릇 7종.
 *
 * 정답지: ../../TAX_SAVING.md (v2)  /  설계: ../../DESIGN.md  /  병합: ../../PRD.md
 *
 * ✅ 2026-06-27 TAX_SAVING.md v2와 수치 1:1 대조 완료(그릇 7종).
 *    남은 부채: source 문자열은 약식(법조항 정밀 표기는 후속), 농어민형 ISA·국민성장ISA 추진분 제외.
 * 규칙: 모든 법적 수치는 Sourced<T>로 감싼다. 엔진은 status==='confirmed'만 계산.
 * 상황별 전략(손익통산·분산매도·증여·고배당·금소세)은 그릇이 아니라 ../engine/strategies.ts.
 */

import type {
  Interaction,
  MarginalRateBracket,
  Product,
  RuleSet,
  SharedPool,
  Sourced,
  TaxCreditBenefit,
} from "./schema";

// ── 작성 헬퍼: 확정(c) / 추진(p) ─────────────────────────
const c = <T>(value: T, source: string, extra: Partial<Sourced<T>> = {}): Sourced<T> => ({
  value,
  status: "confirmed",
  source,
  effectiveFrom: "2026-01-01",
  ...extra,
});
const p = <T>(value: T, source: string, extra: Partial<Sourced<T>> = {}): Sourced<T> => ({
  value,
  status: "proposed",
  source,
  effectiveFrom: "2026-01-01",
  ...extra,
});

// 연금저축/IRP 공통 공제율표 (소득유형·구간별)
const pensionRateByIncome: TaxCreditBenefit["rateByIncome"] = [
  { incomeType: "earned", upTo: 55_000_000, rate: c(0.165, "소득세법 §59의3") },
  { incomeType: "earned", upTo: Infinity, rate: c(0.132, "소득세법 §59의3") },
  { incomeType: "comprehensive", upTo: 45_000_000, rate: c(0.165, "소득세법 §59의3") },
  { incomeType: "comprehensive", upTo: Infinity, rate: c(0.132, "소득세법 §59의3") },
];

// ═══════════════════════════════════════════════════════════
// 1) 연금저축펀드
// ═══════════════════════════════════════════════════════════
const pensionFund: Product = {
  id: "pension-fund",
  name: "연금저축펀드",
  category: "pension",
  eligibility: {},
  contributionCap: {
    period: "annual",
    amount: c(18_000_000, "소득세법 시행령", { note: "연금저축+IRP 합산(풀에서 관리)" }),
  },
  benefit: {
    kind: "taxCredit",
    creditCap: c(6_000_000, "소득세법 §59의3"),
    rateByIncome: pensionRateByIncome,
  },
  lockup: { untilAge: 55, earlyPenaltyNote: "55세 이전 중도해지 시 기타소득세 16.5%" },
  poolId: "pension-pool",
};

// ═══════════════════════════════════════════════════════════
// 2) IRP
// ═══════════════════════════════════════════════════════════
const irp: Product = {
  id: "irp",
  name: "IRP",
  category: "pension",
  eligibility: { requiresIncome: true },
  contributionCap: { period: "annual", amount: c(18_000_000, "근로자퇴직급여보장법") },
  benefit: {
    kind: "taxCredit",
    creditCap: c(9_000_000, "소득세법 §59의3", { note: "연금저축 합산 한도(풀이 강제)" }),
    rateByIncome: pensionRateByIncome,
  },
  lockup: { untilAge: 55, earlyPenaltyNote: "중도해지 시 기타소득세 16.5%" },
  poolId: "pension-pool",
};

// ═══════════════════════════════════════════════════════════
// 3) ISA (현행) — base=일반형, variant=서민형
// ═══════════════════════════════════════════════════════════
const isa: Product = {
  id: "isa",
  name: "ISA(개인종합자산관리계좌)",
  category: "isa",
  // 만 19세↑ (15~19세는 근로소득 시) — base는 보수적으로 19로, 근로청소년은 phase 2.
  eligibility: { ageMin: 19, excludeFinanceTopTaxpayer: true },
  // 연 2,000만 (총 1억은 스키마 미모델 — v1 워터폴은 연 단위라 영향 없음. phase 2 보완.)
  contributionCap: { period: "annual", amount: c(20_000_000, "조특법 §91의18") },
  lockup: { minYears: 3, earlyPenaltyNote: "의무 3년 내 해지 시 감면세액 추징" },
  assetScope: "예금·펀드·ETF·국내주식·국내상장 해외ETF (해외주식 직접투자 불가, v2 §3)",
  benefit: {
    kind: "sepTax",
    exemptLimit: c(2_000_000, "조특법 §91의18", { note: "일반형 비과세 한도" }),
    sepRate: c(0.099, "조특법 §91의18"),
    normalRate: 0.154,
  },
  variants: [
    {
      id: "isa-low-income",
      name: "서민형",
      // 총급여 5,000만(종합 3,800만) 이하
      eligibility: {
        incomeCap: {
          earned: c(50_000_000, "조특법 §91의18"),
          comprehensive: c(38_000_000, "조특법 §91의18"),
        },
      },
      benefit: {
        kind: "sepTax",
        exemptLimit: c(4_000_000, "조특법 §91의18"),
        sepRate: c(0.099, "조특법 §91의18"),
        normalRate: 0.154,
      },
    },
    // 농어민형(400만)은 '농어민' 플래그가 필요 → phase 2.
  ],
};

// ═══════════════════════════════════════════════════════════
// 4) 해외주식 직접투자
// ═══════════════════════════════════════════════════════════
const overseasStock: Product = {
  id: "overseas-stock", // interaction suppress 대상과 일치
  name: "해외주식 직접투자",
  category: "overseasStock",
  eligibility: {},
  // 납입 한도 없음(자유). 락업 없음(유동적).
  assetScope: "해외 상장주식",
  benefit: {
    kind: "capGainsExempt",
    annualExempt: c(2_500_000, "소득세법(양도)"),
    taxRate: c(0.22, "소득세법(양도)"),
  },
};

// ═══════════════════════════════════════════════════════════
// 5) RIA (한시, 기존 보유 해외주식 일회성)
// ═══════════════════════════════════════════════════════════
const ria: Product = {
  id: "ria",
  name: "RIA 계좌(국내시장복귀계좌)",
  category: "ria",
  eligibility: {},
  oneTimeOnExistingAssets: true,
  assetScope: "국내 상장주식·국내 주식형 펀드(ETF)·예탁금",
  window: { applyBy: "2026-12-31" },
  benefit: {
    kind: "capGainsReduction",
    basis: "existingHoldings",
    baseTaxRate: c(0.22, "소득세법(양도)"),
    annualExempt: c(2_500_000, "소득세법(양도)"),
    benefitCapBySaleAmount: c(50_000_000, "조특법(2026 한시)", { effectiveTo: "2026-12-31" }),
    schedule: [
      { until: "2026-05-31", rate: c(1.0, "조특법(2026 한시)") },
      { until: "2026-07-31", rate: c(0.8, "조특법(2026 한시)") },
      { until: "2026-12-31", rate: c(0.5, "조특법(2026 한시)") },
    ],
  },
};

// ═══════════════════════════════════════════════════════════
// 6) 청년미래적금 — base=비과세만, variants=일반형/우대형
// ═══════════════════════════════════════════════════════════
const youthSavings: Product = {
  id: "youth-future-savings",
  name: "청년미래적금",
  category: "youthSavings",
  eligibility: {
    ageMin: 19,
    ageMax: 34,
    incomeCap: { earned: c(75_000_000, "조특법"), comprehensive: c(63_000_000, "조특법") },
    householdMedianPctMax: c(200, "운영지침"),
    excludeFinanceTopTaxpayer: true,
    requiresIncome: true,
  },
  contributionCap: { period: "monthly", amount: c(500_000, "운영지침") },
  lockup: { minYears: 3 },
  window: { application: { open: "2026-06-22", close: "2026-07-03" } },
  benefit: {
    kind: "govMatch",
    matchRate: c(0, "운영지침", { note: "비과세만 등급" }),
    interestTaxExempt: c(true, "조특법"),
    baseInterestRate: c(0.05, "운영지침"),
  },
  variants: [
    {
      id: "youth-savings-general",
      name: "일반형",
      eligibility: {
        incomeCap: { earned: c(60_000_000, "조특법"), comprehensive: c(48_000_000, "조특법") },
        householdMedianPctMax: c(200, "운영지침"),
      },
      benefit: {
        kind: "govMatch",
        matchRate: c(0.06, "운영지침"),
        interestTaxExempt: c(true, "조특법"),
      },
    },
    {
      id: "youth-savings-preferred",
      name: "우대형",
      eligibility: {
        incomeCap: { earned: c(36_000_000, "조특법"), comprehensive: c(26_000_000, "조특법") },
        householdMedianPctMax: c(150, "운영지침"),
      },
      benefit: {
        kind: "govMatch",
        matchRate: c(0.12, "운영지침"),
        interestTaxExempt: c(true, "조특법"),
      },
    },
  ],
};

// ═══════════════════════════════════════════════════════════
// 7) 청년형 강화ISA — 확정분(소득공제 10%, 연 200만)만 (Q11)
//    국민성장ISA 한도/비과세 상향·국내투자형 등 추진분은 제외.
// ═══════════════════════════════════════════════════════════
const youthEnhancedIsa: Product = {
  id: "youth-enhanced-isa",
  name: "청년형 강화ISA",
  category: "enhancedIsa",
  eligibility: {
    ageMin: 19,
    ageMax: 34,
    incomeCap: { earned: c(75_000_000, "조특법 개정(청년형)") },
    excludeFinanceTopTaxpayer: true,
  },
  // 납입 한도는 추진(미확정) → 엔진 무시. 소득공제 한도(확정)에서 필요 납입액(200만/10%=2,000만)이 도출됨.
  contributionCap: { period: "annual", amount: p(40_000_000, "강화ISA 추진안") },
  lockup: { minYears: 3, earlyPenaltyNote: "의무기간 3년(적용 가능성 높음)" },
  assetScope: "국내 주식·국내 펀드·국민성장펀드·BDC 등 국내자산",
  benefit: {
    kind: "incomeDeduction",
    rate: c(0.1, "조특법 개정(청년형)"),
    deductionCap: c(2_000_000, "조특법 개정(청년형)"),
  },
};

// ═══════════════════════════════════════════════════════════
// 전역 규칙
// ═══════════════════════════════════════════════════════════
const pensionPool: SharedPool = {
  id: "pension-pool",
  members: ["pension-fund", "irp"],
  annualCreditCap: c(9_000_000, "소득세법 §59의3"),
  annualContributionCap: c(18_000_000, "소득세법 시행령"),
  fillOrder: ["pension-fund", "irp"],
};

const interactions: Interaction[] = [
  {
    kind: "suppress",
    whenActive: "ria",
    suppress: "overseas-stock",
    note: "RIA 외 계좌서 해외주식 순매수 시 감면 축소 → 모순 추천 방지",
  },
];

// 소득세 한계세율표(지방세 포함, 소득공제 효율 계산용) — 초안
const marginalRates: MarginalRateBracket[] = [
  { upTo: 14_000_000, rate: c(0.066, "소득세법 §55") },
  { upTo: 50_000_000, rate: c(0.165, "소득세법 §55") },
  { upTo: 88_000_000, rate: c(0.264, "소득세법 §55") },
  { upTo: 150_000_000, rate: c(0.385, "소득세법 §55") },
  { upTo: Infinity, rate: c(0.418, "소득세법 §55") },
];

export const ruleSet: RuleSet = {
  asOfLabel: "2026-06 기준 (TAX_SAVING.md v2 대조 완료)",
  products: [pensionFund, irp, isa, overseasStock, ria, youthSavings, youthEnhancedIsa],
  pools: [pensionPool],
  interactions,
  marginalRates,
  constants: {
    financialIncomeTaxRate: 0.154,
    assumedReturnRate: c(0.06, "내부 가정(DESIGN Q3)"),
  },
};
