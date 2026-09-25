// iCalendar(.ics) 만들기 — 캘린더 구독 링크용
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (d: string) => d.replace(/-/g, "");
const nextDay = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day + 1)).toISOString().slice(0, 10);
};
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

// 긴 줄은 75바이트 근처에서 접기 (iCalendar 규칙)
function fold(line: string) {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 73) {
      out.push(cur);
      cur = " " + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}

export function event(uid: string, date: string, summary: string, description: string) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}@task-keeper`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${ymd(date)}`,
    `DTEND;VALUE=DATE:${ymd(nextDay(date))}`,
    fold(`SUMMARY:${esc(summary)}`),
    fold(`DESCRIPTION:${esc(description)}`),
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

type Step = { id: string; title: string; due_date: string | null; done: boolean };
type Task = { id: string; title: string; next_action: string; due_date: string | null; steps?: Step[] };

export function buildCalendar(tasks: Task[], includeSteps: boolean) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//task-keeper//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:업무 챙김 마감",
    "X-WR-TIMEZONE:Asia/Seoul",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const t of tasks) {
    if (t.due_date) lines.push(...event(t.id, t.due_date, `[마감] ${t.title}`, `다음 행동: ${t.next_action}`));
    if (includeSteps) {
      for (const s of t.steps ?? []) {
        if (s.due_date && !s.done) lines.push(...event(s.id, s.due_date, `[단계] ${t.title} · ${s.title}`, t.title));
      }
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
