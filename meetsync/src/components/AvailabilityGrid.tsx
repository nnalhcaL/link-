'use client';

import {type KeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState} from 'react';
import {Clock3, PencilLine, RefreshCw, UserRound} from 'lucide-react';

import type {EventRecord} from '@/lib/types';
import {cn, formatDateHeader, formatTimeLabel, generateTimeRows, sortAvailability} from '@/lib/utils';

interface AvailabilityGridProps {
  event: EventRecord;
  participantName: string;
  initialAvailability: string[];
  onSaveName: (name: string) => void;
  onSubmit: (availability: string[]) => Promise<{ok: boolean; error?: string}>;
}

export default function AvailabilityGrid({
  event,
  participantName,
  initialAvailability,
  onSaveName,
  onSubmit,
}: AvailabilityGridProps) {
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set(initialAvailability));
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(!participantName);
  const [nameDraft, setNameDraft] = useState(participantName);
  const [nameError, setNameError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const timeRows = generateTimeRows(event.timeRangeStart, event.timeRangeEnd);
  const initialSignature = initialAvailability.join('|');

  useEffect(() => {
    setSelectedSlots(new Set(initialAvailability));
    setStatusMessage(null);
    setErrorMessage(null);
  }, [participantName, initialSignature, initialAvailability]);

  useEffect(() => {
    setNameDraft(participantName);
    setNameError(null);
    setIsEditingName(!participantName);
  }, [participantName]);

  useEffect(() => {
    function finishDrag() {
      setIsDragging(false);
    }

    window.addEventListener('pointerup', finishDrag);

    return () => {
      window.removeEventListener('pointerup', finishDrag);
    };
  }, []);

  useEffect(() => {
    if (!isEditingName) {
      return;
    }

    nameInputRef.current?.focus();
  }, [isEditingName]);

  function applyDrag(slotKey: string, mode: 'select' | 'deselect') {
    setSelectedSlots((current) => {
      const next = new Set(current);

      if (mode === 'select') {
        next.add(slotKey);
      } else {
        next.delete(slotKey);
      }

      return next;
    });
  }

  function openNameEditor() {
    setIsEditingName(true);
    setNameError(null);
  }

  function saveName() {
    const trimmedName = nameDraft.trim();

    if (!trimmedName) {
      setNameError('Enter your name before you choose availability.');
      return;
    }

    setNameError(null);
    onSaveName(trimmedName);
    setIsEditingName(false);
  }

  function handleNameKeyDown(eventKey: KeyboardEvent<HTMLInputElement>) {
    if (eventKey.key !== 'Enter') {
      return;
    }

    eventKey.preventDefault();
    saveName();
  }

  function handlePointerDown(slotKey: string, eventPointer: ReactPointerEvent<HTMLButtonElement>) {
    if (!participantName) {
      openNameEditor();
      return;
    }

    eventPointer.preventDefault();
    const mode = selectedSlots.has(slotKey) ? 'deselect' : 'select';
    setDragMode(mode);
    setIsDragging(true);
    setErrorMessage(null);
    setStatusMessage(null);
    applyDrag(slotKey, mode);
  }

  function handlePointerEnter(slotKey: string) {
    if (!isDragging) {
      return;
    }

    applyDrag(slotKey, dragMode);
  }

  async function handleSubmit() {
    if (!participantName) {
      openNameEditor();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await onSubmit(sortAvailability(selectedSlots));
    setIsSubmitting(false);

    if (result.ok) {
      setStatusMessage('Availability saved. Opening group view...');
      return;
    }

    setErrorMessage(result.error ?? 'We could not save your availability.');
  }

  return (
    <section className="space-y-6">
      <div className="panel-border rounded-[28px] bg-white p-5 shadow-soft">
        {isEditingName ? (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink">Your name</p>
                <span className="rounded-md bg-danger/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-danger">
                  Required
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Enter your name before you choose any availability so we can save your response correctly.
              </p>
            </div>

            <div className="w-full lg:max-w-[520px]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[24px] bg-surface-soft px-5 py-4">
                  <input
                    ref={nameInputRef}
                    className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-soft/75"
                    onChange={(eventInput) => setNameDraft(eventInput.target.value)}
                    onKeyDown={handleNameKeyDown}
                    placeholder="e.g. Alex Rivera"
                    value={nameDraft}
                  />
                  <UserRound className="h-5 w-5 text-ink-soft" />
                </div>

                <button
                  className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#5c439d]"
                  onClick={saveName}
                  type="button"
                >
                  {participantName ? 'Save name' : 'Enter name first'}
                </button>
              </div>

              {nameError ? <p className="mt-3 text-sm text-danger">{nameError}</p> : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <UserRound className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Your name</p>
                <p className="mt-1 text-sm text-ink-soft">{participantName}</p>
              </div>
            </div>

            <button
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-soft px-4 py-2.5 text-sm font-medium text-ink-soft transition-all duration-150 hover:border-primary/20 hover:text-ink"
              onClick={openNameEditor}
              type="button"
            >
              <PencilLine className="h-4 w-4" />
              Edit name
            </button>
          </div>
        )}
      </div>

      <div className="panel-border rounded-[28px] bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-5 text-sm text-ink-soft">
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-sm bg-primary" />
              Selected
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-sm bg-surface-strong" />
              Unselected
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" />
              {event.timezone}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-full border border-line bg-surface-soft px-4 py-2 text-sm font-medium text-ink-soft transition-all duration-150 hover:border-primary/20 hover:text-ink"
              type="button"
            >
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Calendar sync coming soon
              </span>
            </button>
            <button
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition-all duration-150 hover:bg-surface-soft hover:text-ink"
              onClick={() => setSelectedSlots(new Set())}
              type="button"
            >
              Clear all
            </button>
          </div>
        </div>
      </div>

      <div className="panel-border rounded-[32px] bg-white p-4 shadow-soft sm:p-6">
        <div className="relative">
          <div
            className={cn(
              'transition-opacity duration-150',
              participantName ? '' : 'pointer-events-none opacity-45',
            )}
          >
            <div className="grid-scroll overflow-x-auto">
              <div className="slot-grid min-w-[780px]">
                <div className="grid grid-cols-[84px_repeat(var(--date-count),minmax(110px,1fr))] gap-2" style={{'--date-count': event.dates.length} as React.CSSProperties}>
                  <div className="h-14" />
                  {event.dates.map((date) => {
                    const label = formatDateHeader(date);

                    return (
                      <div className="mb-1 flex flex-col items-center gap-1 text-center" key={date}>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">{label.weekday}</span>
                        <span className="font-headline text-xl font-bold tracking-tight text-ink">{label.day}</span>
                      </div>
                    );
                  })}

                  {timeRows.map((time) => (
                    <>
                      <div
                        className="flex h-12 items-center justify-end pr-4 text-xs font-medium text-ink-soft"
                        key={`${time}-label`}
                      >
                        {formatTimeLabel(time)}
                      </div>
                      {event.dates.map((date) => {
                        const slotKey = `${date}T${time}`;
                        const isSelected = selectedSlots.has(slotKey);

                        return (
                          <button
                            className={cn(
                              'h-12 rounded-2xl border transition-all duration-100',
                              isSelected ? 'border-white bg-primary text-white' : 'border-white bg-surface-soft hover:bg-primary/8',
                            )}
                            key={slotKey}
                            onPointerDown={(eventPointer) => handlePointerDown(slotKey, eventPointer)}
                            onPointerEnter={() => handlePointerEnter(slotKey)}
                            type="button"
                          />
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {!participantName ? (
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <button
                className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-all duration-150 hover:border-primary/30 hover:text-primary"
                onClick={openNameEditor}
                type="button"
              >
                Enter your name to choose times
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {statusMessage ? <p className="text-sm text-success">{statusMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}

      <div className="flex flex-col items-start justify-between gap-4 rounded-[28px] bg-tertiary-soft/70 p-5 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold text-tertiary">{selectedSlots.size} slots selected</p>
          <p className="mt-1 text-sm text-tertiary/80">Submit to save your response and reveal the shared overlap.</p>
        </div>
        <button
          className="rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#5c439d] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          onClick={() => void handleSubmit()}
          type="button"
        >
          {isSubmitting ? 'Saving availability…' : "Submit and View Group's Availability"}
        </button>
      </div>
    </section>
  );
}
