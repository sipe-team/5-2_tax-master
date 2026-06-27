import type { ActionCard, Recommendation } from "./types";

// 결과 화면 표시용 파생 계산. recommend()의 출력에서 화면 단위로 다시 정리.
// (엔진은 도메인 로직만 두고 화면 분기 로직은 여기서 분리)

/**
 * 워터폴 그릇에 묶이는 긴급 액션(`urgent-<productId>`)은 그 그릇 행에 인라인 표시하고,
 * 그릇이 없는 순수 전략(증여·매도 등)과 RIA(워터폴 제외)는 별도 전략 섹션에 남긴다.
 */
export function splitWaterfallAndStrategyActions(rec: Recommendation): {
  strategyActions: ActionCard[];
  actionByProduct: Map<string, ActionCard>;
} {
  const waterfallIds = new Set(rec.waterfall.map((w) => w.productId));
  const actionByProduct = new Map<string, ActionCard>();
  const strategyActions = rec.actions.filter((a) => {
    const pid = a.id.startsWith("urgent-") ? a.id.slice("urgent-".length) : null;
    if (pid && waterfallIds.has(pid)) {
      actionByProduct.set(pid, a);
      return false;
    }
    return true;
  });
  return { strategyActions, actionByProduct };
}

/**
 * 사용자 화면에 표시되는 "최대 절세액" = 워터폴 첫 해 절세 합계 + 추정 가능한 액션 절감액 합계.
 * estimatedBenefit이 null인 액션(증여처럼 추정 불가)은 0으로 본다.
 */
export function totalMaxBenefitWon(rec: Recommendation): number {
  const waterfallBenefit = rec.waterfall.reduce((s, a) => s + a.firstYearBenefit, 0);
  const actionBenefit = rec.actions.reduce((s, a) => s + (a.estimatedBenefit ?? 0), 0);
  return waterfallBenefit + actionBenefit;
}
