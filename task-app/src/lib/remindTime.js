// 글에서 알림 시간 찾기: "3시", "오후 2시 반", "14:30", "내일 아침", "점심/밥", "5교시 전", "퇴근 전" …
// 돌려주는 값: { at: 'YYYY-MM-DDTHH:mm' (한국 시간, datetime-local 입력칸 형식), why } 또는 null
import { addDays } from './date.js';

const KST = 9 * 3600e3;
const pad = (n) => String(n).padStart(2, '0');
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const fmt = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function nowKST(nowMs) {
  const d = new Date(nowMs + KST);
  return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay() };
}

// 시정표에서 점심 시작(4교시 끝), 마지막 교시 끝
function bellTimes(bell) {
  const sorted = [...(bell ?? [])].filter((b) => b.start && b.end).sort((a, b) => toMin(a.start) - toMin(b.start));
  const p4 = sorted.find((b) => Number(b.period) === 4);
  return {
    lunch: p4 ? toMin(p4.end) : 12 * 60 + 10,
    last: sorted.length ? toMin(sorted.at(-1).end) : 16 * 60 + 30,
    period: (n) => sorted.find((b) => Number(b.period) === n),
  };
}

function pickDate(text, now) {
  if (/모레/.test(text)) return { date: addDays(now.date, 2), explicit: true };
  if (/내일/.test(text)) return { date: addDays(now.date, 1), explicit: true };
  if (/오늘/.test(text)) return { date: now.date, explicit: true };
  const md = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ?? text.match(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/);
  if (md) {
    const y = Number(now.date.slice(0, 4));
    let date = `${y}-${pad(+md[1])}-${pad(+md[2])}`;
    if (date < now.date) date = `${y + 1}-${pad(+md[1])}-${pad(+md[2])}`;
    return { date, explicit: true };
  }
  const wd = text.match(/(다음\s*주\s*)?([월화수목금토일])요일/);
  if (wd) {
    let diff = (WEEK.indexOf(wd[2]) - now.dow + 7) % 7;
    if (wd[1]) diff += diff === 0 ? 7 : 7;
    return { date: addDays(now.date, diff), explicit: true };
  }
  return { date: now.date, explicit: false };
}

function pickTime(text, bell) {
  const b = bellTimes(bell);
  // 14:30, 2:30
  let m = text.match(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
  if (m) {
    let h = Number(m[1]);
    if (h >= 1 && h <= 6 && !/오전/.test(text)) h += 12;
    return { min: h * 60 + Number(m[2]), why: `${m[0]}` };
  }
  // 오후 2시 30분 / 3시 반
  m = text.match(/(오전|오후|아침|저녁|밤|낮)?\s*(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분)?/);
  if (m && Number(m[2]) <= 24) {
    let h = Number(m[2]);
    const part = m[1];
    if ((part === '오후' || part === '저녁' || part === '밤' || part === '낮') && h < 12) h += 12;
    else if (!part && h >= 1 && h <= 6) h += 12; // 학교 시간: "3시"는 오후 3시
    const mm = m[3] === '반' ? 30 : Number(m[4] ?? 0);
    return { min: h * 60 + mm, why: m[0].trim() };
  }
  // 5교시 전/후
  m = text.match(/(\d{1,2})\s*교시\s*(전|후|끝나고|시작)?/);
  if (m) {
    const p = b.period(Number(m[1]));
    if (p) {
      if (m[2] === '후' || m[2] === '끝나고') return { min: toMin(p.end), why: `${m[1]}교시 끝 (${p.end})` };
      return { min: toMin(p.start) - (m[2] === '전' ? 5 : 0), why: `${m[1]}교시 ${m[2] === '전' ? '전' : '시작'} (${p.start})` };
    }
  }
  if (/점심|밥\s*먹|급식/.test(text)) return { min: b.lunch - 10, why: `점심 전 (${fmt(b.lunch)} 시작)` };
  if (/퇴근|종례/.test(text)) return { min: b.last, why: `${/퇴근/.test(text) ? '퇴근' : '종례'} 무렵` };
  if (/조회|출근|아침/.test(text)) return { min: 8 * 60 + 30, why: '아침' };
  if (/저녁/.test(text)) return { min: 18 * 60, why: '저녁' };
  return null;
}

export function parseRemindTime(text, nowMs = Date.now(), bell = []) {
  const time = pickTime(text, bell);
  if (!time) return null;
  const now = nowKST(nowMs);
  let { date, explicit } = pickDate(text, now);
  // 날짜 없이 이미 지난 시간이면 내일로
  if (!explicit && time.min <= now.min) date = addDays(date, 1);
  const min = Math.max(0, Math.min(23 * 60 + 59, time.min));
  return { at: `${date}T${fmt(min)}`, why: time.why, tomorrow: !explicit && date !== now.date };
}

// datetime-local 값(한국 시간) ↔ 저장용 ISO
export const localToISO = (local) => new Date(`${local}:00+09:00`).toISOString();
export function isoToLocal(iso) {
  const d = new Date(Date.parse(iso) + KST);
  return d.toISOString().slice(0, 16);
}

// "오늘 11:50", "내일 08:30", "10/5(월) 15:00"
export function remindLabel(iso, nowMs = Date.now()) {
  const local = isoToLocal(iso);
  const [date, time] = local.split('T');
  const today = nowKST(nowMs).date;
  if (date === today) return `오늘 ${time}`;
  if (date === addDays(today, 1)) return `내일 ${time}`;
  const [y, m, d] = date.split('-').map(Number);
  return `${m}/${d}(${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}) ${time}`;
}
