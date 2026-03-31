import {test} from 'node:test';
import assert from 'node:assert/strict';

import {shouldInspectBusySlotBeforeToggle} from '../src/lib/availability-interactions.ts';

test('touch users inspect a busy slot before toggling it', () => {
  assert.equal(shouldInspectBusySlotBeforeToggle('touch', true, null, '2026-04-04T15:00'), true);
  assert.equal(shouldInspectBusySlotBeforeToggle('touch', true, '2026-04-04T15:00', '2026-04-04T15:00'), false);
});

test('non-touch or non-busy slots toggle immediately', () => {
  assert.equal(shouldInspectBusySlotBeforeToggle('mouse', true, null, '2026-04-04T15:00'), false);
  assert.equal(shouldInspectBusySlotBeforeToggle('touch', false, null, '2026-04-04T15:00'), false);
});
