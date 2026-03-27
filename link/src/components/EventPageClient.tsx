'use client';

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarRange, Clock3, MapPin, Users} from 'lucide-react';

import AvailabilityGrid from '@/components/AvailabilityGrid';
import type {ApiErrorResponse, EventRecord, SubmitAvailabilityRequest, SubmitAvailabilityResponse} from '@/lib/types';
import {formatDateRange, formatTimeLabel, getExistingAvailability, sortAvailability} from '@/lib/utils';

interface EventPageClientProps {
  initialEvent: EventRecord;
}

const PARTICIPANT_STORAGE_PREFIX = 'link:participant:';
const SUBMITTED_STORAGE_PREFIX = 'link:submitted:';

export default function EventPageClient({initialEvent}: EventPageClientProps) {
  const router = useRouter();
  const [participantName, setParticipantName] = useState('');

  const participantStorageKey = `${PARTICIPANT_STORAGE_PREFIX}${initialEvent.id}`;
  const submissionStorageKey = `${SUBMITTED_STORAGE_PREFIX}${initialEvent.id}`;
  const initialAvailability = participantName ? getExistingAvailability(initialEvent, participantName) : [];

  useEffect(() => {
    try {
      const savedName = window.localStorage.getItem(participantStorageKey)?.trim() ?? '';

      if (savedName) {
        setParticipantName(savedName);
      }
    } catch {
      // Ignore storage access issues and continue without a saved name.
    }
  }, [participantStorageKey]);

  function handleSaveName(name: string) {
    setParticipantName(name);

    try {
      window.localStorage.setItem(participantStorageKey, name);
    } catch {
      // Ignore storage access issues after saving the in-memory name.
    }
  }

  async function handleSubmit(availability: string[]) {
    const payload: SubmitAvailabilityRequest = {
      eventId: initialEvent.id,
      participantName,
      availability: sortAvailability(availability),
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
        window.localStorage.setItem(submissionStorageKey, result.participantName);
      } catch {
        // Ignore storage access issues after saving the response.
      }

      router.push(`/event/${initialEvent.id}/group`);
      return {ok: true};
    } catch {
      return {ok: false, error: 'We could not save your availability.'};
    }
  }

  return (
    <>
      <section className="panel-border panel-shadow rounded-[32px] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="max-w-3xl font-headline text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              {initialEvent.title}
            </h1>
            {initialEvent.description ? (
              <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft sm:text-lg">{initialEvent.description}</p>
            ) : (
              <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft sm:text-lg">
                Share this page with your group, then choose the times that work for you.
              </p>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[24px] bg-surface-soft p-4">
              <div className="flex items-center gap-3">
                <CalendarRange className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Dates</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{formatDateRange(initialEvent.dates)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-surface-soft p-4">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Time Window</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {formatTimeLabel(initialEvent.timeRangeStart)} to {formatTimeLabel(initialEvent.timeRangeEnd)}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">{initialEvent.timezone}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-surface-soft p-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Location</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{initialEvent.location || 'No location added yet'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-surface-soft p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Responses</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {initialEvent.responses.length} {initialEvent.responses.length === 1 ? 'person has' : 'people have'} replied
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {participantName ? `You will submit as ${participantName}.` : 'Add your name in the availability section.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8" id="availability">
        <AvailabilityGrid
          event={initialEvent}
          initialAvailability={initialAvailability}
          onSaveName={handleSaveName}
          onSubmit={handleSubmit}
          participantName={participantName}
        />
      </section>
    </>
  );
}
