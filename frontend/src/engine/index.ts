import type { RuleSet, UserProfile } from "../rules/schema";
import { resolveProduct, type ResolvedProduct } from "./eligibility";
import { buildWaterfall } from "./waterfall";
import { buildUrgentActions } from "./urgent";
import { buildStrategyActions } from "./strategies";
import type { ActionCard, Badge, Recommendation } from "./types";

export * from "./types";
export { diffScenarios } from "./scenario";
export { googleCalendarUrl } from "./calendar";
export { buildCliffChart } from "./cliff";
export type { CliffChart } from "./cliff";
export { projectGap } from "./gap";
export type { GapProjection } from "./gap";
export {
  splitWaterfallAndStrategyActions,
  totalAnnualAmount,
  totalFirstYearBenefit,
  totalMaxBenefitWon,
  totalMonthlyAmount,
} from "./recommendation-summary";

const FINANCE_TOP_THRESHOLD = 20_000_000; // §10 금소세 2,000만

const DISCLAIMERS = [
  "정보 제공 목적이며 투자·세무 자문이 아닙니다.",
  "가입·신고 전 국세청·금융위 등 공식 자료와 전문가 확인이 필요합니다.",
];

/** financialIncome가 있으면 금소세 대상 여부를 도출(미입력 우선). (§10) */
function withDerivedFlags(user: UserProfile): UserProfile {
  if (user.isFinanceTopTaxpayer === undefined && user.financialIncome !== undefined) {
    return { ...user, isFinanceTopTaxpayer: user.financialIncome > FINANCE_TOP_THRESHOLD };
  }
  return user;
}

/** 한 상품이 '활성'인가(상호작용 판정용). 기존자산 상품은 보유분 필요. */
function isActive(r: ResolvedProduct, user: UserProfile): boolean {
  if (r.product.oneTimeOnExistingAssets) return !!user.overseasHoldings;
  return true;
}

export function recommend(rawUser: UserProfile, rules: RuleSet): Recommendation {
  const user = withDerivedFlags(rawUser);

  // 1) 자격 게이트 통과 상품만 (등급 확정).
  const resolved: ResolvedProduct[] = [];
  for (const p of rules.products) {
    const { resolved: r } = resolveProduct(p, user);
    if (r) resolved.push(r);
  }

  // 2) 상호작용: 활성 상품이 억제하는 대상 수집 (Q10).
  const suppressed = new Set<string>();
  for (const itx of rules.interactions) {
    if (itx.kind !== "suppress") continue;
    const trigger = resolved.find((r) => r.product.id === itx.whenActive);
    if (trigger && isActive(trigger, user)) suppressed.add(itx.suppress);
  }

  // 3) 액션 트랙 = 마감 임박(긴급) + 상황별 전략, 점수순. (PRD Decision B)
  const actions: ActionCard[] = [
    ...buildUrgentActions(resolved, user),
    ...buildStrategyActions(user),
  ].sort((a, b) => b.score - a.score);

  // 4) 워터폴(그릇 적립 배분).
  const { allocations, leftoverMonthly, excluded } = buildWaterfall(
    resolved,
    user,
    rules,
    suppressed,
  );

  // 5) 가정/제외를 정보 배지로 모음.
  const assumptions: Badge[] = dedupeBadges(allocations.flatMap((a) => a.badges));
  for (const ex of excluded)
    assumptions.push({ kind: "info", text: `${ex.name} 제외: ${ex.reason}` });

  return {
    asOf: user.asOf,
    actions,
    waterfall: allocations,
    leftoverMonthly,
    assumptions,
    disclaimers: DISCLAIMERS,
  };
}

function dedupeBadges(badges: Badge[]): Badge[] {
  const seen = new Set<string>();
  const out: Badge[] = [];
  for (const b of badges) {
    const key = `${b.kind}:${b.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}
