import type { UrgentAction } from "./types";

/**
 * 절세 캘린더 (Feature A): 긴급 트랙의 마감 임박 액션을 RFC 5545 .ics로 내보낸다.
 *
 * 엔진 결정론 원칙(DESIGN Q2·Q8)을 따라 부수효과·비결정 입력(Date.now/랜덤) 없이
 * 입력(action + asOf)에서만 파생한다 → 같은 입력이면 같은 바이트, 단위 테스트 가능.
 * 브라우저에서 Blob으로 내려받으므로 개인정보 서버 미전송 원칙(Q7)도 유지된다.
 */

const PRODID = "-//tax-master//절세 캘린더//KO";
const ALARM_LEAD_DAYS = 7; // D-7 알림

/** RFC 5545 TEXT 이스케이프: \\ ; , 와 개행. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** "2026-07-03" → "20260703" (DATE 값, 종일 이벤트용). */
function toIcsDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

/** 종일 이벤트의 DTEND는 마감일 +1일 (RFC 5545 DTEND는 배타적). */
function nextDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** UID·DTSTAMP를 입력에서 파생(결정론). asOf를 자정 UTC 타임스탬프로 고정. */
function dtStamp(asOf: string): string {
  return `${toIcsDate(asOf)}T000000Z`;
}

function buildEvent(a: UrgentAction, asOf: string): string[] {
  const start = toIcsDate(a.deadline);
  const uid = `${a.productId}-${start}@tax-master`;
  const benefit =
    a.estimatedBenefit != null
      ? ` 예상 절감 약 ${Math.round(a.estimatedBenefit / 10_000).toLocaleString()}만원.`
      : "";
  const summary = `[절세 마감] ${a.name} (D-${a.dDay})`;
  const description = `${a.description}${benefit} ※ 정보 제공 목적이며 투자·세무 자문이 아닙니다.`;

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp(asOf)}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${nextDay(a.deadline)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `TRIGGER:-P${ALARM_LEAD_DAYS}D`,
    `DESCRIPTION:${escapeText(summary)}`,
    "END:VALARM",
    "END:VEVENT",
  ];
}

/**
 * 긴급 액션들을 단일 VCALENDAR 문자열로. 마감(dDay<0) 항목은 제외.
 * 내보낼 게 없으면 빈 문자열을 반환(호출부에서 버튼 비활성).
 */
export function buildCalendar(actions: UrgentAction[], asOf: string): string {
  const upcoming = actions.filter((a) => a.dDay >= 0);
  if (upcoming.length === 0) return "";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...upcoming.flatMap((a) => buildEvent(a, asOf)),
    "END:VCALENDAR",
  ];

  // RFC 5545는 CRLF 줄바꿈을 요구.
  return lines.join("\r\n") + "\r\n";
}

/** 브라우저에서 .ics 파일을 내려받는다. 서버 전송 없음(클라이언트 Blob). */
export function downloadCalendar(ics: string, filename = "절세-마감.ics"): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
