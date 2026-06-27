import { describe, expect, it } from "vitest";
import { ruleSet } from "../../rules/products";
import { recommend } from "../index";
import { projectGap } from "../projection";
import type { UserProfile } from "../../rules/schema";

const asOf = "2026-06-27";
// 30대 직장인: 노후(25년) 가정이라 연금 워터폴이 충분히 채워진다.
const worker: UserProfile = {
  age: 38,
  incomeType: "earned",
  income: 60_000_000,
  monthlyInvestable: 1_000_000,
  horizonYears: 25,
  asOf,
};

describe("10년 후 격차 시뮬레이션 (projectGap)", () => {
  it("points는 year 0..horizon, 길이 horizon+1", () => {
    const rec = recommend(worker, ruleSet);
    const proj = projectGap(rec, worker.monthlyInvestable, 10, ruleSet);
    expect(proj.points[0]).toEqual({ year: 0, taxed: 0, sheltered: 0 });
    expect(proj.points.length).toBe(11);
    expect(proj.points[10].year).toBe(10);
  });

  it("절세계좌가 일반계좌보다 항상 크거나 같다(세금 우위)", () => {
    const rec = recommend(worker, ruleSet);
    const proj = projectGap(rec, worker.monthlyInvestable, 10, ruleSet);
    for (const p of proj.points) {
      expect(p.sheltered).toBeGreaterThanOrEqual(p.taxed);
    }
    expect(proj.finalGap).toBeGreaterThan(0);
  });

  it("두 누적 모두 단조 증가", () => {
    const rec = recommend(worker, ruleSet);
    const proj = projectGap(rec, worker.monthlyInvestable, 10, ruleSet);
    for (let i = 1; i < proj.points.length; i++) {
      expect(proj.points[i].taxed).toBeGreaterThanOrEqual(proj.points[i - 1].taxed);
      expect(proj.points[i].sheltered).toBeGreaterThanOrEqual(proj.points[i - 1].sheltered);
    }
  });

  it("finalGap = 마지막 해 (sheltered − taxed)", () => {
    const rec = recommend(worker, ruleSet);
    const proj = projectGap(rec, worker.monthlyInvestable, 15, ruleSet);
    const last = proj.points[proj.points.length - 1];
    expect(proj.finalGap).toBe(Math.round(last.sheltered - last.taxed));
  });

  it("절세 그릇이 0이면(워터폴 없음) 격차도 0 — 과대약속 방지", () => {
    // 단기(3년)+청년 아님+해외주식 없음 → 워터폴이 비는 케이스를 구성
    const noShelter: UserProfile = { ...worker, age: 50, horizonYears: 1, income: 200_000_000 };
    const rec = recommend(noShelter, ruleSet);
    const proj = projectGap(rec, noShelter.monthlyInvestable, 10, ruleSet);
    if (rec.waterfall.length === 0) {
      expect(proj.finalGap).toBe(0);
    } else {
      expect(proj.finalGap).toBeGreaterThanOrEqual(0);
    }
  });

  it("결정론: 같은 입력 → 같은 수열", () => {
    const rec = recommend(worker, ruleSet);
    const a = projectGap(rec, worker.monthlyInvestable, 10, ruleSet);
    const b = projectGap(rec, worker.monthlyInvestable, 10, ruleSet);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("기간이 길수록 격차가 커진다(복리)", () => {
    const rec = recommend(worker, ruleSet);
    const g10 = projectGap(rec, worker.monthlyInvestable, 10, ruleSet).finalGap;
    const g20 = projectGap(rec, worker.monthlyInvestable, 20, ruleSet).finalGap;
    expect(g20).toBeGreaterThan(g10);
  });
});
