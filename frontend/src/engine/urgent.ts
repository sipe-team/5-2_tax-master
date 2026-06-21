import type { RuleSet, UserProfile } from "../rules/schema";
import { confirmed } from "./confirmed";
import { effectiveBenefit } from "./benefit";
import type { ResolvedProduct } from "./eligibility";
import type { UrgentAction } from "./types";

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

/** 긴급 트랙: 마감 임박 일회성 액션 (DESIGN Q9). */
export function buildUrgent(
  resolved: ResolvedProduct[],
  user: UserProfile,
  _rules: RuleSet,
): UrgentAction[] {
  const out: UrgentAction[] = [];

  for (const r of resolved) {
    const p = r.product;

    // 신청창(청년적금 등)
    const app = p.window?.application;
    if (app && user.asOf <= app.close) {
      out.push({
        productId: p.id,
        name: p.name,
        deadline: app.close,
        dDay: daysBetween(user.asOf, app.close),
        description: `신청 기간 ${app.open} ~ ${app.close}. 놓치면 다음 회차까지 대기.`,
        badges: r.badges,
      });
    }

    // RIA: 날짜별 감면율 절벽 (기존 보유 해외주식 있을 때만)
    const b = effectiveBenefit(r);
    if (b.kind === "capGainsReduction" && user.overseasHoldings) {
      const cliff = b.schedule.find((s) => user.asOf <= s.until);
      const rate = cliff ? confirmed(cliff.rate) : undefined;
      if (cliff && rate !== undefined) {
        out.push({
          productId: p.id,
          name: p.name,
          deadline: cliff.until,
          dDay: daysBetween(user.asOf, cliff.until),
          description: `현재 감면율 ${(rate * 100).toFixed(0)}%. ${cliff.until} 이후 하락.`,
          estimatedBenefit: estimateRiaBenefit(b, rate, user),
          badges: [...r.badges, { kind: "info", text: "기존 보유 해외주식 기준 추정치" }],
        });
      }
    }
  }

  out.sort((a, c) => a.dDay - c.dDay);
  return out;
}

function estimateRiaBenefit(
  b: Extract<ReturnType<typeof effectiveBenefit>, { kind: "capGainsReduction" }>,
  rate: number,
  user: UserProfile,
): number | undefined {
  const h = user.overseasHoldings;
  if (!h) return undefined;
  const baseRate = confirmed(b.baseTaxRate);
  const exempt = confirmed(b.annualExempt);
  const cap = confirmed(b.benefitCapBySaleAmount);
  if (baseRate === undefined || exempt === undefined || cap === undefined) return undefined;

  const gain = Math.max(0, h.marketValue - h.costBasis);
  const ratio = h.marketValue > 0 ? Math.min(1, cap / h.marketValue) : 0;
  const eligibleGain = gain * ratio;
  const taxable = Math.max(0, eligibleGain - exempt);
  return Math.round(taxable * baseRate * rate);
}
