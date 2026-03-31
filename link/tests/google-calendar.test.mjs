import {test} from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBusySlotKeysForEvent,
  buildGoogleCalendarImportProjection,
  fetchGoogleBusyDetails,
  normalizeGoogleEventBoundary,
} from '../src/lib/google-calendar.ts';

test('normalizeGoogleEventBoundary respects a Google-supplied timezone for floating dateTimes', () => {
  const normalized = normalizeGoogleEventBoundary(
    {
      dateTime: '2026-04-04T15:30:00',
      timeZone: 'Australia/Sydney',
    },
    'UTC',
  );

  assert.ok(normalized);
  assert.equal(normalized.isAllDay, false);
  assert.equal(normalized.value, '2026-04-04T04:30:00.000Z');
});

test('overlapping partial-hour Google events block every touched hour slot', () => {
  const event = {
    dates: ['2026-04-04'],
    timeRangeStart: '09:00',
    timeRangeEnd: '17:00',
    timezone: 'Australia/Sydney',
  };

  const birthday = normalizeGoogleEventBoundary(
    {
      dateTime: '2026-04-04T12:00:00',
      timeZone: 'Australia/Sydney',
    },
    event.timezone,
  );
  const birthdayEnd = normalizeGoogleEventBoundary(
    {
      dateTime: '2026-04-04T16:30:00',
      timeZone: 'Australia/Sydney',
    },
    event.timezone,
  );
  const hike = normalizeGoogleEventBoundary(
    {
      dateTime: '2026-04-04T15:30:00',
      timeZone: 'Australia/Sydney',
    },
    event.timezone,
  );
  const hikeEnd = normalizeGoogleEventBoundary(
    {
      dateTime: '2026-04-04T19:30:00',
      timeZone: 'Australia/Sydney',
    },
    event.timezone,
  );

  assert.ok(birthday && birthdayEnd && hike && hikeEnd);

  const busySlotKeys = buildBusySlotKeysForEvent(event, [
    {start: birthday.value, end: birthdayEnd.value},
    {start: hike.value, end: hikeEnd.value},
  ]);

  assert.deepEqual([...busySlotKeys], [
    '2026-04-04T12:00',
    '2026-04-04T13:00',
    '2026-04-04T14:00',
    '2026-04-04T15:00',
    '2026-04-04T16:00',
  ]);
});

test('all-day events block the full visible day, including the final late slot', () => {
  const event = {
    dates: ['2026-04-06'],
    timeRangeStart: '17:00',
    timeRangeEnd: '24:00',
    timezone: 'Australia/Sydney',
  };

  const allDayStart = normalizeGoogleEventBoundary(
    {
      date: '2026-04-06',
      timeZone: 'Australia/Sydney',
    },
    event.timezone,
  );
  const allDayEnd = normalizeGoogleEventBoundary(
    {
      date: '2026-04-07',
      timeZone: 'Australia/Sydney',
    },
    event.timezone,
  );

  assert.ok(allDayStart && allDayEnd);

  const busySlotKeys = buildBusySlotKeysForEvent(event, [{start: allDayStart.value, end: allDayEnd.value}]);

  assert.deepEqual([...busySlotKeys], [
    '2026-04-06T17:00',
    '2026-04-06T18:00',
    '2026-04-06T19:00',
    '2026-04-06T20:00',
    '2026-04-06T21:00',
    '2026-04-06T22:00',
    '2026-04-06T23:00',
  ]);
});

test('projection keeps blocked slots and rendered details in sync for overlapping events', () => {
  const event = {
    dates: ['2026-04-04'],
    timeRangeStart: '09:00',
    timeRangeEnd: '21:00',
    timezone: 'Australia/Sydney',
  };
  const calendar = {
    id: 'primary',
    summary: 'Lachlan (main)',
    description: null,
    primary: true,
    selected: true,
    accessRole: 'owner',
  };
  const michelleStart = normalizeGoogleEventBoundary(
    {
      dateTime: '2026-04-04T12:00:00',
      timeZone: 'Australia/Sydney',
    },
    event.timezone,
  );
  const michelleEnd = normalizeGoogleEventBoundary(
    {
      dateTime: '2026-04-04T16:30:00',
      timeZone: 'Australia/Sydney',
    },
    event.timezone,
  );
  const hikeStart = normalizeGoogleEventBoundary(
    {
      dateTime: '2026-04-04T15:30:00',
      timeZone: 'Australia/Sydney',
    },
    event.timezone,
  );
  const hikeEnd = normalizeGoogleEventBoundary(
    {
      dateTime: '2026-04-04T19:30:00',
      timeZone: 'Australia/Sydney',
    },
    event.timezone,
  );

  assert.ok(michelleStart && michelleEnd && hikeStart && hikeEnd);

  const projection = buildGoogleCalendarImportProjection(
    event,
    [
      {calendarId: 'primary', start: michelleStart.value, end: michelleEnd.value},
      {calendarId: 'primary', start: hikeStart.value, end: hikeEnd.value},
    ],
    [
      {
        id: 'michelle',
        slotKey: '',
        calendarId: 'primary',
        calendarSummary: 'Lachlan (main)',
        title: "Michelle's 21st",
        start: michelleStart.value,
        end: michelleEnd.value,
        isAllDay: false,
        detailsAvailable: true,
      },
      {
        id: 'hike',
        slotKey: '',
        calendarId: 'primary',
        calendarSummary: 'Lachlan (main)',
        title: 'easter hike',
        start: hikeStart.value,
        end: hikeEnd.value,
        isAllDay: false,
        detailsAvailable: true,
      },
    ],
    [calendar],
  );

  assert.deepEqual([...projection.busySlotKeys], [
    '2026-04-04T12:00',
    '2026-04-04T13:00',
    '2026-04-04T14:00',
    '2026-04-04T15:00',
    '2026-04-04T16:00',
    '2026-04-04T17:00',
    '2026-04-04T18:00',
    '2026-04-04T19:00',
  ]);

  assert.deepEqual(
    projection.busyDetailsBySlot['2026-04-04T15:00']?.map((detail) => detail.title),
    ["Michelle's 21st", 'easter hike'],
  );
  assert.deepEqual(
    projection.busyDetailsBySlot['2026-04-04T17:00']?.map((detail) => detail.title),
    ['easter hike'],
  );

  for (const slotKey of Object.keys(projection.busyDetailsBySlot)) {
    assert.equal(
      projection.busySlotKeys.has(slotKey),
      true,
      `Expected ${slotKey} to be marked busy if it renders Google Calendar details`,
    );
  }
});

test('Google event details include free-marked and all-day events so the projection can block them', async () => {
  const event = {
    dates: ['2026-04-04'],
    timeRangeStart: '09:00',
    timeRangeEnd: '21:00',
    timezone: 'Australia/Sydney',
  };
  const calendars = [
    {
      id: 'lach.ng168@gmail.com',
      summary: 'Lachlan (main)',
      description: null,
      primary: true,
      selected: true,
      accessRole: 'owner',
    },
  ];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        items: [
          {
            id: 'michelle',
            summary: "Michelle's 21st",
            transparency: 'transparent',
            start: {dateTime: '2026-04-04T12:00:00', timeZone: 'Australia/Sydney'},
            end: {dateTime: '2026-04-04T16:30:00', timeZone: 'Australia/Sydney'},
          },
          {
            id: 'hike',
            summary: 'easter hike',
            transparency: 'transparent',
            start: {dateTime: '2026-04-04T15:30:00', timeZone: 'Australia/Sydney'},
            end: {dateTime: '2026-04-04T19:30:00', timeZone: 'Australia/Sydney'},
          },
          {
            id: 'holy-saturday',
            summary: 'Holy Saturday',
            transparency: 'transparent',
            start: {date: '2026-04-04', timeZone: 'Australia/Sydney'},
            end: {date: '2026-04-05', timeZone: 'Australia/Sydney'},
          },
        ],
      }),
      {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      },
    );

  try {
    const busyDetails = await fetchGoogleBusyDetails('token', calendars, event);

    assert.deepEqual(
      busyDetails.map((detail) => detail.title),
      ["Michelle's 21st", 'easter hike', 'Holy Saturday'],
    );

    const projection = buildGoogleCalendarImportProjection(event, [], busyDetails, calendars);

    assert.deepEqual([...projection.busySlotKeys], [
      '2026-04-04T09:00',
      '2026-04-04T10:00',
      '2026-04-04T11:00',
      '2026-04-04T12:00',
      '2026-04-04T13:00',
      '2026-04-04T14:00',
      '2026-04-04T15:00',
      '2026-04-04T16:00',
      '2026-04-04T17:00',
      '2026-04-04T18:00',
      '2026-04-04T19:00',
      '2026-04-04T20:00',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
