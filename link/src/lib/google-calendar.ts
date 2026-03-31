import type {EventRecord, GoogleCalendarBusyDetail, GoogleCalendarRecord} from './types.ts';
import {buildSlotKey, generateTimeRows} from './utils.ts';

const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_CONNECT_HINT_KEY = 'link:google:connect-hint';
const GOOGLE_SELECTED_CALENDARS_PREFIX = 'link:google:selected-calendars:';
const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

interface GoogleCalendarApiListResponse {
  items?: Array<{
    id?: string;
    summary?: string;
    summaryOverride?: string;
    description?: string;
    primary?: boolean;
    selected?: boolean;
    accessRole?: string;
  }>;
}

interface GoogleCalendarEventsResponse {
  items?: Array<{
    id?: string;
    summary?: string;
    status?: string;
    visibility?: string;
    transparency?: string;
    start?: {
      date?: string;
      dateTime?: string;
      timeZone?: string;
    };
    end?: {
      date?: string;
      dateTime?: string;
      timeZone?: string;
    };
  }>;
  nextPageToken?: string;
}

interface GoogleCalendarFreeBusyResponse {
  calendars?: Record<
    string,
    {
      busy?: Array<{
        start?: string;
        end?: string;
      }>;
      errors?: Array<{
        reason?: string;
      }>;
    }
  >;
}

interface GoogleApiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{
      message?: string;
      reason?: string;
    }>;
  };
}

interface GoogleBusyInterval {
  start: string;
  end: string;
  calendarId: string;
}

export interface GoogleCalendarBlockingInterval {
  id: string;
  calendarId: string;
  calendarSummary: string;
  title: string;
  start: string;
  end: string;
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  detailsAvailable: boolean;
}

export interface GoogleCalendarImportProjection {
  blockingIntervals: GoogleCalendarBlockingInterval[];
  busySlotKeys: Set<string>;
  freeSlotKeys: string[];
  busyDetailsBySlot: Record<string, GoogleCalendarBusyDetail[]>;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: {type?: string}) => void;
}

interface GoogleTokenRequestOptions {
  prompt?: '' | 'consent';
}

interface GoogleAccountsOauth2 {
  initTokenClient: (config: GoogleTokenClientConfig) => {
    requestAccessToken: (options?: GoogleTokenRequestOptions) => void;
  };
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GoogleAccountsOauth2;
      };
    };
  }
}

let googleIdentityScriptPromise: Promise<void> | null = null;

function getSelectedCalendarsStorageKey(eventId: string) {
  return `${GOOGLE_SELECTED_CALENDARS_PREFIX}${eventId}`;
}

function getDateTimeFormatter(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const parts = getDateTimeFormatter(timeZone).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(lookup.year);
  const month = Number(lookup.month);
  const day = Number(lookup.day);
  const hour = Number(lookup.hour);
  const minute = Number(lookup.minute);
  const second = Number(lookup.second);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);

  return asUtc - date.getTime();
}

function zonedDateTimeToUtcDate(dateValue: string, timeValue: string, timeZone: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const firstOffset = getTimeZoneOffsetMilliseconds(utcGuess, timeZone);
  const firstPass = new Date(utcGuess.getTime() - firstOffset);
  const refinedOffset = getTimeZoneOffsetMilliseconds(firstPass, timeZone);

  return new Date(utcGuess.getTime() - refinedOffset);
}

function hasExplicitUtcOffset(dateTimeValue: string) {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(dateTimeValue);
}

function normalizeGoogleDateTimeValue(dateTimeValue: string, timeZone: string) {
  if (hasExplicitUtcOffset(dateTimeValue)) {
    const parsedDate = new Date(dateTimeValue);

    return Number.isFinite(parsedDate.getTime()) ? parsedDate : null;
  }

  const match = dateTimeValue.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?$/);

  if (!match) {
    const parsedDate = new Date(dateTimeValue);

    return Number.isFinite(parsedDate.getTime()) ? parsedDate : null;
  }

  const [, dateValue, hour, minute, second = '00', fractionalSecond = '0'] = match;
  const normalizedDate = zonedDateTimeToUtcDate(dateValue, `${hour}:${minute}`, timeZone);
  const millisecondValue = Number(`0.${fractionalSecond}`) * 1000;

  normalizedDate.setUTCSeconds(Number(second), Number.isFinite(millisecondValue) ? Math.round(millisecondValue) : 0);
  return normalizedDate;
}

function buildEventSlotRanges(event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd' | 'timezone'>) {
  return event.dates.flatMap((date) =>
    generateTimeRows(event.timeRangeStart, event.timeRangeEnd).map((time) => {
      const startDate = zonedDateTimeToUtcDate(date, time, event.timezone);

      return {
        slotKey: buildSlotKey(date, time),
        startTime: startDate.getTime(),
        endTime: startDate.getTime() + HOUR_IN_MILLISECONDS,
      };
    }),
  );
}

function buildEventTimeBounds(event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd' | 'timezone'>) {
  const slotRanges = buildEventSlotRanges(event);

  if (slotRanges.length === 0) {
    return null;
  }

  return {
    slotRanges,
    timeMin: new Date(Math.min(...slotRanges.map((slot) => slot.startTime))).toISOString(),
    timeMax: new Date(Math.max(...slotRanges.map((slot) => slot.endTime))).toISOString(),
  };
}

export function normalizeGoogleEventBoundary(
  boundary: {date?: string; dateTime?: string; timeZone?: string} | undefined,
  fallbackTimeZone: string,
) {
  if (!boundary) {
    return null;
  }

  if (boundary.dateTime) {
    const parsedDate = normalizeGoogleDateTimeValue(boundary.dateTime, boundary.timeZone ?? fallbackTimeZone);

    if (!parsedDate || !Number.isFinite(parsedDate.getTime())) {
      return null;
    }

    return {
      value: parsedDate.toISOString(),
      isAllDay: false,
    };
  }

  if (boundary.date) {
    return {
      value: zonedDateTimeToUtcDate(boundary.date, '00:00', boundary.timeZone ?? fallbackTimeZone).toISOString(),
      isAllDay: true,
    };
  }

  return null;
}

function buildBlockingIntervalsForEvent(
  event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd' | 'timezone'>,
  busyIntervals: GoogleBusyInterval[],
  busyDetails: GoogleCalendarBusyDetail[],
  calendars: GoogleCalendarRecord[],
) {
  const calendarLookup = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  const normalizedDetailedIntervals = busyDetails
    .map((detail) => ({
      id: detail.id,
      calendarId: detail.calendarId,
      calendarSummary: detail.calendarSummary || calendarLookup.get(detail.calendarId)?.summary || 'Google Calendar',
      title: detail.title || 'Busy',
      start: detail.start,
      end: detail.end,
      startTime: new Date(detail.start).getTime(),
      endTime: new Date(detail.end).getTime(),
      isAllDay: detail.isAllDay,
      detailsAvailable: detail.detailsAvailable,
    }))
    .filter(
      (detail): detail is GoogleCalendarBlockingInterval =>
        Number.isFinite(detail.startTime) && Number.isFinite(detail.endTime) && detail.startTime < detail.endTime,
    );
  const normalizedFallbackIntervals = busyIntervals
    .map((interval) => ({
      id: `${interval.calendarId}:${interval.start}:${interval.end}:fallback`,
      calendarId: interval.calendarId,
      calendarSummary: calendarLookup.get(interval.calendarId)?.summary || 'Google Calendar',
      title: 'Busy',
      start: interval.start,
      end: interval.end,
      startTime: new Date(interval.start).getTime(),
      endTime: new Date(interval.end).getTime(),
      isAllDay: isAllDayBusyInterval(interval.start, interval.end, event.timezone),
      detailsAvailable: false,
    }))
    .filter(
      (interval): interval is GoogleCalendarBlockingInterval =>
        Number.isFinite(interval.startTime) && Number.isFinite(interval.endTime) && interval.startTime < interval.endTime,
    );
  const intervalByKey = new Map<string, GoogleCalendarBlockingInterval>();

  for (const interval of [...normalizedFallbackIntervals, ...normalizedDetailedIntervals]) {
    const dedupeKey = `${interval.calendarId}:${interval.startTime}:${interval.endTime}`;
    const existingInterval = intervalByKey.get(dedupeKey);

    if (!existingInterval || (!existingInterval.detailsAvailable && interval.detailsAvailable)) {
      intervalByKey.set(dedupeKey, interval);
    }
  }

  return [...intervalByKey.values()].sort((left, right) => {
    if (left.startTime !== right.startTime) {
      return left.startTime - right.startTime;
    }

    if (left.endTime !== right.endTime) {
      return left.endTime - right.endTime;
    }

    if (left.calendarSummary !== right.calendarSummary) {
      return left.calendarSummary.localeCompare(right.calendarSummary);
    }

    if (left.detailsAvailable !== right.detailsAvailable) {
      return left.detailsAvailable ? -1 : 1;
    }

    return left.title.localeCompare(right.title);
  });
}

function buildBusySlotKeysFromBlockingIntervals(
  event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd' | 'timezone'>,
  blockingIntervals: GoogleCalendarBlockingInterval[],
) {
  const slotRanges = buildEventSlotRanges(event);
  const busySlotKeys = new Set<string>();

  for (const slot of slotRanges) {
    if (blockingIntervals.some((interval) => slot.startTime < interval.endTime && interval.startTime < slot.endTime)) {
      busySlotKeys.add(slot.slotKey);
    }
  }

  return busySlotKeys;
}

function buildBusyDetailsBySlotFromBlockingIntervals(
  event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd' | 'timezone'>,
  blockingIntervals: GoogleCalendarBlockingInterval[],
) {
  const slotRanges = buildEventSlotRanges(event);
  const detailsBySlot: Record<string, GoogleCalendarBusyDetail[]> = {};

  for (const slot of slotRanges) {
    const overlappingIntervals = blockingIntervals.filter(
      (interval) => slot.startTime < interval.endTime && interval.startTime < slot.endTime,
    );

    if (overlappingIntervals.length === 0) {
      continue;
    }

    const calendarsWithDetailedIntervals = new Set(
      overlappingIntervals.filter((interval) => interval.detailsAvailable).map((interval) => interval.calendarId),
    );
    const slotDetails = overlappingIntervals
      .filter((interval) => interval.detailsAvailable || !calendarsWithDetailedIntervals.has(interval.calendarId))
      .map(
        (interval) =>
          ({
            id: interval.id,
            slotKey: slot.slotKey,
            calendarId: interval.calendarId,
            calendarSummary: interval.calendarSummary,
            title: interval.title,
            start: interval.start,
            end: interval.end,
            isAllDay: interval.isAllDay,
            detailsAvailable: interval.detailsAvailable,
          }) satisfies GoogleCalendarBusyDetail,
      );

    if (slotDetails.length === 0) {
      continue;
    }

    const seen = new Set<string>();
    detailsBySlot[slot.slotKey] = slotDetails
      .sort((left, right) => {
        const leftStart = new Date(left.start).getTime();
        const rightStart = new Date(right.start).getTime();

        if (leftStart !== rightStart) {
          return leftStart - rightStart;
        }

        if (left.calendarSummary !== right.calendarSummary) {
          return left.calendarSummary.localeCompare(right.calendarSummary);
        }

        if (left.detailsAvailable !== right.detailsAvailable) {
          return left.detailsAvailable ? -1 : 1;
        }

        return left.title.localeCompare(right.title);
      })
      .filter((detail) => {
        const uniqueKey = `${detail.id}:${detail.start}:${detail.end}:${detail.calendarId}:${detail.title}`;

        if (seen.has(uniqueKey)) {
          return false;
        }

        seen.add(uniqueKey);
        return true;
      });
  }

  return detailsBySlot;
}

function normalizeStoredCalendarIds(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function getLocalTimeParts(value: string, timeZone: string) {
  const parts = getDateTimeFormatter(timeZone).formatToParts(new Date(value));
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: lookup.year ?? '',
    month: lookup.month ?? '',
    day: lookup.day ?? '',
    hour: lookup.hour ?? '',
    minute: lookup.minute ?? '',
  };
}

function isAllDayBusyInterval(start: string, end: string, timeZone: string) {
  const startParts = getLocalTimeParts(start, timeZone);
  const endParts = getLocalTimeParts(end, timeZone);

  return startParts.hour === '00' && startParts.minute === '00' && endParts.hour === '00' && endParts.minute === '00' && start < end;
}

function buildAuthorizedRequestHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function readGoogleApiErrorMessage(response: Response, fallbackMessage: string) {
  if (response.status === 401) {
    return 'Google Calendar connection expired.';
  }

  try {
    const payload = (await response.clone().json()) as GoogleApiErrorPayload;
    const topLevelMessage = payload.error?.message?.trim() ?? '';
    const firstReason = payload.error?.errors?.[0]?.reason?.trim() ?? '';
    const firstMessage = payload.error?.errors?.[0]?.message?.trim() ?? '';
    const details = firstMessage || topLevelMessage;

    if (firstReason === 'accessNotConfigured' || /calendar api has not been used|api has not been used|service has not been used/i.test(details)) {
      return 'Enable the Google Calendar API for this Google Cloud project, then try again.';
    }

    if (firstReason === 'insufficientPermissions') {
      return 'Google Calendar permission was not granted. Reconnect Google Calendar and approve access.';
    }

    if (firstReason === 'forbidden' || response.status === 403) {
      return details || 'Google Calendar access was denied for this project or account.';
    }

    if (details) {
      return details;
    }
  } catch {
    // Fall back to the default message when Google does not return JSON.
  }

  return fallbackMessage;
}

export async function loadGoogleIdentityScript() {
  if (typeof window === 'undefined') {
    throw new Error('Google Identity Services can only load in the browser.');
  }

  if (window.google?.accounts.oauth2) {
    return;
  }

  if (!googleIdentityScriptPromise) {
    googleIdentityScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`);

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), {once: true});
        existingScript.addEventListener('error', () => reject(new Error('Google Identity Services failed to load.')), {once: true});
        return;
      }

      const script = document.createElement('script');
      script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Identity Services failed to load.'));
      document.head.appendChild(script);
    }).catch((error) => {
      googleIdentityScriptPromise = null;
      throw error;
    });
  }

  await googleIdentityScriptPromise;

  if (!window.google?.accounts.oauth2) {
    throw new Error('Google Identity Services did not initialize correctly.');
  }
}

export async function requestGoogleAccessToken(clientId: string, prompt: '' | 'consent') {
  if (!clientId.trim()) {
    throw new Error('Missing Google client ID.');
  }

  await loadGoogleIdentityScript();

  return await new Promise<string>((resolve, reject) => {
    const tokenClient = window.google?.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || 'Google Calendar authorization failed.'));
          return;
        }

        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(new Error(error.type || 'Google Calendar authorization failed.'));
      },
    });

    if (!tokenClient) {
      reject(new Error('Google Identity Services is unavailable.'));
      return;
    }

    tokenClient.requestAccessToken({prompt});
  });
}

export async function fetchGoogleCalendars(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=freeBusyReader&showDeleted=false&showHidden=false', {
    headers: buildAuthorizedRequestHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error(await readGoogleApiErrorMessage(response, 'Could not load Google calendars.'));
  }

  const payload = (await response.json()) as GoogleCalendarApiListResponse;
  const calendars = (payload.items ?? [])
    .map((calendar) => {
      const id = calendar.id?.trim() ?? '';
      const summary = calendar.summaryOverride?.trim() || calendar.summary?.trim() || '';

      if (!id || !summary) {
        return null;
      }

      return {
        id,
        summary,
        description: calendar.description?.trim() || null,
        primary: Boolean(calendar.primary),
        selected: Boolean(calendar.selected),
        accessRole: calendar.accessRole?.trim() || 'freeBusyReader',
      } satisfies GoogleCalendarRecord;
    })
    .filter((calendar): calendar is GoogleCalendarRecord => calendar !== null);

  if (calendars.length === 0) {
    throw new Error('No readable Google calendars were found for this account.');
  }

  return calendars;
}

export async function fetchGoogleBusyIntervals(
  accessToken: string,
  calendarIds: string[],
  event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd' | 'timezone'>,
) {
  if (calendarIds.length === 0) {
    throw new Error('Choose at least one Google calendar to import.');
  }

  const eventTimeBounds = buildEventTimeBounds(event);

  if (!eventTimeBounds) {
    return [];
  }

  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      ...buildAuthorizedRequestHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: eventTimeBounds.timeMin,
      timeMax: eventTimeBounds.timeMax,
      timeZone: event.timezone,
      items: calendarIds.map((id) => ({id})),
    }),
  });

  if (!response.ok) {
    throw new Error(await readGoogleApiErrorMessage(response, 'Could not read Google Calendar availability.'));
  }

  const payload = (await response.json()) as GoogleCalendarFreeBusyResponse;
  const calendars = payload.calendars ?? {};
  const intervals: GoogleBusyInterval[] = [];
  let hasSuccessfulCalendar = false;

  for (const calendarId of calendarIds) {
    const entry = calendars[calendarId];

    if (!entry) {
      continue;
    }

    if ((entry.errors?.length ?? 0) > 0) {
      continue;
    }

    hasSuccessfulCalendar = true;

    for (const busyRange of entry.busy ?? []) {
      if (!busyRange.start || !busyRange.end) {
        continue;
      }

      intervals.push({
        start: busyRange.start,
        end: busyRange.end,
        calendarId,
      });
    }
  }

  if (!hasSuccessfulCalendar) {
    throw new Error('The selected Google calendars could not be read.');
  }

  return intervals;
}

async function fetchGoogleCalendarEventsForCalendar(
  accessToken: string,
  calendar: GoogleCalendarRecord,
  event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd' | 'timezone'>,
  timeMin: string,
  timeMax: string,
) {
  const details: GoogleCalendarBusyDetail[] = [];
  let pageToken = '';

  while (true) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('showDeleted', 'false');
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('maxResults', '2500');
    url.searchParams.set('fields', 'items(id,summary,status,visibility,transparency,start,end),nextPageToken');

    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: buildAuthorizedRequestHeaders(accessToken),
    });

    if (!response.ok) {
      throw new Error(await readGoogleApiErrorMessage(response, `Could not load events from ${calendar.summary}.`));
    }

    const payload = (await response.json()) as GoogleCalendarEventsResponse;

    for (const item of payload.items ?? []) {
      if (item.status === 'cancelled') {
        continue;
      }

      const normalizedStart = normalizeGoogleEventBoundary(item.start, event.timezone);
      const normalizedEnd = normalizeGoogleEventBoundary(item.end, event.timezone);

      if (
        !normalizedStart ||
        !normalizedEnd ||
        new Date(normalizedStart.value).getTime() >= new Date(normalizedEnd.value).getTime()
      ) {
        continue;
      }

      details.push({
        id: `${calendar.id}:${item.id?.trim() || `${normalizedStart.value}:${normalizedEnd.value}`}`,
        slotKey: '',
        calendarId: calendar.id,
        calendarSummary: calendar.summary,
        title: item.summary?.trim() || (item.visibility === 'private' ? 'Private event' : 'Busy'),
        start: normalizedStart.value,
        end: normalizedEnd.value,
        isAllDay: normalizedStart.isAllDay && normalizedEnd.isAllDay,
        detailsAvailable: true,
      });
    }

    if (!payload.nextPageToken) {
      break;
    }

    pageToken = payload.nextPageToken;
  }

  return details;
}

export async function fetchGoogleBusyDetails(
  accessToken: string,
  calendars: GoogleCalendarRecord[],
  event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd' | 'timezone'>,
) {
  const readableCalendars = calendars.filter((calendar) => calendar.accessRole !== 'freeBusyReader');
  const eventTimeBounds = buildEventTimeBounds(event);

  if (!eventTimeBounds || readableCalendars.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    readableCalendars.map((calendar) =>
      fetchGoogleCalendarEventsForCalendar(accessToken, calendar, event, eventTimeBounds.timeMin, eventTimeBounds.timeMax),
    ),
  );
  const successfulDetails = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

  if (successfulDetails.length > 0) {
    return successfulDetails;
  }

  const firstFailure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');

  if (firstFailure) {
    throw firstFailure.reason instanceof Error ? firstFailure.reason : new Error('Could not load Google Calendar event details.');
  }

  return [];
}

export function buildBusyDetailsBySlotForEvent(
  event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd' | 'timezone'>,
  busyIntervals: GoogleBusyInterval[],
  busyDetails: GoogleCalendarBusyDetail[],
  calendars: GoogleCalendarRecord[],
) {
  const blockingIntervals = buildBlockingIntervalsForEvent(event, busyIntervals, busyDetails, calendars);
  return buildBusyDetailsBySlotFromBlockingIntervals(event, blockingIntervals);
}

export function buildBusySlotKeysForEvent(
  event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd' | 'timezone'>,
  busyIntervals: GoogleBusyInterval[],
) {
  const blockingIntervals = buildBlockingIntervalsForEvent(event, busyIntervals, [], []);
  return buildBusySlotKeysFromBlockingIntervals(event, blockingIntervals);
}

export function buildGoogleCalendarImportProjection(
  event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd' | 'timezone'>,
  busyIntervals: GoogleBusyInterval[],
  busyDetails: GoogleCalendarBusyDetail[],
  calendars: GoogleCalendarRecord[],
): GoogleCalendarImportProjection {
  const blockingIntervals = buildBlockingIntervalsForEvent(event, busyIntervals, busyDetails, calendars);
  const busySlotKeys = buildBusySlotKeysFromBlockingIntervals(event, blockingIntervals);

  return {
    blockingIntervals,
    busySlotKeys,
    freeSlotKeys: buildFreeSlotKeysForEvent(event, busySlotKeys),
    busyDetailsBySlot: buildBusyDetailsBySlotFromBlockingIntervals(event, blockingIntervals),
  };
}

export function buildFreeSlotKeysForEvent(
  event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd'>,
  busySlotKeys: Set<string>,
) {
  const freeSlotKeys: string[] = [];

  for (const date of event.dates) {
    for (const time of generateTimeRows(event.timeRangeStart, event.timeRangeEnd)) {
      const slotKey = buildSlotKey(date, time);

      if (!busySlotKeys.has(slotKey)) {
        freeSlotKeys.push(slotKey);
      }
    }
  }

  return freeSlotKeys;
}

export function getDefaultSelectedCalendarIds(calendars: GoogleCalendarRecord[], storedIds: string[]) {
  const validStoredIds = storedIds.filter((id) => calendars.some((calendar) => calendar.id === id));

  if (validStoredIds.length > 0) {
    return validStoredIds;
  }

  const googlePreferredIds = calendars.filter((calendar) => calendar.selected || calendar.primary).map((calendar) => calendar.id);

  if (googlePreferredIds.length > 0) {
    return googlePreferredIds;
  }

  return calendars[0] ? [calendars[0].id] : [];
}

export function getStoredSelectedCalendarIds(eventId: string) {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    return normalizeStoredCalendarIds(window.localStorage.getItem(getSelectedCalendarsStorageKey(eventId)));
  } catch {
    return [];
  }
}

export function setStoredSelectedCalendarIds(eventId: string, calendarIds: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(getSelectedCalendarsStorageKey(eventId), JSON.stringify([...new Set(calendarIds)]));
  } catch {
    // Ignore storage issues and keep the current session in memory.
  }
}

export function getGoogleReconnectHint() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(GOOGLE_CONNECT_HINT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setGoogleReconnectHint(enabled: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (enabled) {
      window.localStorage.setItem(GOOGLE_CONNECT_HINT_KEY, 'true');
      return;
    }

    window.localStorage.removeItem(GOOGLE_CONNECT_HINT_KEY);
  } catch {
    // Ignore storage issues and keep the current session in memory.
  }
}
