import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daySummaryLine, isEmptyDay, looksClassRelated, periodRows } from './planner.js';

test('교시 칸은 언제나 0~7교시 8칸', () => {
  const rows = periodRows([{ a: '2-3', b: '수행평가' }, null, { a: '1-1' }]);
  assert.equal(rows.length, 8);
  assert.deepEqual(rows[0], { a: '2-3', b: '수행평가' });
  assert.deepEqual(rows[1], { a: '', b: '' });
  assert.deepEqual(rows[2], { a: '1-1', b: '' });
});

test('비었는지·요약', () => {
  assert.equal(isEmptyDay(null), true);
  assert.equal(isEmptyDay({ memo: ' ', reflection: '', periods: [] }), true);
  assert.equal(isEmptyDay({ memo: '', reflection: '', periods: [] }, [{ done: false }]), false);
  assert.deepEqual(daySummaryLine({ memo: '공개수업 날\n준비물', periods: [{ a: '2-1', b: '' }, { a: '', b: '자습' }] }, [{ done: true }, { done: false }]),
    { memo: '공개수업 날', filled: 2, done: 1, total: 2 });
});

test('학급 관련 글 알아보기', () => {
  assert.equal(looksClassRelated('내일 조회 때 체험학습 신청서 안내'), true);
  assert.equal(looksClassRelated('김OO 학부모 상담 전화'), true);
  assert.equal(looksClassRelated('운영비 영수증 정산'), false);
});
