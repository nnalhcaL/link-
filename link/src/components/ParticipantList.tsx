import {Users} from 'lucide-react';

import type {EventResponseRecord} from '@/lib/types';
import {cn, getParticipantInitials, getParticipantTone} from '@/lib/utils';

interface ParticipantListProps {
  responses: EventResponseRecord[];
  currentParticipantName?: string;
}

export default function ParticipantList({responses, currentParticipantName}: ParticipantListProps) {
  return (
    <aside className="panel-border rounded-[28px] bg-white p-6 shadow-soft">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-headline text-xl font-bold tracking-tight text-ink">Responders</h2>
          <p className="text-sm text-ink-soft">{responses.length} responses</p>
        </div>
      </div>

      {responses.length === 0 ? (
        <p className="rounded-2xl bg-surface-soft px-4 py-4 text-sm leading-6 text-ink-soft">
          Once people submit their availability, they&apos;ll show up here.
        </p>
      ) : (
        <div className="space-y-3">
          {responses.map((response) => (
            <div
              className={cn(
                'flex items-center justify-between rounded-2xl border border-transparent bg-surface-soft px-4 py-3',
                response.participantName === currentParticipantName ? 'border-primary/25 bg-primary/5' : '',
              )}
              key={response.id}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold',
                    getParticipantTone(response.participantName),
                  )}
                >
                  {getParticipantInitials(response.participantName)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{response.participantName}</p>
                  <p className="text-xs text-ink-soft">{response.availability.length} slots selected</p>
                </div>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-ink-soft">Answered</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

