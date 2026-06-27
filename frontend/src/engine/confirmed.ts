import type { Sourced } from "../rules/schema";

/**
 * 확정(confirmed) 값만 읽는다. 추진(proposed)이면 undefined.
 * 엔진의 모든 계산은 이 게이트를 통과한 값으로만 한다. (DESIGN Q11)
 */
export function confirmed<T>(s: Sourced<T> | undefined): T | undefined {
  if (!s) return undefined;
  return s.status === "confirmed" ? s.value : undefined;
}
