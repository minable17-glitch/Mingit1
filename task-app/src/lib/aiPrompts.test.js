import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, breakdownPrompt, documentPrompt } from './aiPrompts.js';

const today = '2026-09-25';

test('정해진 형식 그대로 온 답', () => {
  const r = parsePlan(`[업무] 과학실 기자재 품의
[마감] 2026-10-20
[분류] 행정업무
[단계]
1. 필요 물품 목록 정리하기 / 2026-10-08
2. 견적 2곳 받기 / 2026-10-13
3. 품의서 기안하기 / 2026-10-15
[다음 행동] 과학실 재고 사진 찍기
[메모] 견적은 2곳 이상 필요`, today);
  assert.equal(r.title, '과학실 기자재 품의');
  assert.equal(r.due_date, '2026-10-20');
  assert.equal(r.category, '행정업무');
  assert.deepEqual(r.steps.map((s) => s.due_date), ['2026-10-08', '2026-10-13', '2026-10-15']);
  assert.equal(r.steps[1].title, '견적 2곳 받기');
  assert.equal(r.next_action, '과학실 재고 사진 찍기');
  assert.equal(r.note, '견적은 2곳 이상 필요');
});

test('마크다운으로 꾸미거나 형식이 조금 다른 답도 읽음', () => {
  const r = parsePlan(`좋아요! 이렇게 해 보세요.

**업무:** 학부모 상담 주간 준비
**마감:** 10월 16일

### 단계
- 상담 신청서 배부하기 (10/5)
- 상담 일정표 만들기 | 10월 8일까지
- 상담 자료 준비하기 - 2026. 10. 14.

**다음 행동:** 가정통신문 양식 찾기`, today);
  assert.equal(r.title, '학부모 상담 주간 준비');
  assert.equal(r.due_date, '2026-10-16');
  assert.deepEqual(r.steps.map((s) => s.title), ['상담 신청서 배부하기', '상담 일정표 만들기', '상담 자료 준비하기']);
  assert.deepEqual(r.steps.map((s) => s.due_date), ['2026-10-05', '2026-10-08', '2026-10-14']);
  assert.equal(r.next_action, '가정통신문 양식 찾기');
});

test('표시 없이 번호 목록만 온 답', () => {
  const r = parsePlan(`1. 자료 모으기\n2. 초안 쓰기\n3. 결재 올리기`, today);
  assert.deepEqual(r.steps.map((s) => s.title), ['자료 모으기', '초안 쓰기', '결재 올리기']);
  assert.ok(r.steps.every((s) => s.due_date === ''));
});

test('읽을 게 없으면 빈 단계', () => {
  assert.equal(parsePlan('죄송하지만 이해하지 못했어요.', today).steps.length, 0);
});

test('질문 문장에 필요한 정보와 답 형식이 들어감', () => {
  const p = breakdownPrompt({ title: '운영비 정산', due_date: '2026-10-10' }, '행정업무', today);
  assert.match(p, /운영비 정산/);
  assert.match(p, /2026-10-10/);
  assert.match(p, /\[단계\]/);
  const d = documentPrompt('공문 본문', [{ name: '담임' }, { name: '수업' }], today);
  assert.match(d, /담임, 수업/);
  assert.match(d, /<문서>\n공문 본문/);
});
