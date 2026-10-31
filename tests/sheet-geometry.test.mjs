import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetGeometry, KEYBOARD_THRESHOLD } from '../src/sheet-geometry.js';

test('keyboard up follows the visible height', () => {
  assert.equal(KEYBOARD_THRESHOLD, 100);
  assert.deepEqual(sheetGeometry({ innerHeight: 844, vvHeight: 508 }), {
    vvHeight: 508, bottom: 336, keyboardHeight: 336, keyboardOpen: true, dockInset: 0, maxSheetHeight: 508,
  });
});

test('keyboard down uses the full height, including browser-bar jitter', () => {
  for (const vvHeight of [844, 800, 745, 860]) {
    assert.deepEqual(sheetGeometry({ innerHeight: 844, vvHeight }), {
      vvHeight: 844, bottom: 0, keyboardHeight: Math.max(0, 844 - vvHeight),
      keyboardOpen: false, dockInset: 0, maxSheetHeight: 844,
    });
  }
  assert.equal(sheetGeometry({ innerHeight: 844, vvHeight: 744 }).keyboardOpen, true);
});

test('scrolled visual viewport reduces the bottom offset', () => {
  assert.deepEqual(sheetGeometry({ innerHeight: 844, vvHeight: 508, vvOffsetTop: 40 }), {
    vvHeight: 508, bottom: 296, keyboardHeight: 296, keyboardOpen: true, dockInset: 0, maxSheetHeight: 508,
  });
});

test('safe areas affect the dock and maximum height without changing raw height', () => {
  assert.deepEqual(sheetGeometry({ innerHeight: 844, vvHeight: 508, safeTop: 47, safeBottom: 34 }), {
    vvHeight: 508, bottom: 336, keyboardHeight: 336, keyboardOpen: true, dockInset: 0, maxSheetHeight: 461,
  });
  assert.deepEqual(sheetGeometry({ innerHeight: 844, vvHeight: 844, safeTop: 47, safeBottom: 34 }), {
    vvHeight: 844, bottom: 0, keyboardHeight: 0, keyboardOpen: false, dockInset: 34, maxSheetHeight: 797,
  });
  assert.equal(sheetGeometry({ innerHeight: 30, vvHeight: 30, safeTop: 47 }).maxSheetHeight, 0);
});

test('rotation uses each orientation and its keyboard dimensions', () => {
  for (const [innerHeight, vvHeight, keyboardOpen, bottom] of [
    [844, 508, true, 336], [390, 390, false, 0], [390, 180, true, 210],
  ]) {
    const result = sheetGeometry({ innerHeight, vvHeight });
    assert.equal(result.keyboardOpen, keyboardOpen);
    assert.equal(result.bottom, bottom);
    assert.equal(result.vvHeight, vvHeight);
  }
});

test('pinch zoom preserves the layout height and safe bottom inset', () => {
  assert.deepEqual(sheetGeometry({ innerHeight: 844, vvHeight: 422, vvScale: 2, safeTop: 47, safeBottom: 34 }), {
    vvHeight: 844, bottom: 0, keyboardHeight: 422, keyboardOpen: false, dockInset: 34, maxSheetHeight: 797,
  });
  assert.equal(sheetGeometry({ innerHeight: 844, vvHeight: 508, vvScale: 1.01 }).keyboardOpen, true);
});
