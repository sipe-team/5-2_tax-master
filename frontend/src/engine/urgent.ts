import type { UserProfile } from "../rules/schema";
import { confirmed } from "./confirmed";
import { effectiveBenefit } from "./benefit";
import type { ResolvedProduct } from "./eligibility";
import { type ActionCard, URGENCY_WEIGHT } from "./types";

const MAN = 10_000;
/** 마감 임박 일회성 액션의 기본 점수 바닥(절세효과 추정 불가 시). */
const IMMEDIATE_BASE_MANWON = 300;

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

function immediateScore(benefit: number | null): number {
  const manwon = benefit != null ? benefit / MAN : IMMEDIATE_BASE_MANWON;
  return Math.round(Math.max(manwon, IMMEDIATE_BASE_MANWON) * URGENCY_WEIGHT.immediate * 10) / 10;
}

/** 마감 임박 일회성 액션 (청년적금 신청창 · RIA 감면 절벽) — DESIGN Q9. */
export function buildUrgentActions(resolved: ResolvedProduct[], user: UserProfile): ActionCard[] {
  const out: ActionCard[] = [];

  for (const r of resolved) {
    const p = r.product;

    // 신청창(청년적금 등)
    const app = p.window?.application;
    if (app && user.asOf <= app.close) {
      out.push({
        id: `urgent-${p.id}`,
        name: p.name,
        category: "마감 임박",
        urgency: "immediate",
        score: immediateScore(null),
        estimatedBenefit: null,
        reason: `신청 기간 ${app.open} ~ ${app.close}. 놓치면 다음 회차까지 대기.`,
        action: "기간 내 신청",
        warning: null,
        deadline: app.close,
        dDay: daysBetween(user.asOf, app.close),
        badges: r.badges,
      });
    }

    // RIA: 날짜별 감면율 절벽 (기존 보유 해외주식 있을 때만)
    const b = effectiveBenefit(r);
    if (b.kind === "capGainsReduction" && user.overseasHoldings) {
      const cliff = b.schedule.find((s) => user.asOf <= s.until);
      const rate = cliff ? confirmed(cliff.rate) : undefined;
      if (cliff && rate !== undefined) {
        const benefit = estimateRiaBenefit(b, rate, user);
        out.push({
          id: `urgent-${p.id}`,
          name: p.name,
          category: "마감 임박",
          urgency: "immediate",
          score: immediateScore(benefit),
          estimatedBenefit: benefit,
          reason: `현재 감면율 ${(rate * 100).toFixed(0)}%. ${cliff.until} 이후 하락.`,
          action: "해외주식 매도 후 국내 재투자",
          warning: "환전일로부터 1년 내 인출 시 감면 취소",
          deadline: cliff.until,
          dDay: daysBetween(user.asOf, cliff.until),
          badges: [...r.badges, { kind: "info", text: "기존 보유 해외주식 기준 추정치" }],
        });
      }
    }
  }

  return out;
}

function estimateRiaBenefit(
  b: Extract<ReturnType<typeof effectiveBenefit>, { kind: "capGainsReduction" }>,
  rate: number,
  user: UserProfile,
): number | null {
  const h = user.overseasHoldings;
  if (!h) return null;
  const baseRate = confirmed(b.baseTaxRate);
  const exempt = confirmed(b.annualExempt);
  const cap = confirmed(b.benefitCapBySaleAmount);
  if (baseRate === undefined || exempt === undefined || cap === undefined) return null;

  const gain = Math.max(0, h.marketValue - h.costBasis);
  const ratio = h.marketValue > 0 ? Math.min(1, cap / h.marketValue) : 0;
  const eligibleGain = gain * ratio;
  const taxable = Math.max(0, eligibleGain - exempt);
  return Math.round(taxable * baseRate * rate);
}
