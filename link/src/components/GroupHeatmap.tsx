'use client';

import {useState} from 'react';
import {Settings, Sparkles} from 'lucide-react';

import type {EventRecord, SlotSummary} from '@/lib/types';
import {buildSlotSummaries, formatDateHeader, formatDateLabel, formatTimeLabel, generateTimeRows, getHeatmapColor} from '@/lib/utils';

interface GroupHeatmapProps {
  event: EventRecord;
}

export default function GroupHeatmap({event}: GroupHeatmapProps) {
  const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);

  const summaries = buildSlotSummaries(event);
  const summaryMap = new Map(summaries.map((summary) => [summary.slotKey, summary]));
  const activeSummary =
    summaryMap.get(hoveredSlotKey ?? '') ?? summaryMap.get(selectedSlotKey ?? '') ?? summaries.find((summary) => summary.count > 0) ?? null;
  const timeRows = generateTimeRows(event.timeRangeStart, event.timeRangeEnd);
  const totalParticipants = event.responses.length;
  const gridMinWidth = Math.max(320, 72 + event.dates.length * 92);

  function tooltip(summary: SlotSummary) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-0 z-50 hidden w-60 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-2xl bg-slate-950 px-4 py-3 text-left text-white shadow-2xl sm:block">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
          {formatDateLabel(summary.date)} at {formatTimeLabel(summary.time)}
        </p>
        <p className="mt-2 text-sm font-semibold">
          {summary.count} of {Math.max(totalParticipants, 1)} available
        </p>
        <p className="mt-2 text-sm text-white/75">
          {summary.participantNames.length > 0 ? summary.participantNames.join(', ') : 'Nobody has marked this slot yet.'}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="panel-border rounded-[24px] bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold tracking-tight text-ink">Group availability</h2>
              <p className="text-sm text-ink-soft">Tap or hover any slot to see the overlap and who can make it.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-soft px-3 py-2 text-xs font-semibold text-ink-soft sm:rounded-full sm:px-4">
            <span>Low</span>
            <span className="h-3 w-3 rounded-sm bg-[#ebe4ff]" />
            <span className="h-3 w-3 rounded-sm bg-[#a38be4]" />
            <span className="h-3 w-3 rounded-sm bg-primary" />
            <span>All available</span>
          </div>
        </div>

        <div className="grid-scroll overflow-x-auto pb-1">
          <div className="pr-3 sm:pr-7" style={{minWidth: `${gridMinWidth}px`}}>
            <div
              className="grid grid-cols-[72px_repeat(var(--date-count),minmax(92px,1fr))] gap-1.5 sm:grid-cols-[84px_repeat(var(--date-count),minmax(110px,1fr))] sm:gap-2"
              style={{'--date-count': event.dates.length} as React.CSSProperties}
            >
              <div className="sticky-time-cell sticky-time-cell--corner h-12 sm:h-14" />
              {event.dates.map((date) => {
                const label = formatDateHeader(date);

                return (
                  <div className="pointer-events-none mb-1 flex flex-col items-center gap-1 text-center" key={date}>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">{label.weekday}</span>
                    <span className="font-headline text-lg font-bold tracking-tight text-ink sm:text-xl">{label.day}</span>
                  </div>
                );
              })}

              {timeRows.map((time) => (
                <>
                  <div
                    className="sticky-time-cell flex h-11 items-center justify-end pr-2 text-[11px] font-medium text-ink-soft sm:h-12 sm:pr-4 sm:text-xs"
                    key={`${time}-label`}
                  >
                    {formatTimeLabel(time)}
                  </div>
                  {event.dates.map((date) => {
                    const slotKey = `${date}T${time}`;
                    const summary = summaryMap.get(slotKey);

                    if (!summary) {
                      return (
                        <div
                          className="h-11 rounded-[18px] border border-white bg-surface-soft sm:h-12 sm:rounded-2xl"
                          key={slotKey}
                        />
                      );
                    }

                    const isHovered = hoveredSlotKey === slotKey;
                    const isSelected = selectedSlotKey === slotKey;

                    return (
                      <button
                        className={`relative flex h-11 items-center justify-center rounded-[18px] border border-white text-xs font-semibold text-white transition-transform duration-150 hover:scale-[1.03] sm:h-12 sm:rounded-2xl ${
                          isHovered || isSelected ? 'z-30' : 'z-[1]'
                        }`}
                        key={slotKey}
                        onBlur={() => setHoveredSlotKey(null)}
                        onClick={() => setSelectedSlotKey(slotKey)}
                        onFocus={() => setHoveredSlotKey(slotKey)}
                        onMouseEnter={() => setHoveredSlotKey(slotKey)}
                        onMouseLeave={() => setHoveredSlotKey(null)}
                        style={{
                          backgroundColor: getHeatmapColor(summary.count, totalParticipants),
                          boxShadow: isSelected ? 'inset 0 0 0 2px rgba(255,255,255,0.65)' : undefined,
                        }}
                        type="button"
                      >
                        {summary.ratio === 1 && totalParticipants > 0 ? <Sparkles className="h-4 w-4" /> : summary.count || ''}
                        {isHovered ? tooltip(summary) : null}
                      </button>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel-border rounded-[24px] bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
        {activeSummary ? (
          <>
            <p className="text-sm font-semibold text-primary">
              {formatDateLabel(activeSummary.date)} at {formatTimeLabel(activeSummary.time)}
            </p>
            <p className="mt-2 text-lg font-semibold text-ink">
              {activeSummary.count} of {Math.max(totalParticipants, 1)} people can make this slot.
            </p>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              {activeSummary.participantNames.length > 0
                ? activeSummary.participantNames.join(', ')
                : 'No one has selected this slot yet.'}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-soft">Once responses arrive, the strongest overlap will show up here.</p>
        )}
      </div>
    </section>
  );
}
