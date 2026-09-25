import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFromDocument, pickDeadline, triageText, guessCategoryId, defaultSteps, similarity } from './rules.js';

const today = '2026-09-25';
const cats = [
  { id: 'c0', name: '담임' },
  { id: 'c1', name: '수업' },
  { id: 'c2', name: '행정업무' },
  { id: 'c3', name: '개인 일정' },
];

const 공문 = `○○교육지원청
수신 수신자 참조
제목 2026학년도 학교폭력 실태조사 결과 제출 안내

1. 관련: 교육부 학교폭력대책과-1234(2026. 9. 1.)
2. 2026학년도 2차 학교폭력 실태조사를 아래와 같이 실시하오니 협조하여 주시기 바랍니다.
  가. 조사 기간: 2026. 10. 1.(목) ~ 10. 16.(금)
  나. 결과 제출: 2026. 10. 20.(화)까지 업무관리시스템으로 제출
붙임 1. 실태조사 참여 결과 보고 서식 1부.
     2. 학부모 안내 가정통신문 예시 1부.  끝.

시행 ○○중학교-5678 (2026. 9. 24.)`;

test('공문에서 제목·기한·제출물·분류를 뽑는다', () => {
  const r = extractFromDocument(공문, cats, today);
  assert.equal(r.title, '2026학년도 학교폭력 실태조사 결과 제출 안내');
  assert.equal(r.due_date, '2026-10-20');
  assert.equal(r.category_id, 'c0'); // 학교폭력·학부모·가정통신문 → 담임
  assert.match(r.note, /실태조사 참여 결과 보고 서식/);
  assert.match(r.note, /가정통신문 예시/);
  assert.equal(r.steps.length, 4);
  assert.equal(r.steps.at(-1).due_date, '2026-10-20');
  assert.ok(r.steps.every((s) => s.due_date >= today));
});

test('여러 날짜 표기에서 기한 고르기', () => {
  assert.equal(pickDeadline('회신은 10월 7일까지 부탁드립니다. 행사는 11월 3일입니다.', today), '2026-10-07');
  assert.equal(pickDeadline('제출 기한: 2026-11-02', today), '2026-11-02');
  assert.equal(pickDeadline('10. 12.(월)까지 제출', today), '2026-10-12');
  assert.equal(pickDeadline('다음 모임 1월 5일', today), '2027-01-05'); // 연도 없으면 다가올 날짜로
  assert.equal(pickDeadline('날짜 없음', today), '');
});

test('던져넣기: 비슷한 업무에 붙이거나 새 업무로', () => {
  const tasks = [
    { id: 't1', title: '학급 운영비 정산', next_action: '영수증 모으기' },
    { id: 't2', title: '2학기 수행평가 계획서 제출', next_action: '채점 기준표 쓰기' },
  ];
  const a = triageText('운영비 카드전표도 출력해야 함', tasks, cats, today);
  assert.equal(a.task_id, 't1');
  assert.equal(a.attach_as, 'step');
  const b = triageText('수행평가 계획 교감 검토 받음', tasks, cats, today);
  assert.equal(b.task_id, 't2');
  assert.equal(b.attach_as, 'note');
  const c = triageText('과학의 날 행사 물품 구입 10월 8일까지', tasks, cats, today);
  assert.equal(c.task_id, '');
  assert.equal(c.due_date, '2026-10-08');
  assert.equal(c.category_id, 'c2');
});

test('분류 추측과 기본 단계', () => {
  assert.equal(guessCategoryId('학부모 상담 주간 안내', cats), 'c0');
  assert.equal(guessCategoryId('중간고사 채점 기준', cats), 'c1');
  assert.equal(guessCategoryId('아무 관련 없는 말', cats), 'c0'); // 모르면 첫 분류
  assert.deepEqual(defaultSteps('', today).map((s) => s.due_date), ['', '', '', '']);
  // 마감이 너무 가까우면 지난 날짜 대신 오늘
  assert.ok(defaultSteps('2026-09-28', today).every((s) => s.due_date >= today));
  assert.ok(similarity('운영비 정산', '학급 운영비 정산하기') > 0.5);
});
