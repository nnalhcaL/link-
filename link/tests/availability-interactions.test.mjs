import {test} from 'node:test';
import assert from 'node:assert/strict';

import {
  getMobileDatePageRange,
  getMobileVisibleDayCount,
  getSlotPointerDownBehavior,
} from '../src/lib/availability-interactions.ts';

test('touch busy slots activate the inspector without blocking paint', () => {
  assert.deepEqual(getSlotPointerDownBehavior('touch', true), {
    shouldActivateBusySlotPreview: true,
    shouldBeginPaint: true,
  });
});

test('all other pointer-down cases still begin paint immediately', () => {
  assert.deepEqual(getSlotPointerDownBehavior('mouse', true), {
    shouldActivateBusySlotPreview: false,
    shouldBeginPaint: true,
  });
  assert.deepEqual(getSlotPointerDownBehavior('touch', false), {
    shouldActivateBusySlotPreview: false,
    shouldBeginPaint: true,
  });
});

test('mobile day count uses three columns on standard iphone widths and two below that', () => {
  assert.equal(getMobileVisibleDayCount(390), 3);
  assert.equal(getMobileVisibleDayCount(430), 3);
  assert.equal(getMobileVisibleDayCount(389), 2);
  assert.equal(getMobileVisibleDayCount(320), 2);
});

test('mobile date pages snap to full groups of visible days', () => {
  assert.deepEqual(getMobileDatePageRange(0, 3, 12), {startIndex: 0, endIndex: 3});
  assert.deepEqual(getMobileDatePageRange(2, 3, 12), {startIndex: 0, endIndex: 3});
  assert.deepEqual(getMobileDatePageRange(3, 3, 12), {startIndex: 3, endIndex: 6});
  assert.deepEqual(getMobileDatePageRange(11, 3, 12), {startIndex: 9, endIndex: 12});
  assert.deepEqual(getMobileDatePageRange(6, 2, 7), {startIndex: 6, endIndex: 7});
});
