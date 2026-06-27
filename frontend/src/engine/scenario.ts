/**
 * 이직/연봉 변화 시나리오 diff (DESIGN_ROCKETPUNCH §4.2).
 *
 * 순수 함수 — API 불요. 기존 결정론 엔진을 "현재 연소득"과 "가정 연소득"으로
 * 두 번 돌려, 무엇이 어떻게 달라지는지(자격 획득/상실·효율 변화·세제혜택 차이)를 계산한다.
 *
 * 핵심: 자격 획득/상실은 **워터폴 편입 여부가 아니라 자격 게이트(resolveProduct)** 기준으로
 * 판정한다. 예산이 작아 워터폴에 안 담겨도 "자격은 있다"가 정확하기 때문.
 * 효율(efficiency)은 **상품 본연의 한계효율(tranche 기준)** 으로 본다(예산 도달 여부와 무관).
 */

import type { IncomeType, RuleSet, UserProfile } from "../rules/schema";
import { marginalRate, tranchesFor } from "./benefit";
import { resolveProduct } from "./eligibility";
import { recommend } from "./index";
import type { Recommendation } from "./types";

export type ShiftStatus = "gained" | "lost" | "changed" | "same";

/** 한 상품의 시나리오 전후 스냅샷 비교. */
export interface ProductShift {
  productId: string;
  /** 표시용 이름(시나리오 기준, 잃었으면 현재 기준). */
  name: string;
  status: ShiftStatus;
  /** 상품 본연 한계효율(투입 1원당 첫 해 세제혜택). 자격 없으면 undefined. */
  fromEfficiency?: number;
  toEfficiency?: number;
  /** 적용 등급(서민형/우대형 등) id. 변동 감지용. */
  fromVariantId?: string;
  toVariantId?: string;
  /** 실제 워터폴에 담긴 월 적립액(예산 의존). 표시용 보조. */
  fromFundedMonthly?: number;
  toFundedMonthly?: number;
}

export interface ScenarioDelta {
  baseIncome: number;
  scenarioIncome: number;
  /** 가정 소득유형(직장인/사업·기타). 미지정이면 현재와 동일. */
  scenarioIncomeType: IncomeType;
  incomeTypeChanged: boolean;
  /** 현재/가정 각각의 전체 추천(필요 시 2열 풀 렌더용). */
  base: Recommendation;
  scenario: Recommendation;
  /** 한계세율 변화 (ISA 소득공제 효율 등의 근본 동인). */
  marginalRateChange: { from: number; to: number };
  /** 가정 연소득에서 새로 자격을 얻는 상품 id. */
  gained: string[];
  /** 가정 연소득에서 자격을 잃는 상품 id ("지금 가입 안 하면 자격 상실" 후크). */
  lost: string[];
  /** 자격/효율/등급이 달라진 상품(같음 포함 전체). */
  shifts: ProductShift[];
  /** 워터폴 기준 첫 해 총 세제혜택(실제 적립 기준). */
  baseFirstYearBenefit: number;
  scenarioFirstYearBenefit: number;
  netFirstYearBenefitChange: number;
}

interface ProductSnapshot {
  eligible: boolean;
  name: string;
  variantId?: string;
  topEfficiency?: number;
  fundedMonthly?: number;
}

function totalFirstYearBenefit(rec: Recommendation): number {
  return rec.waterfall.reduce((s, a) => s + a.firstYearBenefit, 0);
}

/** 한 연소득에서의 상품별 스냅샷(자격·등급·본연효율·실적립). */
function snapshot(
  user: UserProfile,
  rules: RuleSet,
): { rec: Recommendation; map: Map<string, ProductSnapshot> } {
  const rec = recommend(user, rules);
  const funded = new Map(rec.waterfall.map((a) => [a.productId, a.monthlyAmount]));
  const map = new Map<string, ProductSnapshot>();

  for (const p of rules.products) {
    const { resolved } = resolveProduct(p, user);
    if (!resolved) {
      map.set(p.id, { eligible: false, name: p.name });
      continue;
    }
    const tranches = tranchesFor(resolved, user, rules);
    const topEfficiency = tranches.length
      ? Math.max(...tranches.map((t) => t.efficiency))
      : undefined;
    map.set(p.id, {
      eligible: true,
      name: resolved.variant ? `${p.name} (${resolved.variant.name})` : p.name,
      variantId: resolved.variant?.id,
      topEfficiency,
      fundedMonthly: funded.get(p.id),
    });
  }
  return { rec, map };
}

const EPS = 1e-9;

export function diffScenarios(
  user: UserProfile,
  scenarioIncome: number,
  rules: RuleSet,
  scenarioIncomeType?: IncomeType,
): ScenarioDelta {
  const incomeType = scenarioIncomeType ?? user.incomeType;
  const baseSnap = snapshot(user, rules);
  const scenSnap = snapshot({ ...user, income: scenarioIncome, incomeType }, rules);

  const gained: string[] = [];
  const lost: string[] = [];
  const shifts: ProductShift[] = [];

  for (const p of rules.products) {
    const b = baseSnap.map.get(p.id)!;
    const s = scenSnap.map.get(p.id)!;

    let status: ShiftStatus;
    if (!b.eligible && s.eligible) {
      status = "gained";
      gained.push(p.id);
    } else if (b.eligible && !s.eligible) {
      status = "lost";
      lost.push(p.id);
    } else if (b.eligible && s.eligible) {
      const variantChanged = b.variantId !== s.variantId;
      const effChanged =
        b.topEfficiency !== undefined &&
        s.topEfficiency !== undefined &&
        Math.abs(b.topEfficiency - s.topEfficiency) > EPS;
      status = variantChanged || effChanged ? "changed" : "same";
    } else {
      status = "same"; // 둘 다 자격 없음
    }

    shifts.push({
      productId: p.id,
      name: s.eligible ? s.name : b.name,
      status,
      fromEfficiency: b.topEfficiency,
      toEfficiency: s.topEfficiency,
      fromVariantId: b.variantId,
      toVariantId: s.variantId,
      fromFundedMonthly: b.fundedMonthly,
      toFundedMonthly: s.fundedMonthly,
    });
  }

  const baseFirstYearBenefit = totalFirstYearBenefit(baseSnap.rec);
  const scenarioFirstYearBenefit = totalFirstYearBenefit(scenSnap.rec);

  return {
    baseIncome: user.income,
    scenarioIncome,
    scenarioIncomeType: incomeType,
    incomeTypeChanged: incomeType !== user.incomeType,
    base: baseSnap.rec,
    scenario: scenSnap.rec,
    marginalRateChange: {
      from: marginalRate(user.income, rules.marginalRates),
      to: marginalRate(scenarioIncome, rules.marginalRates),
    },
    gained,
    lost,
    shifts,
    baseFirstYearBenefit,
    scenarioFirstYearBenefit,
    netFirstYearBenefitChange: scenarioFirstYearBenefit - baseFirstYearBenefit,
  };
}
