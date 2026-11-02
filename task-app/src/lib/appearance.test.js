import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appearanceVars, DEFAULT_APPEARANCE, normalizeAppearance } from './appearance.js';

test('화면 꾸미기 값 정리', () => {
  assert.deepEqual(normalizeAppearance(null), DEFAULT_APPEARANCE);
  assert.deepEqual(normalizeAppearance({ accent: '#E5488E', size: 'xl' }), { ...DEFAULT_APPEARANCE, accent: '#e5488e', size: 'xl' });
  assert.equal(normalizeAppearance({ accent: 'red; x' }).accent, DEFAULT_APPEARANCE.accent); // 이상한 값은 기본값
  assert.equal(normalizeAppearance({ size: 'huge', bg: 'neon' }).size, 'md');
  const v = appearanceVars({ accent: '#12a150', size: 'lg', contrast: 'normal', bg: 'warm' });
  assert.equal(v.style['--primary'], '#12a150');
  assert.equal(v.style['font-size'], '17.5px');
  assert.match(v.style['--primary-soft'], /color-mix\(in srgb, #12a150 13%/);
  assert.deepEqual(v.data, { contrast: 'normal', bg: 'warm' });
});
