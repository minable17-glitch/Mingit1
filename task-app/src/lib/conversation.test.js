import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractActionItems, extractFromConversation, looksLikeOfficialDoc } from './conversation.js';

const today = '2026-09-28';
const cats = [{ id: 'c0', name: '담임' }, { id: 'c1', name: '수업' }, { id: 'c2', name: '행정업무' }];

const chat = `You said:
다음 달 과학의 날 행사 준비해야 하는데 뭐부터 하지? 10월 23일이 행사야

ChatGPT said:
좋아요! 과학의 날 행사를 순서대로 정리해 볼게요.

### 과학의 날 행사 준비

**1. 기획 단계**
1. 행사 계획서 초안 쓰기 (10/2)
2. 교무회의에서 일정 공유하기 - 10월 6일

**2. 준비물**
준비물:
- [ ] 실험 재료 목록 만들기
- [ ] 물품 구입 품의 올리기 | 10월 12일까지
- 물품 구입 품의 올리기

3. 당일 운영
- 부스별 담당 교사 배정하기
- 학생 안내 가정통신문 보내기 (10/16)

혹시 예산은 얼마나 되나요?
도움이 되었길 바랍니다!`;

test('대화에서 할 일을 이야기한 순서대로 뽑음', () => {
  const items = extractActionItems(chat, today);
  assert.deepEqual(items.map((i) => i.title), [
    '행사 계획서 초안 쓰기',
    '교무회의에서 일정 공유하기',
    '실험 재료 목록 만들기',
    '물품 구입 품의 올리기',
    '당일 운영',
    '부스별 담당 교사 배정하기',
    '학생 안내 가정통신문 보내기',
  ]);
  const byTitle = Object.fromEntries(items.map((i) => [i.title, i.due_date]));
  assert.equal(byTitle['행사 계획서 초안 쓰기'], '2026-10-02');
  assert.equal(byTitle['교무회의에서 일정 공유하기'], '2026-10-06');
  assert.equal(byTitle['물품 구입 품의 올리기'], '2026-10-12');
  assert.equal(byTitle['학생 안내 가정통신문 보내기'], '2026-10-16');
});

test('대화 → 업무 초안 (제목·마감·다음 행동)', () => {
  const d = extractFromConversation(chat, cats, today);
  assert.equal(d.title, '과학의 날 행사 준비');
  assert.equal(d.due_date, '2026-10-23'); // 대화에 나온 가장 늦은 날짜 = 행사일
  assert.equal(d.next_action, '행사 계획서 초안 쓰기');
  assert.equal(d.category_id, 'c2'); // 품의·구입 → 행정업무
});

test('목록이 없으면 빈 단계 하나', () => {
  const d = extractFromConversation('그냥 생각나는 대로 쓴 글이에요.', cats, today);
  assert.equal(d.steps.length, 1);
  assert.equal(d.steps[0].title, '');
});

test('공문과 대화 구분', () => {
  assert.equal(looksLikeOfficialDoc('수신 수신자 참조\n제목 학교폭력 실태조사 안내\n붙임 1. 서식 1부.  끝.'), true);
  assert.equal(looksLikeOfficialDoc(chat), false);
});

test('업무 이름: 소제목 대신 첫 질문에서', () => {
  const t = (x) => extractFromConversation(x, cats, today).title;
  assert.equal(t('나: 학부모 상담 주간 준비 순서 좀 정리해줘. 10월 20일부터야\nAI: 좋아요\n**1. 사전 준비**\n1. 가정통신문 보내기'), '학부모 상담 주간 준비');
  assert.equal(t('You said:\n운동회 준비 뭐부터 하지?\nChatGPT said:\n1. 종목 정하기'), '운동회 준비');
  assert.equal(t('# 2학기 평가계획\n1. 성취기준 정리하기'), '2학기 평가계획');
});
