import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFromLongText, extractFromNotice, isLongText, noticeTitle, splitInlineItems } from './notice.js';

const today = '2026-09-28';
const cats = [{ id: 'c0', name: '담임' }, { id: 'c1', name: '수업' }, { id: 'c2', name: '행정업무' }];

// 메신저 안내문을 입력칸(한 줄)에 그대로 붙여넣은 경우
const attendance = '안녕하세요. 1학년 담임선생님들께 9월 출결 관련 안내드립니다. 1) 9월 출결 마감은 10월 5일까지입니다 2) 체험학습 보고서 누락 여부 확인 부탁드립니다 3) 질병결석 증빙서류는 학년부로 제출해 주세요. 감사합니다.';
const welfare = '[2026 맞춤형복지 단체보험 안내] 선생님들 안녕하세요, 교무부입니다. 올해 단체보험 보장 내용은 첨부파일을 확인하시고, 변경을 원하시면 10월 2일(금)까지 복지포털에서 신청해 주시기 바랍니다.';

test('긴 글 판단', () => {
  assert.equal(isLongText('2학기 평가계획 제출'), false);
  assert.equal(isLongText(attendance), true);
  assert.equal(isLongText('짧지만\n두 줄'), true);
});

test('한 줄로 이어진 번호 항목을 나눔 (날짜는 그대로)', () => {
  const s = splitInlineItems('안내 1) 가 하기 2) 나 하기 ① 다 하기 마감 9. 30.(화)까지');
  assert.deepEqual(s.split('\n'), ['안내', '1) 가 하기', '2) 나 하기', '① 다 하기 마감 9. 30.(화)까지']);
});

test('안내문 → 짧은 이름 + 단계 + 기한 + 원문 메모', () => {
  const d = extractFromNotice(attendance, cats, today);
  assert.equal(d.title, '1학년 담임 9월 출결 관련 안내');
  assert.deepEqual(d.steps.map((s) => s.title), ['9월 출결 마감', '체험학습 보고서 누락 여부 확인', '질병결석 증빙서류는 학년부로 제출']);
  assert.equal(d.steps[0].due_date, '2026-10-05');
  assert.equal(d.due_date, '2026-10-05');
  assert.equal(d.category_id, 'c0');
  assert.ok(d.note.includes('질병결석 증빙서류'));
});

test('대괄호 제목 우선, 항목 없으면 확인 단계 하나', () => {
  const d = extractFromNotice(welfare, cats, today);
  assert.equal(d.title, '2026 맞춤형복지 단체보험 안내');
  assert.equal(d.due_date, '2026-10-02');
  assert.equal(d.steps.length, 1);
  assert.equal(d.steps[0].due_date, '2026-10-02');
});

test('자기소개 문장은 이름으로 쓰지 않음', () => {
  assert.equal(noticeTitle('안녕하세요 교무부입니다. 학부모 공개수업 참관록 제출 안내드립니다.'), '학부모 공개수업 참관록 제출 안내');
});

test('긴 글 종류 고르기', () => {
  assert.equal(extractFromLongText(attendance, cats, today).source, '긴 글');
  assert.equal(extractFromLongText('You said:\n운동회 준비 뭐부터 하지?\nChatGPT said:\n1. 종목 정하기', cats, today).source, 'AI 대화');
  assert.equal(extractFromLongText('수신 수신자 참조\n제목 학교폭력 실태조사 안내\n붙임 1. 서식 1부.  끝.', cats, today).source, '공문');
});

test('짧은 대괄호는 보낸 곳 표시라 떼어 냄', () => {
  assert.equal(noticeTitle('[교무부] 2학기 학부모 공개수업 안내\n1) 참관록 양식은 메신저로 보냅니다'), '2학기 학부모 공개수업 안내');
});
