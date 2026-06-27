import { describe, expect, it } from "vitest";

import { ruleSet } from "../../rules/products";
import type { UserProfile } from "../../rules/schema";
import { recommend } from "../index";
import { monthsToReach, projectWealth } from "../projection";

// 연금 골든 케이스: monthly 50만, horizon 30 → 연금 600만 전액, 첫 해 절세 99만.
const longTerm: UserProfile = {
  age: 30,
  incomeType: "earned",
  income: 50_000_000,
  monthlyInvestable: 500_000,
  horizonYears: 30,
  asOf: "2026-06-21",
};

describe("자산 형성 시뮬레이션 (projection)", () => {
  it("원금 누계 = 월적립 × 개월수, 평가액 > 원금(6% 수익)", () => {
    const rec = recommend(longTerm, ruleSet);
    const proj = projectWealth(rec, longTerm, ruleSet);
    expect(proj.totalContributed).toBe(500_000 * 12 * 30);
    expect(proj.projectedBalance).toBeGreaterThan(proj.totalContributed);
    expect(proj.growth).toBe(proj.projectedBalance - proj.totalContributed);
    expect(proj.annualReturnRate).toBeCloseTo(0.06, 5);
  });

  it("연 절세액 = 워터폴 첫 해 절세 합(연금 99만), 누계·월여력 환산", () => {
    const rec = recommend(longTerm, ruleSet);
    const proj = projectWealth(rec, longTerm, ruleSet);
    expect(proj.annualTaxBenefit).toBe(990_000);
    expect(proj.cumulativeTaxBenefit).toBe(990_000 * 30);
    expect(proj.monthlyTaxBenefit).toBe(Math.round(990_000 / 12));
    // 절세 재투자분이 있으니 더 큰 평가액.
    expect(proj.balanceWithReinvestedTaxBenefit).toBeGreaterThan(proj.projectedBalance);
  });

  it("마일스톤 스케줄은 horizon 이하 연도만, 단조 증가", () => {
    const rec = recommend(longTerm, ruleSet);
    const proj = projectWealth(rec, longTerm, ruleSet);
    expect(proj.schedule.length).toBeGreaterThan(0);
    expect(proj.schedule.every((p) => p.year <= 30)).toBe(true);
    for (let i = 1; i < proj.schedule.length; i++) {
      expect(proj.schedule[i].balance).toBeGreaterThan(proj.schedule[i - 1].balance);
    }
  });

  it("monthsToReach: 수익이 붙으면 단순 나눗셈보다 빨리 도달", () => {
    const target = 18_000_000;
    const months = monthsToReach(target, 500_000, 0.06);
    expect(months).toBeGreaterThan(0);
    expect(months).toBeLessThan(36); // 원금만이면 36개월, 6%면 그 전에 도달
  });

  it("monthsToReach: 월적립 0이면 도달 불가(Infinity)", () => {
    expect(monthsToReach(10_000_000, 0, 0.06)).toBe(Infinity);
    expect(monthsToReach(0, 500_000, 0.06)).toBe(0);
  });
});
