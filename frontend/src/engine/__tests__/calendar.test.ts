import { describe, expect, it } from "vitest";
import type { ActionCard } from "../types";
import { buildCalendar, calendarActions } from "../calendar";

const asOf = "2026-06-27";

function action(over: Partial<ActionCard>): ActionCard {
  return {
    id: "youth-savings",
    name: "청년미래적금",
    category: "마감 임박",
    urgency: "immediate",
    score: 100,
    estimatedBenefit: 360_000,
    reason: "신청 기간 내 가입 시 정부기여금.",
    action: "은행 앱에서 신청하세요.",
    warning: null,
    deadline: "2026-07-03",
    dDay: 6,
    badges: [],
    ...over,
  };
}

describe("calendarActions", () => {
  it("deadline 있는 액션만 통과", () => {
    const list = [action({}), action({ id: "strategy", deadline: undefined, dDay: undefined })];
    expect(calendarActions(list).map((a) => a.id)).toEqual(["youth-savings"]);
  });
});

describe("buildCalendar", () => {
  it("마감 액션 없으면 빈 문자열", () => {
    expect(buildCalendar([action({ deadline: undefined })], asOf)).toBe("");
  });

  it("유효한 VCALENDAR 골격 + CRLF", () => {
    const ics = buildCalendar([action({})], asOf);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("\r\n"); // CRLF 구분
  });

  it("종일 이벤트: DTSTART=마감일, DTEND=+1일(배타적)", () => {
    const ics = buildCalendar([action({})], asOf);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260703");
    expect(ics).toContain("DTEND;VALUE=DATE:20260704");
  });

  it("D-7 알림(VALARM) 포함", () => {
    const ics = buildCalendar([action({})], asOf);
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-P7D");
  });

  it("SUMMARY/면책 문구 포함", () => {
    const ics = buildCalendar([action({})], asOf);
    expect(ics).toContain("청년미래적금");
    expect(ics).toContain("자문이 아닙니다");
  });

  it("결정론: 같은 입력 → 같은 바이트", () => {
    expect(buildCalendar([action({})], asOf)).toBe(buildCalendar([action({})], asOf));
  });

  it("여러 액션 → 여러 VEVENT", () => {
    const ics = buildCalendar(
      [action({ id: "a", deadline: "2026-07-03" }), action({ id: "b", deadline: "2026-12-31" })],
      asOf,
    );
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231");
  });
});
