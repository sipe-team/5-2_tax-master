import type { Sourced } from "../rules/schema";

/**
 * 확정(confirmed) 값만 읽는다. 추진(proposed)이면 undefined.
 * 엔진의 모든 계산은 이 게이트를 통과한 값으로만 한다. (DESIGN Q11)
 */
export function confirmed<T>(s: Sourced<T> | undefined): T | undefined {
  if (!s) return undefined;
  return s.status === "confirmed" ? s.value : undefined;
}

/** 시행일/종료일이 기준일에 유효한지. */
export function activeOn(s: Sourced<unknown>, asOf: string): boolean {
  if (s.effectiveFrom && asOf < s.effectiveFrom) return false;
  if (s.effectiveTo && asOf > s.effectiveTo) return false;
  return true;
}
