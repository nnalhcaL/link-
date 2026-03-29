'use client';

import {useState} from 'react';
import {Sparkles} from 'lucide-react';

import type {EventRecord} from '@/lib/types';
import {
  buildAvailabilityWindowSummaries,
  formatDateLabel,
  formatTimeLabel,
  getDurationOptions,
  getLongestAvailableDuration,
  getLongestFullGroupWindow,
} from '@/lib/utils';

interface PlaceholderFeaturesProps {
  event: EventRecord;
}

const MATCH_BATCH_SIZE = 3;
const LONGEST_DURATION_OPTION = 'longest';

function formatDurationLabel(hours: number) {
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

function formatWindowTimeLabel(startTime: string, endTime: string) {
  return `${formatTimeLabel(startTime)} to ${formatTimeLabel(endTime)}`;
}

function formatMatchSummary(hours: number, count: number, totalParticipants: number, isFullGroup: boolean) {
  if (isFullGroup) {
    return `Everyone can make this ${formatDurationLabel(hours)} window.`;
  }

  return `${formatDurationLabel(hours)} window with ${count} of ${totalParticipants} people available.`;
}

export default function PlaceholderFeatures({event}: PlaceholderFeaturesProps) {
  const totalParticipants = event.responses.length;
  const durationOptions = getDurationOptions(event);
  const longestFullGroupWindow = getLongestFullGroupWindow(event);
  const longestDurationHours = longestFullGroupWindow?.durationHours ?? getLongestAvailableDuration(event);
  const [selectedDurationOption, setSelectedDurationOption] = useState<string>(LONGEST_DURATION_OPTION);
  const [visibleMatchCount, setVisibleMatchCount] = useState(MATCH_BATCH_SIZE);

  const selectedDurationHours =
    selectedDurationOption === LONGEST_DURATION_OPTION ? longestDurationHours : Number(selectedDurationOption);
  const matches = buildAvailabilityWindowSummaries(event, selectedDurationHours);
  const visibleMatches = matches.slice(0, visibleMatchCount);
  const hiddenMatchCount = Math.max(matches.length - visibleMatches.length, 0);
  const durationInputId = `summary-duration-${event.id}`;

  return (
    <section className="panel-border rounded-[28px] bg-white p-6 shadow-soft">
      <div className="flex flex-col gap-5 border-b border-line pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold tracking-tight text-ink">AI Summary</h2>
            <p className="text-sm leading-6 text-ink-soft">Continuous overlap for the group, ranked into useful windows.</p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-[280px]">
          <label className="text-sm font-semibold text-ink" htmlFor={durationInputId}>
            Hangout duration
          </label>
          <select
            className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition-colors duration-150 focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
            disabled={totalParticipants === 0}
            id={durationInputId}
            onChange={(event) => {
              setSelectedDurationOption(event.target.value);
              setVisibleMatchCount(MATCH_BATCH_SIZE);
            }}
            value={selectedDurationOption}
          >
            <option value={LONGEST_DURATION_OPTION}>Longest Duration</option>
            {durationOptions.map((durationHours) => (
              <option key={durationHours} value={String(durationHours)}>
                {formatDurationLabel(durationHours)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5">
        {totalParticipants === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface-soft px-4 py-4 text-sm leading-6 text-ink-soft">
            Smart scheduling suggestions will appear here once your group starts responding.
          </div>
        ) : (
          <>
            {longestFullGroupWindow ? (
              <p className="text-sm leading-6 text-ink-soft">
                Showing the top {formatDurationLabel(selectedDurationHours)} matches, starting with the strongest overlap.
              </p>
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-surface-soft px-4 py-4 text-sm leading-6 text-ink-soft">
                There isn&apos;t a continuous block where everyone overlaps yet. Showing the strongest{' '}
                {formatDurationLabel(selectedDurationHours)} matches instead.
              </div>
            )}

            {matches.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface-soft px-4 py-4 text-sm leading-6 text-ink-soft">
                No one has a continuous {formatDurationLabel(selectedDurationHours)} window yet.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleMatches.map((match, index) => (
                  <div
                    className={index === 0 ? 'rounded-2xl bg-surface-soft px-4 py-4' : 'rounded-2xl border border-line px-4 py-4'}
                    key={match.windowKey}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-ink">{formatDateLabel(match.date)}</p>
                        <p className="mt-1 text-lg font-semibold text-ink">
                          {formatWindowTimeLabel(match.startTime, match.endTime)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-ink-soft">
                          {formatMatchSummary(match.durationHours, match.count, totalParticipants, match.isFullGroup)}
                        </p>
                      </div>

                      <div className="group relative shrink-0 self-start">
                        <button
                          aria-label={`Show who can make the ${formatWindowTimeLabel(match.startTime, match.endTime)} window`}
                          className={
                            index === 0
                              ? 'rounded-xl border border-line bg-white px-3 py-2 text-right outline-none transition-colors duration-150 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10'
                              : 'rounded-xl border border-line bg-surface-soft px-3 py-2 text-right outline-none transition-colors duration-150 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10'
                          }
                          type="button"
                        >
                          <p className="text-xs text-ink-soft">Responses</p>
                          <p className="text-sm font-semibold text-ink">
                            {match.isFullGroup ? 'Everyone free' : `${match.count}/${totalParticipants} free`}
                          </p>
                        </button>

                        <div className="pointer-events-none absolute right-0 top-[calc(100%+10px)] z-20 hidden w-64 rounded-xl border border-line bg-white p-3 text-left shadow-soft group-hover:block group-focus-within:block">
                          <p className="text-xs font-semibold text-ink-soft">Who can make it</p>
                          <p className="mt-2 text-sm leading-6 text-ink">{match.participantNames.join(', ')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hiddenMatchCount > 0 ? (
              <button
                className="mt-4 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:border-primary/30 hover:text-primary"
                onClick={() => setVisibleMatchCount((current) => current + MATCH_BATCH_SIZE)}
                type="button"
              >
                Show {Math.min(MATCH_BATCH_SIZE, hiddenMatchCount)} more
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
