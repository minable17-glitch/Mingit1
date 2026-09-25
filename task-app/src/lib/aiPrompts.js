// "AI 도움받기": 앱이 질문(프롬프트)을 만들어 주면 사용자가 ChatGPT·Claude·Gemini 등에 붙여넣고,
// 받은 답을 다시 앱에 붙여넣으면 여기서 읽어 들입니다. (자기 API 키를 넣은 사용자는 자동으로 주고받음)
// 답 형식을 [업무] [마감] [단계]… 처럼 정해 달라고 부탁하되, AI가 조금 다르게 답해도 읽을 수 있게 너그럽게 해석합니다.
import { findDates } from './rules.js';

const ANSWER_FORMAT = `아래 형식 그대로, 다른 말 없이 답해 주세요. 날짜는 YYYY-MM-DD로 씁니다.
[업무] 업무 이름
[마감] YYYY-MM-DD (모르면 비워 두기)
[분류] 분류 이름
[단계]
1. 첫 번째 단계 / YYYY-MM-DD
2. 두 번째 단계 / YYYY-MM-DD
[다음 행동] 오늘 바로 할 15~30분짜리 행동 하나
[메모] 꼭 알아야 할 내용 한두 줄 (제출물·방법·유의사항)`;

const RULES = `- 단계는 3~7개, 순서대로, "견적 2곳 받기"처럼 동사로 끝나는 구체적 행동으로.
- 단계 날짜는 오늘과 마감 사이에 무리 없이 배분하고, 결재 시간을 고려해 여유 있게, 주말이 아닌 평일로.
- 한국 학교의 학사일정·결재 절차·공문 관행을 고려해 주세요.`;

export function breakdownPrompt(task, categoryName, today) {
  return `당신은 여러 업무를 동시에 맡은 한국 교사의 업무 정리를 돕는 비서입니다.
아래 업무를 실행 가능한 단계로 쪼개 주세요.

오늘: ${today}
업무: ${task.title}
분류: ${categoryName ?? '-'}
최종 마감: ${task.due_date || '정하지 않음'}
${task.latest_note ? `지금까지 메모: ${task.latest_note}\n` : ''}
${RULES}
(더 알아야 할 것이 있으면 먼저 질문해도 됩니다. 대화가 끝나면 마지막 답만 형식에 맞춰 주세요.)

${ANSWER_FORMAT}`;
}

export function documentPrompt(text, categories, today) {
  return `당신은 한국 학교 교사의 업무 비서입니다. 아래 공문(또는 업무 메일)을 읽고, 교사가 해야 할 업무 하나로 정리해 주세요.

오늘: ${today}
분류는 다음 중 하나로: ${categories.map((c) => c.name).join(', ')}
${RULES}
- 마감은 문서에 적힌 최종 제출·처리 기한 그대로. 문서에 없는 사실은 지어내지 마세요.

${ANSWER_FORMAT}

<문서>
${text}
</문서>`;
}

export function reviewPrompt(week, stuck, answers, today) {
  return `금요일 5분 주간 회고를 돕는 다정하고 간결한 동료가 되어 주세요.
아래는 한국 교사의 이번 주 업무 기록입니다.

오늘: ${today} (이번 주 시작: ${week.start})
이번 주 완료: ${week.completed.join(', ') || '없음'}
이번 주 활동:
${week.activity.join('\n') || '(없음)'}

멈춰 있는 업무:
${stuck.map((s) => `- ${s}`).join('\n') || '(없음)'}

${answers.filter(Boolean).length ? `교사가 적은 메모:\n${answers.filter(Boolean).map((a) => `- ${a}`).join('\n')}\n` : ''}
다음을 5~8줄로 답해 주세요.
1) 이번 주 잘한 점 한 줄
2) 멈춘 업무마다 다음 주에 바로 할 작은 행동 하나씩
3) 다음 주 가장 중요한 일 한 가지와 이유`;
}

// ── 답 읽기 ─────────────────────────────────

const LABELS = [
  ['title', /^(업무|업무\s*이름|제목)$/],
  ['due_date', /^(마감|기한|최종\s*마감)$/],
  ['category', /^(분류)$/],
  ['steps', /^(단계|세부\s*단계|할\s*일)$/],
  ['next_action', /^(다음\s*행동|첫\s*행동|오늘\s*할\s*일)$/],
  ['note', /^(메모|참고|요약|제출물)$/],
];

// 마크다운 꾸밈(**굵게**, `코드`, # 제목, 코드블록 표시) 제거
function plain(line) {
  return line.replace(/```\w*/g, '').replace(/\*\*|__|`/g, '').replace(/^#+\s*/, '').trim();
}

function labelOf(line) {
  // [업무] …  /  【업무】 …  /  업무: …  /  업무 - …
  const m = line.match(/^[[【]\s*([^\]】]+?)\s*[\]】]\s*[:：]?\s*(.*)$/) || line.match(/^([가-힣\s]{1,8}?)\s*[:：]\s*(.*)$/);
  if (!m) return null;
  const hit = LABELS.find(([, re]) => re.test(m[1].trim()));
  return hit ? { key: hit[0], rest: m[2].trim() } : null;
}

// 한 줄 단계: "1. 견적 받기 / 2026-10-14", "- 견적 받기 (10/14)", "1) 견적 받기 | 10월 14일까지"
function parseStepLine(line, today) {
  const m = line.match(/^(?:\d+\s*[.)]|[-•*·]|\d+단계\s*[:：]?)\s*(.+)$/);
  if (!m) return null;
  let body = m[1].trim();
  const dates = findDates(body, today);
  const due = dates.length ? dates[dates.length - 1].date : '';
  // 제목에서 날짜 부분과 구분 기호 떼기
  let title = body
    .replace(/(20\d{2})\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\.?/g, '')
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일(까지)?/g, '')
    .replace(/\(\s*\d{1,2}\s*[./]\s*\d{1,2}\s*\.?\s*(\([월화수목금토일]\))?\s*\)/g, '')
    .replace(/\(\s*[월화수목금토일]\s*\)/g, '')
    .replace(/(?<![\d/.])\d{1,2}\/\d{1,2}(?![\d/])/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s*(까지)\s*$/g, '')
    .replace(/[\s/|–—:-]+$/g, '')
    .trim();
  if (!title) return null;
  return { title, due_date: due };
}

// 붙여넣은 답 → { title, due_date, category, steps, next_action, note }. 못 읽으면 steps 가 빈 배열.
export function parsePlan(answer, today) {
  const out = { title: '', due_date: '', category: '', steps: [], next_action: '', note: '' };
  let section = null;
  const loose = []; // 섹션 표시 없이 나온 번호 목록
  for (const raw of answer.split(/\r?\n/)) {
    const line = plain(raw);
    if (!line) continue;
    const label = labelOf(line);
    if (label) {
      section = label.key;
      if (label.rest) {
        if (section === 'steps') {
          const st = parseStepLine(label.rest, today);
          if (st) out.steps.push(st);
        } else if (section === 'due_date') {
          const d = findDates(label.rest, today);
          out.due_date = d.length ? d[0].date : '';
        } else if (section === 'note' && out.note) out.note += ` ${label.rest}`;
        else out[section] = label.rest;
      }
      continue;
    }
    const st = parseStepLine(line, today);
    if (section === 'steps' && st) out.steps.push(st);
    else if (section === 'note') out.note = out.note ? `${out.note} ${line}` : line;
    else if (section === 'next_action' && !out.next_action) out.next_action = line;
    else if (st) loose.push(st);
  }
  if (!out.steps.length && loose.length) out.steps = loose;
  out.steps = out.steps.slice(0, 12);
  return out;
}
