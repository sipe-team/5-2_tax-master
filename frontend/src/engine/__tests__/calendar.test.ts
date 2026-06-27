import { describe, expect, it } from "vitest";
import { buildCalendar } from "../calendar";
import type { UrgentAction } from "../types";

const asOf = "2026-06-21";

const youth: UrgentAction = {
  productId: "youth-future-savings",
  name: "청년미래적금 (일반형)",
  deadline: "2026-07-03",
  dDay: 12,
  description: "신청 기간 2026-06-22 ~ 2026-07-03. 놓치면 다음 회차까지 대기.",
  badges: [],
};

const ria: UrgentAction = {
  productId: "ria",
  name: "RIA 계좌",
  deadline: "2026-07-31",
  dDay: 40,
  description: "현재 감면율 80%. 2026-07-31 이후 하락.",
  estimatedBenefit: 7_480_000,
  badges: [],
};

describe("buildCalendar (절세 캘린더, Feature A)", () => {
  it("긴급 액션마다 VEVENT 1개 + 캘린더 래퍼", () => {
    const ics = buildCalendar([youth, ria], asOf);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect((ics.match(/END:VEVENT/g) ?? []).length).toBe(2);
  });

  it("종일 이벤트: DTSTART는 마감일, DTEND는 +1일(배타적)", () => {
    const ics = buildCalendar([youth], asOf);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260703");
    expect(ics).toContain("DTEND;VALUE=DATE:20260704");
  });

  it("D-7 알림 VALARM 포함", () => {
    const ics = buildCalendar([youth], asOf);
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-P7D");
  });

  it("UID는 productId+마감일에서 파생되어 결정론적", () => {
    const ics = buildCalendar([youth], asOf);
    expect(ics).toContain("UID:youth-future-savings-20260703@tax-master");
    // 같은 입력 → 같은 바이트
    expect(buildCalendar([youth], asOf)).toBe(ics);
  });

  it("SUMMARY에 D-day, DESCRIPTION에 면책·예상절감 반영", () => {
    const ics = buildCalendar([ria], asOf);
    expect(ics).toContain("SUMMARY:[절세 마감] RIA 계좌 (D-40)");
    expect(ics).toContain("예상 절감 약 748만원");
    expect(ics).toContain("투자·세무 자문이 아닙니다");
  });

  it("RFC 5545: 모든 줄은 CRLF로 종료", () => {
    const ics = buildCalendar([youth], asOf);
    const lines = ics.split("\r\n");
    // 끝의 빈 토큰 제외하고 LF 단독 줄이 없어야 함
    expect(ics.includes("\r\n")).toBe(true);
    expect(/[^\r]\n/.test(ics)).toBe(false);
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
  });

  it("이미 마감된(dDay<0) 액션은 제외", () => {
    const past: UrgentAction = { ...youth, dDay: -1, deadline: "2026-06-10" };
    expect(buildCalendar([past], asOf)).toBe("");
    // 혼재 시 임박 항목만 남음
    const ics = buildCalendar([past, ria], asOf);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
    expect(ics).toContain("RIA");
  });

  it("내보낼 항목이 없으면 빈 문자열", () => {
    expect(buildCalendar([], asOf)).toBe("");
  });

  it("특수문자(; , \\)는 RFC 5545 이스케이프", () => {
    const tricky: UrgentAction = {
      ...youth,
      name: "테스트; 콤마, 백슬래시\\",
    };
    const ics = buildCalendar([tricky], asOf);
    expect(ics).toContain("테스트\\; 콤마\\, 백슬래시\\\\");
  });
});
