// AI와 나눈 대화(또는 AI가 정리해 준 글)를 통째로 붙여넣으면, 할 일 목록을 이야기한 순서대로 뽑아 업무 초안으로.
// AI 없이 규칙으로 동작: 번호·글머리표·체크박스 줄을 순서대로 모으고, 날짜와 마감을 찾음.
import { findDates, guessCategoryId, pickDeadline } from './rules.js';

// "나:", "ChatGPT said:", "You said:" 같은 말하는 사람 표시
const SPEAKER = /^(?:나|저|사용자|질문|답변|user|you(?:\s+said)?|me|chatgpt(?:\s+said)?|gpt|claude|gemini|뤼튼|wrtn|ai|assistant|bot)\s*[:：]\s*/i;

// 목록 표시: - * • 1. 1) (1) ① 가. Step 1: 1단계:
const MARKER = /^(?:[-*•·▪◦‣○●□■✓✔☐☑]\s+|\d{1,2}\s*[.)]\s*|\(\d{1,2}\)\s*|[①-⑳]\s*|[가-하]\s*[.)]\s+|(?:step|단계)\s*\d+\s*[:：.)-]?\s*|\d+\s*단계\s*[:：.)-]?\s*)/i;

const CHECKBOX = /^\[[ xX✓✔]?\]\s*/;

// 마크다운 꾸밈 제거
export function plainLine(line) {
  return line.replace(/```\w*/g, '').replace(/\*\*|__|`/g, '').replace(/^#+\s*/, '').replace(/^>\s*/, '').trim();
}

// 할 일 한 줄에서 날짜 표기와 끝의 구분 기호를 떼어 이름만 남김
export function cleanItemTitle(body) {
  return body
    .replace(/(20\d{2})\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\.?(\s*\([월화수목금토일]\))?/g, '')
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일(\s*\([월화수목금토일]\))?(까지)?/g, '')
    .replace(/(?<![\d/.])\d{1,2}\/\d{1,2}(?![\d/])(\s*\([월화수목금토일]\))?/g, '')
    .replace(/\(\s*\d{1,2}\s*[./]\s*\d{1,2}\s*\.?\s*(\([월화수목금토일]\))?\s*\)/g, '')
    .replace(/\(\s*[월화수목금토일]\s*\)/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s*(까지)\s*$/g, '')
    .replace(/[\s/|–—:→-]+$/g, '')
    .replace(/^[\s/|–—:→-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 너무 긴 설명은 첫 문장(또는 60자)까지만
function shorten(title) {
  if (title.length <= 60) return title;
  const cut = title.search(/[.。!]\s|다\.\s?|요\.\s?/);
  if (cut > 5 && cut < 60) return title.slice(0, cut + 1).trim();
  return `${title.slice(0, 58).trim()}…`;
}

// 대화에서 할 일 목록을 순서대로: [{ title, due_date }]
export function extractActionItems(text, today) {
  const items = [];
  const seen = new Set();
  for (const raw of text.split(/\r?\n/)) {
    // "**1. 기획 단계**", "### 1. 준비"처럼 통째로 굵거나 제목인 줄은 소제목이라 건너뜀
    if (/^\s*(\*\*[^*]+\*\*|__[^_]+__)\s*[:：]?\s*$/.test(raw) || /^\s*#+\s/.test(raw)) continue;
    let line = plainLine(raw).replace(SPEAKER, '');
    const m = line.match(MARKER);
    if (!m) continue;
    line = line.slice(m[0].length).replace(CHECKBOX, '').trim();
    if (!line || /[?？]\s*$/.test(line)) continue; // 질문은 할 일이 아님
    if (/[:：]\s*$/.test(line)) continue; // "준비물:" 처럼 아래 목록의 제목만 있는 줄
    const dates = findDates(line, today);
    const title = shorten(cleanItemTitle(line));
    if (title.length < 2) continue;
    const key = title.replace(/\s/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title, due_date: dates.length ? dates[dates.length - 1].date : '' });
  }
  return items;
}

// "~ 순서 좀 정리해줘", "~ 계획 짜 줘" 같은 부탁 말투 떼기
function stripRequest(t) {
  return t
    .replace(/\s*(에\s*대해|관련(해서)?)?\s*(순서|방법|계획|일정|단계|할\s*일)?\s*(좀|을|를|로)?\s*(정리|알려|만들어|짜|세워|추천|도와)\s*(줘|주세요|줄래|줄\s*수\s*있(어|나요)|주실\s*수\s*있나요)?.*$/, '')
    .replace(/\s*(어떻게\s*해야\s*(해|하지|할까)|뭐부터\s*(하지|해야\s*해|할까)).*$/, '')
    .replace(/\s*(하려고\s*(해|하는데)|해야\s*(하는데|해|돼))\s*$/, '')
    .trim();
}

// 업무 이름: # 제목 → 굵은 소제목(번호 없는 것) → 대화 첫 질문 → 첫 줄
function guessTitle(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const numbered = (l) => /^\d+\s*[.)]/.test(plainLine(l));
  const heading = lines.find((l) => /^#+\s+\S/.test(l) && !numbered(l))
    ?? lines.find((l) => /^\*\*[^*]+\*\*$/.test(l) && !numbered(l));
  if (heading) return shorten(cleanItemTitle(plainLine(heading))).slice(0, 60);
  // 말하는 사람 표시가 있으면 첫 발화(보통 선생님의 질문), 없으면 목록이 아닌 첫 줄
  // ("You said:"처럼 이름만 있는 줄이면 그다음 줄이 첫 발화)
  const said = (l) => plainLine(l).replace(SPEAKER, '').trim();
  const idx = lines.findIndex((l) => SPEAKER.test(plainLine(l)));
  const spoken = idx === -1 ? null : (said(lines[idx]) ? lines[idx] : lines[idx + 1]);
  const first = spoken ?? lines.find((l) => said(l) && !MARKER.test(plainLine(l))) ?? lines[0] ?? '';
  const sentence = plainLine(first).replace(SPEAKER, '').split(/[.?!。]\s|[.?!]$/)[0];
  return shorten(cleanItemTitle(stripRequest(sentence) || sentence)).slice(0, 60);
}

export function extractFromConversation(text, categories, today) {
  const steps = extractActionItems(text, today);
  // 마감: 대화에 나온 날짜 중 가장 늦은 날(보통 행사일·최종 제출일). 단계 날짜는 그보다 앞섬
  const future = findDates(text, today).map((d) => d.date).filter((d) => d >= today).sort();
  const due = future.at(-1) || pickDeadline(text, today) || '';
  return {
    title: guessTitle(text),
    category_id: guessCategoryId(text, categories),
    due_date: due,
    steps: steps.length ? steps : [{ title: '', due_date: '' }],
    next_action: steps[0]?.title ?? '',
    note: steps.length ? `AI 대화에서 할 일 ${steps.length}개를 순서대로 가져옴` : '',
  };
}

// 공문처럼 보이는지 (수신·제목·붙임·시행·끝. 같은 공문 표시가 2개 이상)
export function looksLikeOfficialDoc(text) {
  const marks = [/(^|\n)\s*수\s*신\s/, /(^|\n)\s*제\s*목\s*[:：]?\s*\S/, /(^|\n)\s*붙\s*임\s/, /(^|\n)\s*시\s*행\s/, /끝\s*\.\s*($|\n)/, /(^|\n)\s*발\s*신\s/];
  return marks.filter((re) => re.test(text)).length >= 2;
}
