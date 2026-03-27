import {type ClassValue, clsx} from 'clsx';
import {twMerge} from 'tailwind-merge';

import type {CalendarDay, CalendarMonth, EventRecord, SlotSummary} from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TIME_OPTIONS = Array.from({length: 24}, (_, index) => minutesToTime(index * 60));

export const PARTICIPANT_TONES = [
  'bg-primary/10 text-primary',
  'bg-secondary-soft text-secondary',
  'bg-tertiary-soft text-tertiary',
  'bg-slate-200 text-slate-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
];

export function minutesToTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function timeToMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function isValidTimeValue(value: string) {
  return /^([01]\d|2[0-3]):00$/.test(value);
}

export function isValidDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', {timeZone: value});
    return true;
  } catch {
    return false;
  }
}

export function normalizeDateValues(values: string[]) {
  return [...new Set(values.filter(isValidDateValue))].sort((left, right) => left.localeCompare(right));
}

export function sortAvailability(values: Iterable<string>) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function buildSlotKey(date: string, time: string) {
  return `${date}T${time}`;
}

export function splitSlotKey(slotKey: string) {
  const [date, time] = slotKey.split('T');
  return {date, time};
}

export function generateTimeRows(start: string, end: string) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const rows: string[] = [];

  for (let value = startMinutes; value < endMinutes; value += 60) {
    rows.push(minutesToTime(value));
  }

  return rows;
}

export function generateSlotKeys(dates: string[], start: string, end: string) {
  const rows = generateTimeRows(start, end);
  return dates.flatMap((date) => rows.map((time) => buildSlotKey(date, time)));
}

export function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

export function serializeEventRecord(event: {
  id: string;
  title: string;
  description: string | null;
  dates: string;
  timeRangeStart: string;
  timeRangeEnd: string;
  timezone: string;
  location: string | null;
  createdAt: Date;
  responses: Array<{
    id: string;
    participantName: string;
    eventId: string;
    availability: string;
    createdAt: Date;
  }>;
}): EventRecord {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    dates: normalizeDateValues(parseJsonArray(event.dates)),
    timeRangeStart: event.timeRangeStart,
    timeRangeEnd: event.timeRangeEnd,
    timezone: event.timezone,
    location: event.location,
    createdAt: event.createdAt.toISOString(),
    responses: [...event.responses]
      .sort((left, right) => left.participantName.localeCompare(right.participantName))
      .map((response) => ({
        id: response.id,
        participantName: response.participantName,
        eventId: response.eventId,
        availability: sortAvailability(parseJsonArray(response.availability)),
        createdAt: response.createdAt.toISOString(),
      })),
  };
}

export function formatTimeLabel(time: string) {
  const [hourString, minuteString] = time.split(':');
  const hour = Number(hourString);
  const minute = Number(minuteString);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatDateHeader(date: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const parts = formatter.formatToParts(new Date(`${date}T00:00:00Z`));
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';

  return {weekday, day};
}

export function formatDateRange(dates: string[]) {
  if (dates.length === 0) {
    return 'No dates selected';
  }

  if (dates.length === 1) {
    return formatDateLabel(dates[0]);
  }

  return `${formatDateLabel(dates[0])} to ${formatDateLabel(dates[dates.length - 1])}`;
}

export function getParticipantTone(name: string) {
  const index =
    [...name].reduce((total, character) => total + character.charCodeAt(0), 0) % PARTICIPANT_TONES.length;
  return PARTICIPANT_TONES[index];
}

export function getParticipantInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function getHeatmapColor(count: number, totalParticipants: number) {
  if (count === 0 || totalParticipants === 0) {
    return '#edf1f6';
  }

  const ratio = count / totalParticipants;

  if (ratio >= 1) {
    return '#674ead';
  }

  if (ratio >= 0.75) {
    return '#8063cf';
  }

  if (ratio >= 0.5) {
    return '#a38be4';
  }

  if (ratio >= 0.25) {
    return '#d7cafb';
  }

  return '#ebe4ff';
}

export function buildSlotSummaries(event: EventRecord) {
  const slotMap = new Map<string, SlotSummary>();
  const totalParticipants = event.responses.length;

  for (const slotKey of generateSlotKeys(event.dates, event.timeRangeStart, event.timeRangeEnd)) {
    const {date, time} = splitSlotKey(slotKey);
    slotMap.set(slotKey, {
      slotKey,
      date,
      time,
      count: 0,
      ratio: 0,
      participantNames: [],
    });
  }

  for (const response of event.responses) {
    for (const slotKey of response.availability) {
      const summary = slotMap.get(slotKey);

      if (!summary) {
        continue;
      }

      summary.count += 1;
      summary.participantNames.push(response.participantName);
    }
  }

  return [...slotMap.values()].map((summary) => ({
    ...summary,
    ratio: totalParticipants === 0 ? 0 : summary.count / totalParticipants,
    participantNames: [...summary.participantNames].sort((left, right) => left.localeCompare(right)),
  }));
}

export function getBestOptions(event: EventRecord, limit = 3) {
  return buildSlotSummaries(event)
    .filter((summary) => summary.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.slotKey.localeCompare(right.slotKey);
    })
    .slice(0, limit);
}

export function getExistingAvailability(event: EventRecord, participantName: string) {
  return event.responses.find((response) => response.participantName === participantName)?.availability ?? [];
}

export function buildCalendarMonth(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month, 1)));

  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startOffset = firstOfMonth.getUTCDay();
  const today = new Date();
  const todayKey = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  const cells: Array<CalendarDay | null> = Array.from({length: startOffset}, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const value = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    cells.push({
      date: value,
      dayNumber: day,
      isCurrentMonth: true,
      isPast: value < todayKey,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: Array<Array<CalendarDay | null>> = [];

  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return {
    label: monthLabel,
    month,
    year,
    weeks,
  } satisfies CalendarMonth;
}

export function buildCurrentAndNextMonths(referenceDate = new Date()) {
  const firstMonth = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  const secondMonth = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1));

  return [buildCalendarMonth(firstMonth), buildCalendarMonth(secondMonth)];
}
