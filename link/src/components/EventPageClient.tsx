'use client';

import {useEffect, useRef, useState} from 'react';
import {CalendarRange, Clock3, Users} from 'lucide-react';

import AvailabilityGrid from '@/components/AvailabilityGrid';
import EditableLocationCard from '@/components/EditableLocationCard';
import NameEntryModal from '@/components/NameEntryModal';
import PlaceholderFeatures from '@/components/PlaceholderFeatures';
import ShareLinkBox from '@/components/ShareLinkBox';
import type {ApiErrorResponse, EventRecord, EventResponseRecord, SubmitAvailabilityRequest, SubmitAvailabilityResponse} from '@/lib/types';
import {formatDateRange, formatTimeLabel, getExistingAvailability, getExistingAvailabilityByResponseId, sortAvailability} from '@/lib/utils';

interface EventPageClientProps {
  initialEvent: EventRecord;
  canEditLocation: boolean;
}

const PARTICIPANT_STORAGE_PREFIX = 'link:participant:';
const SUBMITTED_STORAGE_PREFIX = 'link:submitted:';
const RESPONSE_STORAGE_PREFIX = 'link:response:';
const EVENT_POLL_INTERVAL_MS = 5_000;

export default function EventPageClient({initialEvent, canEditLocation}: EventPageClientProps) {
  const [event, setEvent] = useState(initialEvent);
  const [participantName, setParticipantName] = useState('');
  const [responseId, setResponseId] = useState('');
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [hasUnsavedManualChanges, setHasUnsavedManualChanges] = useState(false);
  const [isResponsesOpen, setIsResponsesOpen] = useState(false);
  const hasHydratedParticipantRef = useRef(false);

  const participantStorageKey = `${PARTICIPANT_STORAGE_PREFIX}${initialEvent.id}`;
  const submissionStorageKey = `${SUBMITTED_STORAGE_PREFIX}${initialEvent.id}`;
  const responseStorageKey = `${RESPONSE_STORAGE_PREFIX}${initialEvent.id}`;
  const initialAvailability = responseId
    ? getExistingAvailabilityByResponseId(event, responseId)
    : participantName
      ? getExistingAvailability(event, participantName)
      : [];
  const responderNames = Array.from(new Set(event.responses.map((response) => response.participantName)));

  useEffect(() => {
    if (hasHydratedParticipantRef.current || isManualEntryOpen || hasUnsavedManualChanges) {
      return;
    }

    try {
      const savedName = window.localStorage.getItem(participantStorageKey)?.trim() ?? '';
      const savedResponseId = window.localStorage.getItem(responseStorageKey)?.trim() ?? '';
      const matchedResponse = savedResponseId
        ? event.responses.find((response) => response.id === savedResponseId)
        : null;

      if (matchedResponse) {
        setResponseId(matchedResponse.id);
        setParticipantName(matchedResponse.participantName);
        setIsManualEntryOpen(false);
        hasHydratedParticipantRef.current = true;
        return;
      }

      if (savedResponseId) {
        setResponseId(savedResponseId);
      }

      if (savedName) {
        setParticipantName(savedName);
      }

      hasHydratedParticipantRef.current = true;
    } catch {
      hasHydratedParticipantRef.current = true;
      // Ignore storage access issues and continue without a saved name.
    }
  }, [event.responses, hasUnsavedManualChanges, isManualEntryOpen, participantStorageKey, responseStorageKey]);

  useEffect(() => {
    let isCancelled = false;
    let activeController: AbortController | null = null;

    async function loadEvent() {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      try {
        const response = await fetch(`/api/events/${initialEvent.id}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const nextEvent = (await response.json()) as EventRecord;

        if (isCancelled) {
          return;
        }

        setEvent(nextEvent);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.warn('Event refresh failed.', error);
      }
    }

    const intervalId = window.setInterval(() => {
      void loadEvent();
    }, EVENT_POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      activeController?.abort();
      window.clearInterval(intervalId);
    };
  }, [initialEvent.id]);

  useEffect(() => {
    if (!responseId || hasUnsavedManualChanges) {
      return;
    }

    const matchedResponse = event.responses.find((response) => response.id === responseId);

    if (!matchedResponse) {
      return;
    }

    setParticipantName(matchedResponse.participantName);
  }, [event.responses, hasUnsavedManualChanges, responseId]);

  function handleSaveName(name: string) {
    setParticipantName(name);
    setIsNameModalOpen(false);
    setIsManualEntryOpen(true);

    try {
      window.localStorage.setItem(participantStorageKey, name);
    } catch {
      // Ignore storage access issues after saving the in-memory name.
    }
  }

  async function refreshEvent() {
    try {
      const response = await fetch(`/api/events/${initialEvent.id}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        return;
      }

      const nextEvent = (await response.json()) as EventRecord;
      setEvent(nextEvent);
    } catch {
      // The next polling pass will retry.
    }
  }

  function applySavedResponse(result: SubmitAvailabilityResponse, availability: string[]) {
    const savedAvailability = sortAvailability(availability);

    setEvent((currentEvent) => {
      const existingIndex = currentEvent.responses.findIndex((response) => {
        if (response.id === result.id) {
          return true;
        }

        if (responseId && response.id === responseId) {
          return true;
        }

        return response.participantName === result.participantName;
      });
      const existingResponse = existingIndex >= 0 ? currentEvent.responses[existingIndex] : null;
      const savedResponse: EventResponseRecord = {
        id: result.id,
        participantName: result.participantName,
        eventId: currentEvent.id,
        availability: savedAvailability,
        createdAt: existingResponse?.createdAt ?? new Date().toISOString(),
      };
      const responses =
        existingIndex >= 0
          ? currentEvent.responses.map((response, index) => (index === existingIndex ? savedResponse : response))
          : [...currentEvent.responses, savedResponse];

      return {
        ...currentEvent,
        responses,
      };
    });
  }

  async function handleSubmit(availability: string[]) {
    const sortedAvailability = sortAvailability(availability);
    const payload: SubmitAvailabilityRequest = {
      eventId: initialEvent.id,
      participantName,
      availability: sortedAvailability,
      responseId: responseId || undefined,
    };

    try {
      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ApiErrorResponse | null;

        return {
          ok: false,
          error:
            errorPayload?.fieldErrors?.participantName ??
            errorPayload?.fieldErrors?.availability ??
            errorPayload?.error ??
            'We could not save your availability.',
        };
      }

      const result = (await response.json()) as SubmitAvailabilityResponse;

      try {
        window.localStorage.setItem(participantStorageKey, result.participantName);
        window.localStorage.setItem(submissionStorageKey, result.participantName);
        window.localStorage.setItem(responseStorageKey, result.id);
      } catch {
        // Ignore storage access issues after saving the response.
      }

      setResponseId(result.id);
      setParticipantName(result.participantName);
      applySavedResponse(result, sortedAvailability);
      setHasUnsavedManualChanges(false);
      setIsManualEntryOpen(false);
      void refreshEvent();
      return {ok: true};
    } catch {
      return {ok: false, error: 'We could not save your availability.'};
    }
  }

  return (
    <>
      <NameEntryModal
        eventTitle={event.title}
        initialName={participantName}
        onSave={handleSaveName}
        open={isNameModalOpen}
      />

      <section className="panel-border panel-shadow rounded-[24px] bg-white p-5 sm:rounded-[32px] sm:p-8">
        <div className="flex flex-col gap-6 sm:gap-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="max-w-3xl font-headline text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
                {event.title}
              </h1>
              {event.description ? (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft sm:mt-4 sm:text-lg sm:leading-7">{event.description}</p>
              ) : (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft sm:mt-4 sm:text-lg sm:leading-7">
                  Share this page with your group, then choose the times that work for you.
                </p>
              )}
            </div>

            <ShareLinkBox eventId={event.id} variant="compact" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[20px] bg-surface-soft p-3.5 sm:rounded-[24px] sm:p-4">
              <div className="flex items-center gap-3">
                <CalendarRange className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Dates</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{formatDateRange(event.dates)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] bg-surface-soft p-3.5 sm:rounded-[24px] sm:p-4">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Time Window</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {formatTimeLabel(event.timeRangeStart)} to {formatTimeLabel(event.timeRangeEnd)}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">{event.timezone}</p>
                </div>
              </div>
            </div>

            <EditableLocationCard canEditLocation={canEditLocation} event={event} onEventUpdate={setEvent} />

            <div className="relative">
              <button
                className="w-full rounded-[20px] bg-surface-soft p-3.5 text-left transition-colors duration-150 hover:bg-[#eef2fb] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 sm:rounded-[24px] sm:p-4"
                onBlur={() => setIsResponsesOpen(false)}
                onClick={() => setIsResponsesOpen((current) => !current)}
                onFocus={() => setIsResponsesOpen(true)}
                onMouseEnter={() => setIsResponsesOpen(true)}
                onMouseLeave={() => setIsResponsesOpen(false)}
                type="button"
              >
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Responses</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {event.responses.length} {event.responses.length === 1 ? 'response' : 'responses'} saved
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {participantName ? `You are responding as ${participantName}.` : 'Use manual input or Google Calendar below.'}
                    </p>
                    <p className="mt-2 text-xs font-medium text-primary">
                      {event.responses.length > 0 ? 'Tap to see who has replied so far.' : 'Waiting for the first response.'}
                    </p>
                  </div>
                </div>
              </button>

              {isResponsesOpen && responderNames.length > 0 ? (
                <div className="pointer-events-none absolute left-0 right-0 top-[calc(100%+10px)] z-30 rounded-[18px] border border-line bg-white p-3 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">People who replied</p>
                  <div className="mt-3 space-y-2">
                    {responderNames.map((name) => (
                      <div className="rounded-xl bg-surface-soft px-3 py-2 text-sm font-medium text-ink" key={name}>
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8" id="group">
        <div className="space-y-4 sm:space-y-6">
          <AvailabilityGrid
            event={event}
            initialAvailability={initialAvailability}
            isManualEntryOpen={isManualEntryOpen}
            onDirtyChange={setHasUnsavedManualChanges}
            onOpenManualEntry={() => setIsManualEntryOpen(true)}
            onRequestName={() => setIsNameModalOpen(true)}
            onSubmit={handleSubmit}
            participantName={participantName}
            responseId={responseId}
          />
          <PlaceholderFeatures event={event} />
        </div>
      </section>
    </>
  );
}
