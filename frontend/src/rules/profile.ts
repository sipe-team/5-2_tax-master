import { z } from "zod";
import { todayISO } from "../lib/format";
import type { IncomeType, InvestType, UserProfile } from "./schema";

/** 퍼널 UI 입력(만원 단위, 소득유형은 UI 라벨). zod로 검증 후 UserProfile로 매핑. */
export const IncomeTypeUI = z.enum(["employee", "freelancer", "none"]);
export type IncomeTypeUI = z.infer<typeof IncomeTypeUI>;

export const INCOME_TYPE_LABEL: Record<IncomeTypeUI, string> = {
  employee: "직장인",
  freelancer: "프리랜서·사업",
  none: "무소득",
};

export const INVEST_TYPE_LABEL: Record<InvestType, string> = {
  domestic_stock: "국내주식",
  foreign_stock: "해외주식",
  etf_domestic: "국내주식형 ETF",
  etf_foreign: "국내상장 해외 ETF",
  fund: "펀드",
  deposit: "예·적금",
  bond: "채권",
  reit: "리츠",
};

export const FunnelDataSchema = z.object({
  // 1단계 (필수)
  age: z.number().int().min(15).max(100),
  incomeTypeUI: IncomeTypeUI,
  incomeMan: z.number().int().min(0).default(0),
  monthlyMan: z.number().int().min(0),
  horizonYears: z.number().int().min(1).max(40),
  // 2단계 보유 계좌
  hasPension: z.boolean().default(false),
  pensionContributionMan: z.number().int().min(0).default(0),
  hasIrp: z.boolean().default(false),
  irpContributionMan: z.number().int().min(0).default(0),
  hasIsa: z.boolean().default(false),
  // 3단계 투자 현황
  investTypes: z.array(z.string()).default([]),
  hasOverseas: z.boolean().default(false),
  overseasValueMan: z.number().int().min(0).default(0),
  overseasCostMan: z.number().int().min(0).default(0),
  // 4단계 소득·가족
  financialIncomeMan: z.number().int().min(0).default(0),
  dividendIncomeMan: z.number().int().min(0).default(0),
  holdsHighDividend: z.boolean().default(false),
  hasSpouse: z.boolean().default(false),
  hasChildren: z.boolean().default(false),
  hasMinorChildren: z.boolean().default(false),
  householdMedianPct: z.number().int().min(0).optional(),
});

export type FunnelData = z.infer<typeof FunnelDataSchema>;

const MAN = 10_000;
const INCOME_TYPE_MAP: Record<IncomeTypeUI, IncomeType> = {
  employee: "earned",
  freelancer: "comprehensive",
  none: "none",
};

/** 검증된 퍼널 데이터 → 엔진 UserProfile (만원→원, RIA·미실현 단일화). */
export function toProfile(d: FunnelData): UserProfile {
  const overseas = d.hasOverseas
    ? { marketValue: d.overseasValueMan * MAN, costBasis: d.overseasCostMan * MAN }
    : undefined;
  return {
    age: d.age,
    incomeType: INCOME_TYPE_MAP[d.incomeTypeUI],
    income: d.incomeTypeUI === "none" ? 0 : d.incomeMan * MAN,
    monthlyInvestable: d.monthlyMan * MAN,
    horizonYears: d.horizonYears,
    asOf: todayISO(),
    hasPension: d.hasPension,
    pensionContribution: d.pensionContributionMan * MAN,
    hasIrp: d.hasIrp,
    irpContribution: d.irpContributionMan * MAN,
    hasIsa: d.hasIsa,
    investTypes: d.investTypes as InvestType[],
    overseasHoldings: overseas,
    overseasUnrealizedProfit: overseas
      ? Math.max(0, overseas.marketValue - overseas.costBasis)
      : undefined,
    financialIncome: d.financialIncomeMan * MAN,
    dividendIncome: d.dividendIncomeMan * MAN,
    holdsHighDividend: d.holdsHighDividend,
    hasSpouse: d.hasSpouse,
    hasChildren: d.hasChildren,
    hasMinorChildren: d.hasMinorChildren,
    householdMedianPct: d.householdMedianPct,
  };
}
