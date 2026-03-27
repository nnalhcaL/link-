import {CloudSun, Compass, Sparkles} from 'lucide-react';

import type {SlotSummary} from '@/lib/types';
import {formatDateLabel, formatTimeLabel} from '@/lib/utils';

interface PlaceholderFeaturesProps {
  bestOptions: SlotSummary[];
  totalParticipants: number;
  location: string | null;
}

export default function PlaceholderFeatures({
  bestOptions,
  totalParticipants,
  location,
}: PlaceholderFeaturesProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="panel-border rounded-[28px] bg-white p-6 shadow-soft">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold tracking-tight text-ink">AI Summary</h2>
            <p className="text-sm text-ink-soft">Deterministic suggestions powered by overlap counts.</p>
          </div>
        </div>

        {bestOptions.length === 0 ? (
          <p className="rounded-2xl bg-surface-soft px-4 py-4 text-sm leading-6 text-ink-soft">
            Smart meeting time suggestions will appear here once your group starts responding.
          </p>
        ) : (
          <div className="space-y-3">
            {bestOptions.map((option, index) => (
              <div className="rounded-2xl bg-surface-soft px-4 py-4" key={option.slotKey}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-ink">
                    {formatDateLabel(option.date)} at {formatTimeLabel(option.time)}
                  </p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary">
                    {option.count}/{Math.max(totalParticipants, 1)} free
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink-soft">
                  {index === 0 ? 'Best match so far.' : 'Strong alternate option.'} {option.participantNames.join(', ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[28px] border border-dashed border-line bg-white/70 p-6 opacity-80 shadow-soft">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-secondary-soft p-3 text-secondary">
            <CloudSun className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold tracking-tight text-ink">Weather Forecast</h2>
            <p className="text-sm text-ink-soft">Coming soon for location-based plans.</p>
          </div>
        </div>

        <div className="rounded-2xl bg-surface-soft px-4 py-4 text-sm leading-6 text-ink-soft">
          <p className="flex items-center gap-2 font-medium text-ink">
            <Compass className="h-4 w-4 text-secondary" />
            {location ? `Pinned to ${location}` : 'Add a location when you create a link'}
          </p>
          <p className="mt-2">
            See weather predictions for your meeting dates without leaving the results view. The scheduling flow is ready
            for it whenever you are.
          </p>
        </div>
      </div>
    </section>
  );
}

