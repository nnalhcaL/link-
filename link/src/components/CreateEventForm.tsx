'use client';

import {type FormEvent, type KeyboardEvent, useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarRange, Check, Clock3, LoaderCircle, MapPin, PencilLine, Search, Sparkles, X} from 'lucide-react';
import {motion} from 'motion/react';

import type {
  ApiErrorResponse,
  ApiFieldErrors,
  CreateEventRequest,
  CreateEventResponse,
  EventLocationInput,
  LocationSearchCandidate,
  LocationSearchResponse,
} from '@/lib/types';
import {cn, END_TIME_OPTIONS, formatTimeLabel, isValidEndTimeValue, isValidTimeValue, timeToMinutes, TIME_OPTIONS} from '@/lib/utils';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export default function CreateEventForm() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<EventLocationInput | null>(null);
  const [locationCandidates, setLocationCandidates] = useState<LocationSearchCandidate[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('America/New_York');
  const [timeRangeStart, setTimeRangeStart] = useState('09:00');
  const [timeRangeEnd, setTimeRangeEnd] = useState('17:00');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitDebugDetails, setSubmitDebugDetails] = useState<Pick<ApiErrorResponse, 'errorCode' | 'requestId' | 'hint' | 'details'> | null>(
    null,
  );

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (detected) {
      setTimezone(detected);
    }
  }, []);

  const computedDates = startDate && endDate ? getDatesInRange(startDate, endDate) : [];

  function getDatesInRange(start: string, end: string) {
    const startParts = start.split('-').map(Number);
    const endParts = end.split('-').map(Number);

    if (startParts.length !== 3 || endParts.length !== 3 || startParts.some(Number.isNaN) || endParts.some(Number.isNaN)) {
      return [];
    }

    const [startYear, startMonth, startDay] = startParts;
    const [endYear, endMonth, endDay] = endParts;
    const startDateValue = Date.UTC(startYear, startMonth - 1, startDay);
    const endDateValue = Date.UTC(endYear, endMonth - 1, endDay);

    if (!Number.isFinite(startDateValue) || !Number.isFinite(endDateValue) || startDateValue > endDateValue) {
      return [];
    }

    const dates: string[] = [];

    for (let cursor = startDateValue; cursor <= endDateValue; cursor += DAY_IN_MILLISECONDS) {
      dates.push(new Date(cursor).toISOString().slice(0, 10));
    }

    return dates;
  }

  async function handleLocationSearch() {
    const trimmedQuery = locationQuery.trim();

    if (!trimmedQuery) {
      setLocationCandidates([]);
      setSelectedLocation(null);
      setLocationSearchError(null);
      setFieldErrors((current) => ({...current, location: undefined}));
      return;
    }

    setIsSearchingLocation(true);
    setLocationSearchError(null);
    setFieldErrors((current) => ({...current, location: undefined}));

    try {
      const response = await fetch('/api/location/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({query: trimmedQuery}),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        const nextError = errorPayload?.fieldErrors?.location ?? errorPayload?.error ?? 'We could not search for that location.';

        setLocationCandidates([]);
        setSelectedLocation(null);
        setLocationSearchError(nextError);
        return;
      }

      const result = (await response.json()) as LocationSearchResponse;

      setLocationCandidates(result.candidates);
      setSelectedLocation(null);
      setLocationSearchError(
        result.candidates.length === 0 ? 'No exact matches found yet. Try a venue, suburb, or full street address.' : null,
      );
    } catch {
      setLocationCandidates([]);
      setSelectedLocation(null);
      setLocationSearchError('We could not search for that location right now.');
    } finally {
      setIsSearchingLocation(false);
    }
  }

  function handleLocationInputChange(value: string) {
    setLocationQuery(value);
    setLocationCandidates([]);
    setLocationSearchError(null);
    setFieldErrors((current) => ({...current, location: undefined}));

    if (!value.trim()) {
      setSelectedLocation(null);
      setLocationCandidates([]);
      return;
    }

    if (selectedLocation && value.trim() !== selectedLocation.address) {
      setSelectedLocation(null);
    }
  }

  function handleLocationKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    void handleLocationSearch();
  }

  function handleLocationSelect(candidate: LocationSearchCandidate) {
    setSelectedLocation(candidate);
    setLocationQuery(candidate.address);
    setLocationSearchError(null);
    setFieldErrors((current) => ({...current, location: undefined}));
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

    if (!isValidEndTimeValue(timeRangeEnd)) {
      nextErrors.timeRangeEnd = 'Select a valid end time.';
    }

    if (isValidTimeValue(timeRangeStart) && isValidEndTimeValue(timeRangeEnd)) {
      if (timeToMinutes(timeRangeStart) >= timeToMinutes(timeRangeEnd)) {
        nextErrors.timeRangeEnd = 'End time needs to be later than the start time.';
      }
    }

    if (locationQuery.trim() && !selectedLocation) {
      nextErrors.location = 'Choose a specific location from the search results or clear the field.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitDebugDetails(null);
    setFieldErrors({});

    const payload: CreateEventRequest = {
      title: title.trim(),
      description: description.trim(),
      dates: computedDates,
      timeRangeStart,
      timeRangeEnd,
      timezone,
      location: selectedLocation ?? undefined,
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

        setSubmitDebugDetails({
          errorCode: errorPayload?.errorCode,
          requestId: errorPayload?.requestId,
          hint: errorPayload?.hint,
          details: errorPayload?.details,
        });
        if (errorPayload?.errorCode || errorPayload?.requestId) {
          console.error('[CreateEventForm] /api/events failed', {
            errorCode: errorPayload?.errorCode,
            requestId: errorPayload?.requestId,
            hint: errorPayload?.hint,
            details: errorPayload?.details,
          });
        }
        setSubmitError(errorPayload?.error ?? 'We could not create your link just now.');
        return;
      }

      const result = (await response.json()) as CreateEventResponse;
      router.push(result.shareUrl);
    } catch {
      setSubmitError('We could not create your link just now.');
      setSubmitDebugDetails({
        errorCode: 'EVENT_CREATE_REQUEST_FAILED',
        hint: 'The browser could not complete the request to /api/events.',
      });
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
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <CalendarRange className="h-4 w-4 text-primary" />
                Start date
              </span>
              <input
                type="date"
                className={cn(
                  'date-input w-full rounded-2xl border bg-surface-soft px-4 py-3.5 text-base text-ink outline-none transition-all duration-150 sm:text-sm',
                  fieldErrors.dates
                    ? 'border-danger'
                    : 'border-transparent focus:border-primary/30 focus:ring-2 focus:ring-primary/10',
                )}
                max={endDate || undefined}
                value={startDate}
                onChange={(event) => {
                  setFieldErrors((current) => ({...current, dates: undefined}));
                  setStartDate(event.target.value);
                }}
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <CalendarRange className="h-4 w-4 text-primary" />
                End date
              </span>
              <input
                type="date"
                className={cn(
                  'date-input w-full rounded-2xl border bg-surface-soft px-4 py-3.5 text-base text-ink outline-none transition-all duration-150 sm:text-sm',
                  fieldErrors.dates
                    ? 'border-danger'
                    : 'border-transparent focus:border-primary/30 focus:ring-2 focus:ring-primary/10',
                )}
                min={startDate || undefined}
                value={endDate}
                onChange={(event) => {
                  setFieldErrors((current) => ({...current, dates: undefined}));
                  setEndDate(event.target.value);
                }}
              />
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
                {END_TIME_OPTIONS.map((timeValue) => (
                  <option key={timeValue} value={timeValue}>
                    {timeValue === '24:00' ? formatTimeLabel(timeValue) : timeValue}
                  </option>
                ))}
              </select>
            </div>
            {fieldErrors.timeRangeEnd ? <p className="mt-2 text-sm text-danger">{fieldErrors.timeRangeEnd}</p> : null}
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink">Location (optional)</span>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                <input
                  className={cn(
                    'w-full rounded-2xl border bg-surface-soft py-3.5 pl-12 pr-12 text-sm text-ink outline-none transition-all duration-150',
                    fieldErrors.location
                      ? 'border-danger'
                      : 'border-transparent focus:border-primary/30 focus:ring-2 focus:ring-primary/10',
                  )}
                  onChange={(currentEvent) => handleLocationInputChange(currentEvent.target.value)}
                  onKeyDown={handleLocationKeyDown}
                  placeholder="Search for a venue or full address"
                  value={locationQuery}
                />

                {locationQuery ? (
                  <button
                    aria-label="Clear location"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft transition-colors duration-150 hover:bg-white hover:text-ink"
                    onClick={() => handleLocationInputChange('')}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <button
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition-colors duration-150 hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSearchingLocation || !locationQuery.trim()}
                onClick={() => void handleLocationSearch()}
                type="button"
              >
                {isSearchingLocation ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isSearchingLocation ? 'Searching...' : 'Find location'}
              </button>
            </div>

            {selectedLocation ? (
              <div className="rounded-2xl border border-line bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{selectedLocation.label}</p>
                    <p className="mt-1 text-sm leading-6 text-ink-soft">{selectedLocation.address}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <Check className="h-3.5 w-3.5" />
                    Selected
                  </span>
                </div>
              </div>
            ) : null}

            {locationCandidates.length > 0 ? (
              <div className="space-y-2">
                {locationCandidates.map((candidate) => {
                  const isSelected = selectedLocation?.address === candidate.address;

                  return (
                    <button
                      className={cn(
                        'flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-150',
                        isSelected
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-line bg-white hover:border-primary/20 hover:bg-surface-soft',
                      )}
                      key={`${candidate.address}-${candidate.latitude}-${candidate.longitude}`}
                      onClick={() => handleLocationSelect(candidate)}
                      type="button"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">{candidate.label}</p>
                        <p className="mt-1 text-sm leading-6 text-ink-soft">{candidate.address}</p>
                      </div>
                      {isSelected ? (
                        <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {locationSearchError ? <p className="text-sm text-danger">{locationSearchError}</p> : null}
            {fieldErrors.location ? <p className="text-sm text-danger">{fieldErrors.location}</p> : null}
            {locationCandidates.length > 0 || selectedLocation ? (
              <p className="text-xs leading-5 text-ink-soft">Search by OpenStreetMap</p>
            ) : null}
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
      {submitDebugDetails && (submitDebugDetails.errorCode || submitDebugDetails.requestId || submitDebugDetails.hint || submitDebugDetails.details) ? (
        <div className="mt-3 rounded-2xl border border-danger/15 bg-danger/5 px-4 py-3 text-xs text-danger">
          {submitDebugDetails.errorCode ? <p><span className="font-semibold">Code:</span> <span className="font-mono">{submitDebugDetails.errorCode}</span></p> : null}
          {submitDebugDetails.requestId ? <p className="mt-1"><span className="font-semibold">Request:</span> <span className="font-mono">{submitDebugDetails.requestId}</span></p> : null}
          {submitDebugDetails.hint ? <p className="mt-1">{submitDebugDetails.hint}</p> : null}
          {submitDebugDetails.details ? <p className="mt-1 break-words text-danger/80">{submitDebugDetails.details}</p> : null}
        </div>
      ) : null}

      <button
        className="mt-6 w-full rounded-2xl bg-primary px-5 py-4 text-base font-semibold text-white transition-all duration-150 hover:bg-[#5c439d] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting || isSearchingLocation}
        type="submit"
      >
        {isSubmitting ? 'Creating Link…' : 'Create Link'}
      </button>
    </motion.form>
  );
}
