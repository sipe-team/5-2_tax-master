/**
 * 자산 형성 시뮬레이션 (적립 → 미래가치).
 *
 * 순수 함수. 워터폴 추천(rec)과 사용자 입력으로 "이대로 모으면 언제 얼마"를 계산한다.
 *
 * ⚠️ 가정(정직 고지 필수):
 * - 숨은 수익률 = rules.constants.assumedReturnRate(기본 연 6%, DESIGN Q3) 고정.
 * - 매달 말 적립, 월 복리 환산. 명목값(세전·수수료/물가 미반영).
 * - 연 절세액은 매년 동일하게 반복된다고 단순 가정(첫 해 워터폴 기준).
 */

import type { RuleSet, UserProfile } from "../rules/schema";
import { confirmed } from "./confirmed";
import type { Recommendation } from "./types";

export interface ProjectionPoint {
  year: number;
  contributed: number; // 원금 누계
  balance: number; // 평가액(원금+수익)
}

export interface WealthProjection {
  monthlyTotal: number; // 월 적립액(전액)
  annualReturnRate: number; // 가정 수익률
  horizonYears: number;
  totalContributed: number; // 원금 누계
  projectedBalance: number; // horizon 시점 평가액
  growth: number; // 수익(평가액 - 원금)
  annualTaxBenefit: number; // 연 절세액(워터폴 첫 해)
  monthlyTaxBenefit: number; // 절세로 생기는 월 추가 저축 여력(연 절세액/12)
  cumulativeTaxBenefit: number; // 절세액 누계(연 × 기간)
  /** 절세 환급분을 매년 재투자했을 때의 평가액. */
  balanceWithReinvestedTaxBenefit: number;
  schedule: ProjectionPoint[]; // 마일스톤 연도별
}

/** 월 적립 r(월수익률) 기준 적립식 미래가치(기말 적립). */
function fvAnnuity(monthly: number, monthlyRate: number, months: number): number {
  if (months <= 0) return 0;
  if (monthlyRate <= 0) return monthly * months;
  return monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

function totalAnnualTaxBenefit(rec: Recommendation): number {
  return rec.waterfall.reduce((s, a) => s + a.firstYearBenefit, 0);
}

export function projectWealth(
  rec: Recommendation,
  user: UserProfile,
  rules: RuleSet,
  /** 가정 수익률 직접 지정(연, 소수). 미지정이면 rules 기본값(6%). */
  returnRateOverride?: number,
): WealthProjection {
  const monthly = user.monthlyInvestable;
  const annual = returnRateOverride ?? confirmed(rules.constants.assumedReturnRate) ?? 0.06;
  const r = Math.pow(1 + annual, 1 / 12) - 1;
  const years = Math.max(0, user.horizonYears);
  const months = Math.round(years * 12);

  const totalContributed = monthly * months;
  const projectedBalance = Math.round(fvAnnuity(monthly, r, months));
  const growth = projectedBalance - totalContributed;

  const annualTaxBenefit = totalAnnualTaxBenefit(rec);
  const cumulativeTaxBenefit = annualTaxBenefit * years;
  const fvTax =
    annual > 0
      ? annualTaxBenefit * ((Math.pow(1 + annual, years) - 1) / annual)
      : annualTaxBenefit * years;
  const balanceWithReinvestedTaxBenefit = Math.round(projectedBalance + fvTax);

  // 마일스톤 연도(1·3·5·10·20·horizon 중 horizon 이하).
  const milestones = [...new Set([1, 3, 5, 10, 20, years])]
    .filter((y) => y > 0 && y <= years)
    .sort((a, b) => a - b);
  const schedule: ProjectionPoint[] = milestones.map((y) => {
    const m = Math.round(y * 12);
    return { year: y, contributed: monthly * m, balance: Math.round(fvAnnuity(monthly, r, m)) };
  });

  return {
    monthlyTotal: monthly,
    annualReturnRate: annual,
    horizonYears: years,
    totalContributed,
    projectedBalance,
    growth,
    annualTaxBenefit,
    monthlyTaxBenefit: Math.round(annualTaxBenefit / 12),
    cumulativeTaxBenefit,
    balanceWithReinvestedTaxBenefit,
    schedule,
  };
}

/**
 * 목표 금액 도달까지 걸리는 개월 수(적립식, 가정 수익률).
 * 도달 불가(월적립 0 등)면 Infinity.
 */
export function monthsToReach(target: number, monthly: number, annualReturnRate: number): number {
  if (target <= 0) return 0;
  if (monthly <= 0) return Infinity;
  const r = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
  if (r <= 0) return Math.ceil(target / monthly);
  // target = monthly * ((1+r)^n - 1)/r  →  n = log(target*r/monthly + 1)/log(1+r)
  const n = Math.log((target * r) / monthly + 1) / Math.log(1 + r);
  return Math.ceil(n);
}
