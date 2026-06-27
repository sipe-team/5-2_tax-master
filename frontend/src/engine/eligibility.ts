import type { Eligibility, Product, ProductVariant, UserProfile } from "../rules/schema";
import { confirmed } from "./confirmed";
import type { Badge } from "./types";

/** 가구중위소득 미입력 시, 이 임계값 이상은 통과로 간주(포용). 미만은 미통과(보수). (DESIGN Q16) */
const GENEROUS_HOUSEHOLD_MEDIAN_PCT = 200;

/** 자격 게이트(상품 가입 가부) 판정. 금액 등급(variant)은 별도. */
function checkGate(
  e: Eligibility,
  user: UserProfile,
): { ok: boolean; reason?: string; badges: Badge[] } {
  const badges: Badge[] = [];

  if (e.ageMin !== undefined && user.age < e.ageMin)
    return { ok: false, reason: `만 ${e.ageMin}세 이상`, badges };
  if (e.ageMax !== undefined && user.age > e.ageMax)
    return { ok: false, reason: `만 ${e.ageMax}세 이하`, badges };

  const cap = confirmed(e.incomeCap?.[user.incomeType]);
  if (cap !== undefined && user.income > cap)
    return {
      ok: false,
      reason: `${user.incomeType === "earned" ? "총급여" : "종합소득"} ${(cap / 10_000).toLocaleString()}만 이하`,
      badges,
    };

  if (e.requiresIncome && user.income <= 0) return { ok: false, reason: "소득 있는 자", badges };

  // 금소세 대상 여부: 미입력이면 비대상 가정(포용) + 배지.
  if (e.excludeFinanceTopTaxpayer) {
    if (user.isFinanceTopTaxpayer === true)
      return { ok: false, reason: "금융소득종합과세 대상자 제외", badges };
    if (user.isFinanceTopTaxpayer === undefined)
      badges.push({ kind: "assumed", text: "금융소득종합과세 비대상으로 가정" });
  }

  // 가구중위소득 게이트: 미입력이면 관대한 임계값(>=200%)만 통과 가정.
  const hcap = confirmed(e.householdMedianPctMax);
  if (hcap !== undefined) {
    if (user.householdMedianPct !== undefined) {
      if (user.householdMedianPct > hcap)
        return { ok: false, reason: `가구중위소득 ${hcap}% 이하`, badges };
    } else if (hcap >= GENEROUS_HOUSEHOLD_MEDIAN_PCT) {
      badges.push({ kind: "assumed", text: `가구중위소득 ${hcap}% 이하로 가정` });
    } else {
      return { ok: false, reason: `가구중위소득 ${hcap}% 이하(확인 필요)`, badges };
    }
  }

  return { ok: true, badges };
}

/** variant(상위 등급)를 적용할지 — 알 수 있는 정보만으로 충족돼야 적용(보수). 못 하면 upsell. */
function variantQualifies(v: ProductVariant, user: UserProfile): { ok: boolean; badges: Badge[] } {
  const badges: Badge[] = [];
  const e = v.eligibility;

  const cap = confirmed(e.incomeCap?.[user.incomeType]);
  if (cap !== undefined && user.income > cap) return { ok: false, badges };

  const hcap = confirmed(e.householdMedianPctMax);
  if (hcap !== undefined) {
    if (user.householdMedianPct !== undefined) {
      if (user.householdMedianPct > hcap) return { ok: false, badges };
    } else if (hcap < GENEROUS_HOUSEHOLD_MEDIAN_PCT) {
      // 더 좋은 등급의 엄격한 게이트는 가정하지 않음 → 업셀 (Q16)
      return {
        ok: false,
        badges: [
          { kind: "upsell", text: `가구중위소득 ${hcap}% 이하면 '${v.name}' 등급 적용 가능` },
        ],
      };
    }
  }
  return { ok: true, badges };
}

export interface ResolvedProduct {
  product: Product;
  variant?: ProductVariant;
  /** 적용 등급의 혜택(variant가 있으면 그것, 없으면 base). */
  badges: Badge[];
}

/**
 * 사용자에게 적용되는 상품+등급 확정.
 * 자격 게이트 실패 → null. 통과하면 자격 충족하는 최상위 등급 선택(+ 업셀 배지).
 */
export function resolveProduct(
  product: Product,
  user: UserProfile,
): { resolved: ResolvedProduct | null; reason?: string } {
  const gate = checkGate(product.eligibility, user);
  if (!gate.ok) return { resolved: null, reason: gate.reason };

  const badges = [...gate.badges];
  let chosen: ProductVariant | undefined;

  for (const v of product.variants ?? []) {
    const q = variantQualifies(v, user);
    badges.push(...q.badges);
    if (q.ok) chosen = v; // variants는 좋은 순서대로 — 마지막 통과가 최상위
  }

  return { resolved: { product, variant: chosen, badges } };
}
