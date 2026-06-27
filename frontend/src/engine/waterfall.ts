import type { Lockup, RuleSet, UserProfile } from "../rules/schema";
import { confirmed } from "./confirmed";
import type { ResolvedProduct } from "./eligibility";
import { tranchesFor, type Tranche } from "./benefit";
import type { Allocation } from "./types";

export interface Excluded {
  name: string;
  reason: string;
}

/** 락업이 사용자 기간(목표 시점)을 넘으면 제외. (DESIGN Q14) */
export function lockupExceedsHorizon(lockup: Lockup | undefined, user: UserProfile): string | null {
  if (!lockup) return null;
  if (lockup.untilAge !== undefined) {
    const lockYears = lockup.untilAge - user.age;
    if (lockYears > user.horizonYears)
      return `${lockup.untilAge}세까지 인출 불가(약 ${lockYears}년 > 기간 ${user.horizonYears}년)`;
  }
  if (lockup.minYears !== undefined && lockup.minYears > user.horizonYears)
    return `의무 보유 ${lockup.minYears}년 > 기간 ${user.horizonYears}년`;
  return null;
}

function poolFillIndex(rules: RuleSet): Map<string, number> {
  const idx = new Map<string, number>();
  for (const pool of rules.pools) pool.fillOrder.forEach((pid, i) => idx.set(pid, i));
  return idx;
}

export interface WaterfallResult {
  allocations: Allocation[];
  leftoverMonthly: number;
  excluded: Excluded[];
}

export function buildWaterfall(
  resolved: ResolvedProduct[],
  user: UserProfile,
  rules: RuleSet,
  suppressed: Set<string>,
): WaterfallResult {
  const excluded: Excluded[] = [];
  const fillIdx = poolFillIndex(rules);

  // 워터폴 대상 필터 (일회성/억제/락업 제외).
  const eligible: ResolvedProduct[] = [];
  for (const r of resolved) {
    if (r.product.oneTimeOnExistingAssets) continue;
    if (suppressed.has(r.product.id)) {
      excluded.push({
        name: r.product.name,
        reason: "RIA 감면과 충돌해 제외(신규 해외주식 매수 억제)",
      });
      continue;
    }
    const lock = lockupExceedsHorizon(r.product.lockup, user);
    if (lock) {
      excluded.push({ name: r.product.name, reason: lock });
      continue;
    }
    eligible.push(r);
  }

  // 트랜치 수집 + 정렬(효율 desc, 동률은 풀 fillOrder asc).
  const tranches = eligible.flatMap((r) => tranchesFor(r, user, rules));
  tranches.sort((a, b) => {
    if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
    return (fillIdx.get(a.productId) ?? 99) - (fillIdx.get(b.productId) ?? 99);
  });

  // 그릇별 연 한도(전체 트랜치 합) — 채움 비율 표시용.
  const capByProduct = new Map<string, number>();
  for (const t of tranches)
    capByProduct.set(t.productId, (capByProduct.get(t.productId) ?? 0) + t.annualCap);

  // 그리디 채우기.
  let budget = user.monthlyInvestable * 12;
  const poolRemaining = new Map<string, number>();
  for (const pool of rules.pools) {
    const cap = confirmed(pool.annualCreditCap);
    if (cap !== undefined) poolRemaining.set(pool.id, cap);
  }

  const byProduct = new Map<
    string,
    { r: ResolvedProduct; annual: number; benefit: number; tranches: Tranche[] }
  >();

  for (const t of tranches) {
    if (budget <= 0) break;
    let alloc = Math.min(t.annualCap, budget);
    if (t.poolId && poolRemaining.has(t.poolId)) {
      alloc = Math.min(alloc, poolRemaining.get(t.poolId)!);
      poolRemaining.set(t.poolId, poolRemaining.get(t.poolId)! - alloc);
    }
    if (alloc <= 0) continue;
    budget -= alloc;

    const r = eligible.find((x) => x.product.id === t.productId)!;
    const agg = byProduct.get(t.productId) ?? { r, annual: 0, benefit: 0, tranches: [] };
    agg.annual += alloc;
    agg.benefit += alloc * t.efficiency;
    agg.tranches.push(t);
    byProduct.set(t.productId, agg);
  }

  const allocations: Allocation[] = [...byProduct.values()].map((a) => ({
    productId: a.r.product.id,
    variantId: a.r.variant?.id,
    name: a.r.variant ? `${a.r.product.name} (${a.r.variant.name})` : a.r.product.name,
    monthlyAmount: Math.round(a.annual / 12),
    annualAmount: a.annual,
    annualCap: capByProduct.get(a.r.product.id) ?? a.annual,
    efficiency: a.benefit / a.annual,
    firstYearBenefit: Math.round(a.benefit),
    rationale: a.tranches.map((t) => t.rationale).join(" · "),
    badges: a.r.badges,
  }));
  // 효율 높은 순(=채운 순) 유지.
  allocations.sort((x, y) => y.efficiency - x.efficiency);

  return { allocations, leftoverMonthly: Math.round(budget / 12), excluded };
}
