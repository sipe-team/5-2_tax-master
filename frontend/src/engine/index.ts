import type { RuleSet, UserProfile } from "../rules/schema";
import { resolveProduct, type ResolvedProduct } from "./eligibility";
import { buildWaterfall } from "./waterfall";
import { buildUrgent } from "./urgent";
import type { Badge, Recommendation } from "./types";

export * from "./types";
export { buildCalendar, downloadCalendar } from "./calendar";

const DISCLAIMERS = [
  "정보 제공 목적이며 투자·세무 자문이 아닙니다.",
  "가입·신고 전 국세청·금융위 등 공식 자료와 전문가 확인이 필요합니다.",
];

/** 한 상품이 '활성'인가(상호작용 판정용). 기존자산 상품은 보유분 필요. */
function isActive(r: ResolvedProduct, user: UserProfile): boolean {
  if (r.product.oneTimeOnExistingAssets) return !!user.overseasHoldings;
  return true;
}

export function recommend(user: UserProfile, rules: RuleSet): Recommendation {
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

  // 3) 긴급 트랙 + 4) 워터폴.
  const urgent = buildUrgent(resolved, user);
  const { allocations, leftoverMonthly, excluded } = buildWaterfall(resolved, user, rules, suppressed);

  // 5) 가정/제외를 정보 배지로 모음.
  const assumptions: Badge[] = dedupeBadges(allocations.flatMap((a) => a.badges));
  for (const ex of excluded) assumptions.push({ kind: "info", text: `${ex.name} 제외: ${ex.reason}` });

  return {
    asOf: user.asOf,
    urgent,
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
