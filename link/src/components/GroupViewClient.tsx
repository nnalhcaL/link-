'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {CalendarRange, Clock3, MapPin, Users} from 'lucide-react';

import GroupHeatmap from '@/components/GroupHeatmap';
import PlaceholderFeatures from '@/components/PlaceholderFeatures';
import ShareLinkBox from '@/components/ShareLinkBox';
import type {EventRecord} from '@/lib/types';
import {formatDateRange, formatTimeLabel, getBestOptions} from '@/lib/utils';

interface GroupViewClientProps {
  initialEvent: EventRecord;
}

const PARTICIPANT_STORAGE_PREFIX = 'link:participant:';
const SUBMITTED_STORAGE_PREFIX = 'link:submitted:';

export default function GroupViewClient({initialEvent}: GroupViewClientProps) {
  const [participantName, setParticipantName] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);
  const [isResponsesOpen, setIsResponsesOpen] = useState(false);

  const participantStorageKey = `${PARTICIPANT_STORAGE_PREFIX}${initialEvent.id}`;
  const submissionStorageKey = `${SUBMITTED_STORAGE_PREFIX}${initialEvent.id}`;
  const bestOptions = getBestOptions(initialEvent);
  const responderNames = Array.from(new Set(initialEvent.responses.map((response) => response.participantName)));

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

  if (!hasSubmitted) {
    return (
      <section className="panel-border rounded-[24px] bg-white p-5 shadow-soft sm:rounded-[28px] sm:p-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight text-ink">Submit availability first</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          The group view unlocks after you save your response for this event.
        </p>
        <div className="mt-5">
          <Link
            className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#5c439d]"
            href={`/event/${initialEvent.id}#availability`}
          >
            Go to availability
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.08fr)_340px]">
        <div className="panel-border panel-shadow rounded-[24px] bg-white p-4 sm:rounded-[32px] sm:p-8">
          <div className="flex flex-col gap-5 sm:gap-8">
            <div>
              <h1 className="max-w-3xl font-headline text-[1.85rem] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl">
                Group view for {initialEvent.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft sm:mt-4 sm:text-lg sm:leading-7">
                Everyone&apos;s saved availability is collected here so the strongest overlap stands out quickly.
              </p>
            </div>

            <div className="grid gap-2.5 md:grid-cols-2 sm:gap-3">
              <div className="rounded-[18px] bg-surface-soft p-3 sm:rounded-[24px] sm:p-4">
                <div className="flex items-center gap-3">
                  <CalendarRange className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Dates</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{formatDateRange(initialEvent.dates)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] bg-surface-soft p-3 sm:rounded-[24px] sm:p-4">
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

              <div className="rounded-[18px] bg-surface-soft p-3 sm:rounded-[24px] sm:p-4">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Location</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{initialEvent.location || 'No location added yet'}</p>
                  </div>
                </div>
              </div>

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
                        {initialEvent.responses.length} {initialEvent.responses.length === 1 ? 'response' : 'responses'} saved
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {participantName ? `You submitted as ${participantName}.` : 'Your response has been saved.'}
                      </p>
                      <p className="mt-2 text-xs font-medium text-primary">
                        {initialEvent.responses.length > 0 ? 'Tap to see who has replied so far.' : 'Waiting for the first response.'}
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
          <ShareLinkBox eventId={initialEvent.id} />

          <div className="panel-border rounded-[24px] bg-white p-4 shadow-soft sm:rounded-[26px] sm:p-5">
            <p className="text-sm font-semibold text-ink">Need to make changes?</p>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              You can go back and update your availability at any time. The group view will reflect your latest saved response.
            </p>
            <Link
              className="mt-4 inline-flex rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-all duration-150 hover:border-primary/30 hover:text-primary"
              href={`/event/${initialEvent.id}#availability`}
            >
              Edit availability
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <GroupHeatmap event={initialEvent} />
      </section>

      <div className="mt-8">
        <PlaceholderFeatures bestOptions={bestOptions} location={initialEvent.location} totalParticipants={initialEvent.responses.length} />
      </div>
    </>
  );
}
