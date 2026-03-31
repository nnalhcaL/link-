'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {CalendarRange, Clock3, Users} from 'lucide-react';

import EditableLocationCard from '@/components/EditableLocationCard';
import GroupHeatmap from '@/components/GroupHeatmap';
import PlaceholderFeatures from '@/components/PlaceholderFeatures';
import ShareLinkBox from '@/components/ShareLinkBox';
import type {EventRecord} from '@/lib/types';
import {formatDateRange, formatTimeLabel} from '@/lib/utils';

interface GroupViewClientProps {
  initialEvent: EventRecord;
  canEditLocation: boolean;
}

const PARTICIPANT_STORAGE_PREFIX = 'link:participant:';
const SUBMITTED_STORAGE_PREFIX = 'link:submitted:';

export default function GroupViewClient({initialEvent, canEditLocation}: GroupViewClientProps) {
  const [event, setEvent] = useState(initialEvent);
  const [participantName, setParticipantName] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);
  const [isResponsesOpen, setIsResponsesOpen] = useState(false);

  const participantStorageKey = `${PARTICIPANT_STORAGE_PREFIX}${initialEvent.id}`;
  const submissionStorageKey = `${SUBMITTED_STORAGE_PREFIX}${initialEvent.id}`;
  const responderNames = Array.from(new Set(event.responses.map((response) => response.participantName)));

  useEffect(() => {
    setEvent(initialEvent);
  }, [initialEvent]);

  useEffect(() => {
    try {
      const savedName = window.localStorage.getItem(participantStorageKey)?.trim() ?? '';
      const savedSubmission = window.localStorage.getItem(submissionStorageKey)?.trim() ?? '';

      if (savedName || savedSubmission) {
        setParticipantName(savedName || savedSubmission);
      }

      setHasSubmitted(Boolean(savedSubmission));
    } catch {
      setHasSubmitted(false);
    }
  }, [participantStorageKey, submissionStorageKey]);

  if (hasSubmitted === null) {
    return (
      <section className="panel-border rounded-[24px] bg-white p-5 shadow-soft sm:rounded-[28px] sm:p-6">
        <p className="text-sm font-medium text-ink-soft">Loading group view...</p>
      </section>
    );
  }
  const canEditLocationAfterSubmit = canEditLocation && hasSubmitted;

  return (
    <>
      <section className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.08fr)_340px]">
        <div className="panel-border panel-shadow rounded-[24px] bg-white p-4 sm:rounded-[32px] sm:p-8">
          <div className="flex flex-col gap-5 sm:gap-8">
            <div>
              <h1 className="max-w-3xl font-headline text-[1.85rem] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl">
                Group view for {event.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft sm:mt-4 sm:text-lg sm:leading-7">
                Everyone&apos;s saved availability is collected here so the strongest overlap stands out quickly.
              </p>
            </div>

            {!hasSubmitted ? (
              <div className="rounded-[18px] border border-line bg-surface-soft px-4 py-3 sm:rounded-[20px]">
                <p className="text-sm font-semibold text-ink">Viewing the group availability</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-2xl text-sm leading-6 text-ink-soft">
                    You&apos;re looking around without a saved response yet. Go back anytime to add your availability and have it counted here.
                  </p>
                  <Link
                    className="inline-flex shrink-0 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:border-primary/30 hover:text-primary"
                    href={`/event/${event.id}#availability`}
                  >
                    Add your availability
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="grid gap-2.5 md:grid-cols-2 sm:gap-3">
              <div className="rounded-[18px] bg-surface-soft p-3 sm:rounded-[24px] sm:p-4">
                <div className="flex items-center gap-3">
                  <CalendarRange className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Dates</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{formatDateRange(event.dates)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] bg-surface-soft p-3 sm:rounded-[24px] sm:p-4">
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

              <EditableLocationCard canEditLocation={canEditLocationAfterSubmit} event={event} onEventUpdate={setEvent} />

              <div className="relative">
                <button
                  className="w-full rounded-[18px] bg-surface-soft p-3 text-left transition-colors duration-150 hover:bg-[#eef2fb] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 sm:rounded-[24px] sm:p-4"
                  onBlur={() => setIsResponsesOpen(false)}
                  onClick={() => setIsResponsesOpen((current) => !current)}
                  onFocus={() => setIsResponsesOpen(true)}
                  onMouseEnter={() => setIsResponsesOpen(true)}
                  onMouseLeave={() => setIsResponsesOpen(false)}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Responses</p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {event.responses.length} {event.responses.length === 1 ? 'response' : 'responses'} saved
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {hasSubmitted
                          ? participantName
                            ? `You submitted as ${participantName}.`
                            : 'Your response has been saved.'
                          : participantName
                            ? `Viewing as ${participantName}. Your response is not saved yet.`
                            : 'Viewing only. Add your availability when you are ready.'}
                      </p>
                      <p className="mt-2 text-xs font-medium text-primary">
                        {event.responses.length > 0 ? 'Tap to see who has replied so far.' : 'Waiting for the first response.'}
                      </p>
                    </div>
                  </div>
                </button>

                {isResponsesOpen && responderNames.length > 0 ? (
                  <div className="pointer-events-none absolute left-0 right-0 top-[calc(100%+12px)] z-20 rounded-[24px] border border-line bg-white p-4 shadow-soft">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">People who replied</p>
                    <div className="mt-3 space-y-2">
                      {responderNames.map((name) => (
                        <div className="rounded-2xl bg-surface-soft px-3 py-2 text-sm font-medium text-ink" key={name}>
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <ShareLinkBox eventId={event.id} />

          <div className="panel-border rounded-[24px] bg-white p-4 shadow-soft sm:rounded-[26px] sm:p-5">
            <p className="text-sm font-semibold text-ink">{hasSubmitted ? 'Need to make changes?' : 'Want to add your response?'}</p>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              {hasSubmitted
                ? 'You can go back and update your availability at any time. The group view will reflect your latest saved response.'
                : 'You can keep browsing here, then head back to the availability page whenever you want your times counted in the group view.'}
            </p>
            <Link
              className="mt-4 inline-flex rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-all duration-150 hover:border-primary/30 hover:text-primary"
              href={`/event/${event.id}#availability`}
            >
              {hasSubmitted ? 'Edit availability' : 'Choose availability'}
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <GroupHeatmap event={event} />
      </section>

      <div className="mt-8">
        <PlaceholderFeatures event={event} />
      </div>
    </>
  );
}
