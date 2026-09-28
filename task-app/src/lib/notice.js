// 긴 글(메신저 안내문·공문·AI 대화)을 한 칸에 붙여넣었을 때 업무 초안으로 정리.
// 입력칸(input)은 줄바꿈이 사라지므로 "1) … 2) …"처럼 한 줄로 이어진 항목을 다시 나눔.
import { extractFromDocument, guessCategoryId, pickDeadline } from './rules.js';
import { extractActionItems, extractFromConversation, looksLikeOfficialDoc } from './conversation.js';

export const LONG_TEXT = 60;

// 한 줄로 붙여넣은 긴 글인지 (이 길이를 넘으면 업무 이름으로 쓰지 않고 정리 화면으로)
export function isLongText(text) {
  return text.trim().length > LONG_TEXT || /\n/.test(text.trim());
}

// 한 줄 안의 "1) … 2) …", "① … ②", "(1) …", " 2. …" 앞에서 줄을 나눔 (날짜 "9. 30."은 건드리지 않음)
export function splitInlineItems(text) {
  return text
    .replace(/\s+(?=(?:\d{1,2}\)|\(\d{1,2}\)|[①-⑳]|[가-하]\))\s*\S)/g, '\n')
    .replace(/\s+(?=\d{1,2}\.\s+[^\d\s])/g, '\n')
    .replace(/\s+(?=※)/g, '\n');
}

// 인사말·호칭·안내 말투를 떼고 짧은 업무 이름으로
export function noticeTitle(text) {
  let first = text.trim().split(/\n/)[0];
  // "[2학기 공개수업 안내]"는 제목, "[교무부]" "[공지]"처럼 짧은 건 보낸 곳 표시라 떼어 냄
  const bracket = first.match(/^\s*[[【<〈]\s*([^\]】>〉]{2,40})\s*[\]】>〉]\s*/);
  if (bracket && (/\s/.test(bracket[1].trim()) || bracket[1].trim().length >= 8)) return bracket[1].trim();
  if (bracket) first = first.slice(bracket[0].length);
  let t = first
    .replace(/^\s*(선생님(들)?\s*,?\s*)?안녕하(세요|십니까)[.!~,\s]*/, '')
    .replace(/^(.{0,25}?)\s*(선생님|쌤)들?\s*(께서는|께서|께|,)\s*/, '$1 ');
  // 첫 문장만 ("교무부입니다."처럼 자기소개 문장은 건너뜀)
  const sentences = t.split(/[.!?。](?:\s+|$)/).map((x) => x.trim()).filter(Boolean);
  t = sentences.find((x) => !/^\S+(\s\S+)?\s*(입니다|이에요|예요)$/.test(x)) ?? sentences[0] ?? t;
  t = t
    .replace(/\s*(에\s*대해|에\s*대하여|관련하여|관련해서)?\s*(을|를)?\s*안내\s*(드립니다|드려요|합니다|해\s*드립니다|드리오니)?.*$/, ' 안내')
    .replace(/\s*(을|를)?\s*(부탁드립니다|부탁드려요|바랍니다|해\s*주세요|주시기\s*바랍니다).*$/, '')
    .replace(/\s*(입니다|이에요|예요)\s*$/, '')
    .replace(/[.!~\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > 40) {
    const space = t.lastIndexOf(' ', 38);
    t = `${t.slice(0, space > 15 ? space : 38)}…`;
  }
  return t || first.slice(0, 38);
}

// 안내문 → 업무 초안. 원문 전체는 메모로 보관
export function extractFromNotice(text, categories, today) {
  // 끝인사는 할 일이 아님
  const body = text.trim().replace(/\s*(감사합니다|고맙습니다|수고하세요|수고하십시오|좋은\s*하루\s*되세요)[.!~^\s]*/g, ' ').trim();
  const split = splitInlineItems(body);
  const steps = extractActionItems(split, today);
  const due = pickDeadline(text, today);
  return {
    title: noticeTitle(split),
    category_id: guessCategoryId(text, categories),
    due_date: due,
    steps: steps.length ? steps : [{ title: '안내 내용 확인하고 할 일 정리하기', due_date: due }],
    next_action: steps[0]?.title ?? '안내 내용 확인하고 할 일 정리하기',
    note: `[원문] ${text.trim()}`,
  };
}

// 어떤 긴 글이든: 공문 / AI 대화 / 안내문 중 알맞은 방식으로
// preferChat: "공문·대화 붙여넣기" 칸처럼 대화를 붙여넣는 곳이면 공문이 아닌 글은 대화로 읽음
export function extractFromLongText(text, categories, today, { preferChat = false } = {}) {
  if (looksLikeOfficialDoc(text)) return { draft: extractFromDocument(text, categories, today), source: '공문' };
  const chatty = /(^|\n)\s*(나|you said|chatgpt said|user|assistant|claude|gemini)\s*[:：]/i.test(text) || /(^|\n)\s*#{1,3}\s/.test(text);
  if (chatty || preferChat) return { draft: extractFromConversation(text, categories, today), source: 'AI 대화' };
  return { draft: extractFromNotice(text, categories, today), source: '긴 글' };
}
