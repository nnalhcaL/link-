'use client';

import {type FormEvent, useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarRange, Clock3, MapPin, PencilLine, Sparkles} from 'lucide-react';
import {motion} from 'motion/react';

import type {ApiErrorResponse, ApiFieldErrors, CreateEventRequest, CreateEventResponse} from '@/lib/types';
import {cn, isValidTimeValue, timeToMinutes, TIME_OPTIONS} from '@/lib/utils';

export default function CreateEventForm() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [timeRangeStart, setTimeRangeStart] = useState('09:00');
  const [timeRangeEnd, setTimeRangeEnd] = useState('17:00');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (detected) {
      setTimezone(detected);
    }
  }, []);

  const computedDates = startDate && endDate ? getDatesInRange(startDate, endDate) : [];

  function getDatesInRange(start: string, end: string) {
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);

    if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime()) || startDateObj > endDateObj) {
      return [];
    }

    const dates: string[] = [];
    const cursor = new Date(startDateObj);

    while (cursor <= endDateObj) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: ApiFieldErrors = {};

    if (!title.trim()) {
      nextErrors.title = 'Give your link a title.';
    }

    if (!startDate) {
      nextErrors.dates = 'Pick a start date.';
    }

    if (!endDate) {
      nextErrors.dates = 'Pick an end date.';
    }

    const computedDates = startDate && endDate ? getDatesInRange(startDate, endDate) : [];

    if (computedDates.length === 0) {
      nextErrors.dates = 'Pick a valid date range.';
    } else if (computedDates.length > 14) {
      nextErrors.dates = 'Choose a date range up to 14 days.';
    }

    if (!isValidTimeValue(timeRangeStart)) {
      nextErrors.timeRangeStart = 'Select a valid start time.';
    }

    if (!isValidTimeValue(timeRangeEnd)) {
      nextErrors.timeRangeEnd = 'Select a valid end time.';
    }

    if (isValidTimeValue(timeRangeStart) && isValidTimeValue(timeRangeEnd)) {
      if (timeToMinutes(timeRangeStart) >= timeToMinutes(timeRangeEnd)) {
        nextErrors.timeRangeEnd = 'End time needs to be later than the start time.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    const payload: CreateEventRequest = {
      title: title.trim(),
      description: description.trim(),
      dates: computedDates,
      timeRangeStart,
      timeRangeEnd,
      timezone,
      location: location.trim(),
    };

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ApiErrorResponse | null;

        if (errorPayload?.fieldErrors) {
          setFieldErrors(errorPayload.fieldErrors);
        }

        setSubmitError(errorPayload?.error ?? 'We could not create your link just now.');
        return;
      }

      const result = (await response.json()) as CreateEventResponse;
      router.push(result.shareUrl);
    } catch {
      setSubmitError('We could not create your link just now.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.form
      animate={{opacity: 1, y: 0}}
      className="panel-border panel-shadow rounded-[28px] bg-white p-6 sm:p-8"
      id="create-link"
      initial={{opacity: 0, y: 16}}
      onSubmit={handleSubmit}
      transition={{duration: 0.35}}
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-2xl font-extrabold tracking-tight text-ink">Create your Link!</h2>
          <p className="mt-1 text-sm text-ink-soft">Share one page, collect availability, and see the overlap instantly.</p>
        </div>
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink">Event name</span>
          <div className="relative">
            <PencilLine className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
            <input
              className={cn(
                'w-full rounded-2xl border bg-surface-soft py-3.5 pl-12 pr-4 text-sm text-ink outline-none transition-all duration-150',
                fieldErrors.title ? 'border-danger' : 'border-transparent focus:border-primary/30 focus:ring-2 focus:ring-primary/10',
              )}
              onChange={(currentEvent) => setTitle(currentEvent.target.value)}
              placeholder="Team offsite, wedding brunch, investor sync..."
              value={title}
            />
          </div>
          {fieldErrors.title ? <p className="mt-2 text-sm text-danger">{fieldErrors.title}</p> : null}
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-ink">Pick dates</span>
            <span className="text-xs font-medium text-ink-soft">{computedDates.length}/14 selected</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">Start date</span>
              <div className="relative">
                <CalendarRange className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                <input
                  type="date"
                  className={cn(
                    'w-full rounded-2xl border bg-surface-soft py-3.5 pl-12 pr-4 text-sm text-ink outline-none transition-all duration-150',
                    fieldErrors.dates
                      ? 'border-danger'
                      : 'border-transparent focus:border-primary/30 focus:ring-2 focus:ring-primary/10',
                  )}
                  value={startDate}
                  onChange={(event) => {
                    setFieldErrors((current) => ({...current, dates: undefined}));
                    setStartDate(event.target.value);
                  }}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">End date</span>
              <div className="relative">
                <CalendarRange className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                <input
                  type="date"
                  className={cn(
                    'w-full rounded-2xl border bg-surface-soft py-3.5 pl-12 pr-4 text-sm text-ink outline-none transition-all duration-150',
                    fieldErrors.dates
                      ? 'border-danger'
                      : 'border-transparent focus:border-primary/30 focus:ring-2 focus:ring-primary/10',
                  )}
                  value={endDate}
                  onChange={(event) => {
                    setFieldErrors((current) => ({...current, dates: undefined}));
                    setEndDate(event.target.value);
                  }}
                />
              </div>
            </label>
          </div>
          {fieldErrors.dates ? <p className="mt-2 text-sm text-danger">{fieldErrors.dates}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink">Start time</span>
            <div className="relative">
              <Clock3 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
              <select
                className={cn(
                  'w-full appearance-none rounded-2xl border bg-surface-soft py-3.5 pl-12 pr-4 text-sm text-ink outline-none transition-all duration-150',
                  fieldErrors.timeRangeStart
                    ? 'border-danger'
                    : 'border-transparent focus:border-primary/30 focus:ring-2 focus:ring-primary/10',
                )}
                onChange={(currentEvent) => setTimeRangeStart(currentEvent.target.value)}
                value={timeRangeStart}
              >
                {TIME_OPTIONS.map((timeValue) => (
                  <option key={timeValue} value={timeValue}>
                    {timeValue}
                  </option>
                ))}
              </select>
            </div>
            {fieldErrors.timeRangeStart ? <p className="mt-2 text-sm text-danger">{fieldErrors.timeRangeStart}</p> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink">End time</span>
            <div className="relative">
              <Clock3 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
              <select
                className={cn(
                  'w-full appearance-none rounded-2xl border bg-surface-soft py-3.5 pl-12 pr-4 text-sm text-ink outline-none transition-all duration-150',
                  fieldErrors.timeRangeEnd
                    ? 'border-danger'
                    : 'border-transparent focus:border-primary/30 focus:ring-2 focus:ring-primary/10',
                )}
                onChange={(currentEvent) => setTimeRangeEnd(currentEvent.target.value)}
                value={timeRangeEnd}
              >
                {TIME_OPTIONS.map((timeValue) => (
                  <option key={timeValue} value={timeValue}>
                    {timeValue}
                  </option>
                ))}
              </select>
            </div>
            {fieldErrors.timeRangeEnd ? <p className="mt-2 text-sm text-danger">{fieldErrors.timeRangeEnd}</p> : null}
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink">Location (optional)</span>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
            <input
              className="w-full rounded-2xl border border-transparent bg-surface-soft py-3.5 pl-12 pr-4 text-sm text-ink outline-none transition-all duration-150 focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
              onChange={(currentEvent) => setLocation(currentEvent.target.value)}
              placeholder="City or venue"
              value={location}
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink">Description (optional)</span>
          <textarea
            className="h-24 w-full rounded-2xl border border-transparent bg-surface-soft px-4 py-3 text-sm text-ink outline-none transition-all duration-150 focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
            onChange={(currentEvent) => setDescription(currentEvent.target.value)}
            placeholder="Add context, agenda notes, or meeting goals."
            value={description}
          />
        </label>
      </div>

      {submitError ? <p className="mt-5 text-sm text-danger">{submitError}</p> : null}

      <button
        className="mt-6 w-full rounded-2xl bg-primary px-5 py-4 text-base font-semibold text-white transition-all duration-150 hover:bg-[#5c439d] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Creating Link…' : 'Create Link'}
      </button>
    </motion.form>
  );
}
