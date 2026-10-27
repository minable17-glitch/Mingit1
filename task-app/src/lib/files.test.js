import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filesFrom, isImage, nameCapture, sizeLabel } from './files.js';

test('붙여넣기에서 파일만 꺼냄', () => {
  const f = new File(['x'], 'a.png', { type: 'image/png' });
  assert.deepEqual(filesFrom({ files: [f] }), [f]);
  assert.deepEqual(filesFrom({ files: [], items: [{ kind: 'string' }, { kind: 'file', getAsFile: () => f }] }), [f]);
  assert.deepEqual(filesFrom({ files: [], items: [{ kind: 'string' }] }), []); // 글자만 붙여넣기
  assert.deepEqual(filesFrom(null), []);
});

test('캡처 이름·크기·사진 판별', () => {
  const now = Date.parse('2026-10-27T05:03:00Z'); // 14:03 KST
  assert.equal(nameCapture(new File(['x'], 'image.png', { type: 'image/png' }), now).name, '캡처 2026-10-27 1403.png');
  assert.equal(nameCapture(new File(['x'], '', { type: 'image/jpeg' }), now).name, '캡처 2026-10-27 1403.jpg');
  assert.equal(nameCapture(new File(['x'], '공문.pdf', { type: 'application/pdf' }), now).name, '공문.pdf');
  assert.equal(sizeLabel(500), '1KB');
  assert.equal(sizeLabel(2.5 * 1024 * 1024), '2.5MB');
  assert.ok(isImage({ mime: 'image/png' }));
  assert.ok(!isImage({ mime: 'application/pdf' }));
});
