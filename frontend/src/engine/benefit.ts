import type { Benefit, MarginalRateBracket, RuleSet, UserProfile } from "../rules/schema";
import { confirmed } from "./confirmed";
import type { ResolvedProduct } from "./eligibility";

/**
 * 트랜치 = "한계 효율이 일정한 납입 구간".
 * 상품을 트랜치로 쪼개면, 전 상품 트랜치를 효율순으로 채우는 그리디가
 * 분할가능 배낭문제와 동치라 *증명 가능하게 최적*이 된다. (DESIGN Q8)
 */
export interface Tranche {
  productId: string;
  poolId?: string;
  label: string;
  /** 투입 1원당 첫 해 세제혜택(원). */
  efficiency: number;
  /** 이 트랜치 연 납입 한도(원). */
  annualCap: number;
  rationale: string;
}

/** base 혜택에 variant 혜택(부분)을 덮어쓴 유효 혜택. */
export function effectiveBenefit(r: ResolvedProduct): Benefit {
  if (r.variant?.benefit) {
    return { ...r.product.benefit, ...r.variant.benefit } as Benefit;
  }
  return r.product.benefit;
}

export function marginalRate(income: number, brackets: MarginalRateBracket[]): number {
  for (const b of brackets) {
    const rate = confirmed(b.rate);
    if (rate !== undefined && income <= b.upTo) return rate;
  }
  return 0;
}

function annualCapOf(r: ResolvedProduct): number {
  const cap = r.product.contributionCap;
  if (!cap) return Infinity;
  const amount = confirmed(cap.amount);
  if (amount === undefined) return Infinity; // 추진(미확정) 한도는 무시
  return cap.period === "monthly" ? amount * 12 : amount;
}

/**
 * 워터폴 대상 상품의 트랜치 생성. capGainsReduction(RIA 기존자산)은 제외.
 */
export function tranchesFor(r: ResolvedProduct, user: UserProfile, rules: RuleSet): Tranche[] {
  const b = effectiveBenefit(r);
  const id = r.product.id;
  const poolId = r.product.poolId;
  const ret = confirmed(rules.constants.assumedReturnRate) ?? 0.06;
  const normal = rules.constants.financialIncomeTaxRate;
  const annualCap = annualCapOf(r);

  switch (b.kind) {
    case "taxCredit": {
      const rate = pickTaxCreditRate(b, user);
      const creditCap = confirmed(b.creditCap);
      if (rate === undefined || creditCap === undefined) return [];
      return [
        {
          productId: id,
          poolId,
          label: r.product.name,
          efficiency: rate,
          annualCap: creditCap,
          rationale: `납입액의 ${(rate * 100).toFixed(1)}% 즉시 세액공제`,
        },
      ];
    }

    case "incomeDeduction": {
      const rate = confirmed(b.rate);
      const dedCap = confirmed(b.deductionCap);
      if (rate === undefined || dedCap === undefined) return [];
      const mr = marginalRate(user.income, rules.marginalRates);
      const contributionForFullDeduction = dedCap / rate;
      return [
        {
          productId: id,
          poolId,
          label: r.product.name,
          efficiency: rate * mr,
          annualCap: Math.min(contributionForFullDeduction, annualCap),
          rationale: `납입액 ${(rate * 100).toFixed(0)}% 소득공제 × 한계세율 ${(mr * 100).toFixed(1)}%`,
        },
      ];
    }

    case "sepTax": {
      const exempt = confirmed(b.exemptLimit);
      const sep = confirmed(b.sepRate);
      if (exempt === undefined || sep === undefined) return [];
      const exemptContribution = Math.min(exempt / ret, annualCap);
      const out: Tranche[] = [
        {
          productId: id,
          poolId,
          label: `${r.product.name} (비과세 구간)`,
          efficiency: ret * b.normalRate,
          annualCap: exemptContribution,
          rationale: `운용수익 ${(exempt / 10_000).toLocaleString()}만까지 비과세`,
        },
      ];
      const rest = annualCap - exemptContribution;
      if (rest > 0)
        out.push({
          productId: id,
          poolId,
          label: `${r.product.name} (분리과세 구간)`,
          efficiency: ret * (b.normalRate - sep),
          annualCap: rest,
          rationale: `초과분 ${(sep * 100).toFixed(1)}% 분리과세(일반 ${(b.normalRate * 100).toFixed(1)}% 대비)`,
        });
      return out;
    }

    case "govMatch": {
      const match = confirmed(b.matchRate);
      if (match === undefined) return [];
      const taxExempt = confirmed(b.interestTaxExempt) ?? false;
      const baseRate = confirmed(b.baseInterestRate) ?? 0;
      const interestBenefit = taxExempt ? baseRate * normal : 0;
      const eff = match + interestBenefit;
      return [
        {
          productId: id,
          poolId,
          label: r.product.name,
          efficiency: eff,
          annualCap,
          rationale: `정부기여금 ${(match * 100).toFixed(0)}%${taxExempt ? " + 이자 비과세" : ""}`,
        },
      ];
    }

    case "capGainsExempt": {
      const exempt = confirmed(b.annualExempt);
      const taxRate = confirmed(b.taxRate);
      if (exempt === undefined || taxRate === undefined) return [];
      // 비과세 구간(연 250만 차익)만 세제 가치. 초과분은 일반계좌와 동일 → leftover.
      const exemptContribution = exempt / ret;
      return [
        {
          productId: id,
          poolId,
          label: `${r.product.name} (연 ${(exempt / 10_000).toLocaleString()}만 비과세)`,
          efficiency: ret * taxRate,
          annualCap: exemptContribution,
          rationale: `양도차익 ${(exempt / 10_000).toLocaleString()}만까지 ${(taxRate * 100).toFixed(0)}% 비과세`,
        },
      ];
    }

    case "capGainsReduction":
      return []; // RIA 기존자산 일회성 → 긴급 트랙
  }
}

function pickTaxCreditRate(
  b: Extract<Benefit, { kind: "taxCredit" }>,
  user: UserProfile,
): number | undefined {
  for (const row of b.rateByIncome) {
    if (row.incomeType !== user.incomeType) continue;
    const rate = confirmed(row.rate);
    if (rate !== undefined && user.income <= row.upTo) return rate;
  }
  return undefined;
}
