import { describe, expect, it } from "vitest";
import { ruleSet } from "../rules/products";
import { recommend } from "../engine";
import type { UserProfile } from "../rules/schema";
import { PERSONAS } from "../personas";

/** personas.ts의 평면 프리셋을 엔진 UserProfile로 (FunnelPage.applyPersona와 동일 매핑). */
function toProfile(id: string, asOf: string): UserProfile {
  const p = PERSONAS.find((x) => x.id === id)!;
  return {
    age: p.age,
    incomeType: p.incomeType,
    income: p.incomeMan * 10_000,
    monthlyInvestable: p.monthlyMan * 10_000,
    horizonYears: p.horizonYears,
    asOf,
    overseasHoldings: p.overseas
      ? { marketValue: p.overseas.valueMan * 10_000, costBasis: p.overseas.costMan * 10_000 }
      : undefined,
  };
}

// 청년적금 신청창(~2026-07-03) 안의 날짜로 고정해 데모/테스트 안정화.
const asOf = "2026-06-27";

describe("데모 페르소나 (와우모먼트)", () => {
  it("세 페르소나 모두 결과(워터폴 또는 긴급 액션)를 만든다 — 빈 화면 없음", () => {
    for (const p of PERSONAS) {
      const rec = recommend(toProfile(p.id, asOf), ruleSet);
      const immediateActions = rec.actions.filter((a) => a.urgency === "immediate");
      expect(rec.waterfall.length + immediateActions.length).toBeGreaterThan(0);
    }
  });

  it("사회초년생: 청년미래적금 긴급 트랙(D-day)이 뜬다", () => {
    const rec = recommend(toProfile("rookie", asOf), ruleSet);
    const youth = rec.actions.find((a) => a.id === "urgent-youth-future-savings");
    expect(youth).toBeDefined();
    expect(youth!.dDay).toBeGreaterThanOrEqual(0);
  });

  it("30대 직장인: 연금 워터폴(연금저축+IRP)이 핵심", () => {
    const rec = recommend(toProfile("worker", asOf), ruleSet);
    expect(rec.waterfall.find((a) => a.productId === "pension-fund")).toBeDefined();
    expect(rec.waterfall.find((a) => a.productId === "irp")).toBeDefined();
  });

  it("해외주식 보유: RIA 감면 긴급 트랙 + 절감액 추정", () => {
    const rec = recommend(toProfile("investor", asOf), ruleSet);
    const ria = rec.actions.find((a) => a.id === "urgent-ria");
    expect(ria).toBeDefined();
    expect(ria!.estimatedBenefit).toBeGreaterThan(0);
  });

  it("세 페르소나의 결과 구성(긴급+워터폴 id 집합)이 서로 다르다 — 시연 차별성", () => {
    const sig = (id: string) => {
      const rec = recommend(toProfile(id, asOf), ruleSet);
      return [
        ...rec.actions.filter((a) => a.urgency === "immediate").map((a) => `U:${a.id}`),
        ...rec.waterfall.map((a) => `W:${a.productId}`),
      ]
        .sort()
        .join(",");
    };
    const sigs = PERSONAS.map((p) => sig(p.id));
    expect(new Set(sigs).size).toBe(PERSONAS.length);
  });
});
