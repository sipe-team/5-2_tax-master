import type { RuleSet } from "../rules/schema";
import { confirmed } from "./confirmed";
import { totalAnnualAmount, totalFirstYearBenefit } from "./recommendation-summary";
import type { Recommendation } from "./types";

/**
 * N년 후 격차 (와우모먼트): 같은 돈을 "절세계좌 워터폴"에 넣었을 때 vs
 * "일반계좌"에 넣었을 때 누적 자산 차이를 연도별로 시뮬레이션한다.
 *
 * 정직성 원칙(DESIGN Q12 — 자문 아닌 규칙 계산기):
 * - 숨은 수익률은 엔진 공통 가정(연 6%, assumedReturnRate)을 양쪽에 동일 적용.
 * - 두 경로의 차이는 오직 "세금"에서만 발생한다(수익률 우위를 가정하지 않음):
 *     · 일반계좌: 매년 운용수익에 일반 금융소득세(15.4%) 과세.
 *     · 절세계좌: 첫 해 세액·소득공제(환급)를 재투자된 원금처럼 더하고,
 *                 운용수익은 비과세/분리과세라 과세하지 않음(보수적으로 전액 비과세 처리).
 * - 결정론: Date/랜덤 미사용. 같은 입력 → 같은 수열(테스트 가능).
 *
 * 한계(과대약속 방지): 세액공제는 첫 해 1회만 반영(연금 추가납입 반복공제 미가정),
 * 연금 수령 시 연금소득세·중도해지 페널티는 미반영 → "운용 단계 누적"의 근사치다.
 */

interface GapPoint {
  year: number; // 0..horizon
  taxed: number; // 일반계좌 누적 자산(원)
  sheltered: number; // 절세계좌 누적 자산(원)
}

export interface GapProjection {
  horizonYears: number;
  points: GapPoint[];
  /** 마지막 해 격차(절세 − 일반, 원). */
  finalGap: number;
  returnRate: number;
  taxRate: number;
}

export function projectGap(
  rec: Recommendation,
  monthlyInvestable: number,
  horizonYears: number,
  rules: RuleSet,
): GapProjection {
  const ret = confirmed(rules.constants.assumedReturnRate) ?? 0.06;
  const taxRate = rules.constants.financialIncomeTaxRate;

  const annualContribution = monthlyInvestable * 12;
  // 절세 경로로 실제 들어가는 연 납입(워터폴 배분 합). 남는 돈은 양쪽 동일하게 일반 취급.
  const shelteredAnnual = totalAnnualAmount(rec.waterfall);
  // 첫 해 환급(세액·소득공제) — 절세 경로에서 재투자되는 추가 원금.
  const firstYearRefund = totalFirstYearBenefit(rec.waterfall);

  const points: GapPoint[] = [{ year: 0, taxed: 0, sheltered: 0 }];

  let taxed = 0;
  let sheltered = 0;
  const horizon = Math.max(0, Math.round(horizonYears));

  for (let y = 1; y <= horizon; y++) {
    // 일반계좌: 올해 납입 추가 → 운용수익 과세(세후 수익만 복리).
    taxed = (taxed + annualContribution) * (1 + ret * (1 - taxRate));

    // 절세계좌: 절세 배분분은 비과세 복리, 나머지(leftover)는 일반계좌처럼 과세.
    const leftover = Math.max(0, annualContribution - shelteredAnnual);
    const shelteredPart = (Math.max(0, sheltered) + shelteredAnnual) * (1 + ret);
    const taxedPart = leftover * (1 + ret * (1 - taxRate));
    sheltered = shelteredPart + taxedPart;
    // 첫 해엔 환급액이 원금처럼 한 번 더해진다.
    if (y === 1) sheltered += firstYearRefund;

    points.push({ year: y, taxed: Math.round(taxed), sheltered: Math.round(sheltered) });
  }

  const last = points[points.length - 1];
  return {
    horizonYears: horizon,
    points,
    finalGap: Math.round(last.sheltered - last.taxed),
    returnRate: ret,
    taxRate,
  };
}
