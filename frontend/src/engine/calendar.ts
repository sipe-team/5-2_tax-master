/**
 * 절세 캘린더 (.ics 내보내기).
 *
 * 마감(deadline)이 있는 액션 카드를 RFC 5545 VCALENDAR로 직렬화한다.
 * - 종일(all-day) 이벤트(`VALUE=DATE`) + D-7 표시 알림(VALARM) → iOS·Android·Google·Outlook 호환.
 * - 결정론: Date.now/랜덤 등 부수효과·비결정 입력 없이 (actions + asOf)에서만 파생
 *   → 같은 입력이면 같은 바이트(단위 테스트 가능). 엔진 결정론 원칙(DESIGN Q2)과 동일.
 * - 다운로드는 브라우저 Blob → 개인정보 서버 미전송 원칙(DESIGN Q7) 유지.
 */
import type { ActionCard } from "./types";

const PRODID = "-//tax-master//절세 캘린더//KO";
const ALARM_LEAD_DAYS = 7; // D-7 알림

/** RFC 5545 TEXT 이스케이프: \ ; , 와 개행. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** "2026-07-03" / ISO datetime → "20260703" (DATE 값, 종일 이벤트용). */
function toIcsDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

/** 종일 이벤트의 DTEND 는 마감일 +1일 (RFC 5545 DTEND 는 배타적). UTC 기준 안전 계산. */
function nextDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** DTSTAMP 를 입력(asOf)에서 파생 → 결정론 유지. */
function dtStamp(asOf: string): string {
  return `${toIcsDate(asOf)}T000000Z`;
}

/** RFC 5545 75옥텟 라인 폴딩(이어지는 줄은 공백 1칸 prefix). UTF-8 바이트 기준. */
function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  let first = true;
  for (const ch of line) {
    const chBytes = enc.encode(ch).length;
    const limit = first ? 75 : 74; // 이어지는 줄은 선행 공백 1칸 포함해 75
    if (curBytes + chBytes > limit) {
      out.push(cur);
      cur = ch;
      curBytes = chBytes;
      first = false;
    } else {
      cur += ch;
      curBytes += chBytes;
    }
  }
  if (cur) out.push(cur);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join("\r\n");
}

function buildEvent(a: ActionCard, asOf: string): string[] {
  const deadline = a.deadline as string;
  const start = toIcsDate(deadline);
  const uid = `${a.id}-${start}@tax-master`;
  const benefit =
    a.estimatedBenefit != null
      ? ` 예상 절감 약 ${Math.round(a.estimatedBenefit / 10_000).toLocaleString()}만원.`
      : "";
  const dday = a.dDay != null ? ` (D-${a.dDay})` : "";
  const summary = `[절세 마감] ${a.name}${dday}`;
  const description = `${a.action}${benefit}\n\n${a.reason}\n※ 정보 제공 목적이며 투자·세무 자문이 아닙니다.`;

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp(asOf)}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${nextDay(deadline)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(summary)}`,
    `TRIGGER:-P${ALARM_LEAD_DAYS}D`,
    "END:VALARM",
    "END:VEVENT",
  ];
}

/** 마감(deadline)이 있는 액션만 캘린더 대상. */
export function calendarActions(actions: ActionCard[]): ActionCard[] {
  return actions.filter((a) => !!a.deadline);
}

/**
 * 액션 카드 → RFC 5545 .ics 문자열. 마감 있는 액션이 없으면 빈 문자열.
 * 줄 구분은 CRLF(스펙 요구).
 */
export function buildCalendar(actions: ActionCard[], asOf: string): string {
  const targets = calendarActions(actions);
  if (targets.length === 0) return "";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...targets.flatMap((a) => buildEvent(a, asOf)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n");
}

/**
 * 단일 액션 → 구글 캘린더 '일정 추가' 딥링크.
 * 탭하면 모바일/데스크탑 모두 구글 캘린더 추가 화면이 바로 열린다(.ics 다운로드 불필요).
 * 종일 이벤트(dates=시작/마감+1일). 마감 없으면 null.
 */
export function googleCalendarUrl(a: ActionCard): string | null {
  if (!a.deadline) return null;
  const start = toIcsDate(a.deadline);
  const end = nextDay(a.deadline); // 종일 이벤트는 종료일 배타적
  const benefit =
    a.estimatedBenefit != null
      ? ` 예상 절감 약 ${Math.round(a.estimatedBenefit / 10_000).toLocaleString()}만원.`
      : "";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `[절세 마감] ${a.name}`,
    dates: `${start}/${end}`,
    details: `${a.action}${benefit}\n\n${a.reason}\n※ 정보 제공 목적이며 투자·세무 자문이 아닙니다.`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
