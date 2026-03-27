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
  const activePointerIdRef = useRef<number | null>(null);
  const lastPaintedSlotRef = useRef<string | null>(null);
  const timeRows = generateTimeRows(event.timeRangeStart, event.timeRangeEnd);
  const initialSignature = initialAvailability.join('|');
  const gridMinWidth = Math.max(320, 60 + event.dates.length * 88);

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
    function resetDragState() {
      setIsDragging(false);
      activePointerIdRef.current = null;
      lastPaintedSlotRef.current = null;
    }

    window.addEventListener('pointerup', resetDragState);
    window.addEventListener('pointercancel', resetDragState);

    return () => {
      window.removeEventListener('pointerup', resetDragState);
      window.removeEventListener('pointercancel', resetDragState);
    };
  }, []);

  useEffect(() => {
    if (!isEditingName) {
      return;
    }

    nameInputRef.current?.focus();
  }, [isEditingName]);

  function paintSlot(slotKey: string, mode: 'select' | 'deselect', force = false) {
    if (!force && lastPaintedSlotRef.current === slotKey) {
      return;
    }

    lastPaintedSlotRef.current = slotKey;
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

  function finishDrag(pointerId?: number, element?: HTMLElement | null) {
    if (typeof pointerId === 'number' && element?.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }

    setIsDragging(false);
    activePointerIdRef.current = null;
    lastPaintedSlotRef.current = null;
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
    activePointerIdRef.current = eventPointer.pointerId;
    lastPaintedSlotRef.current = null;
    setErrorMessage(null);
    setStatusMessage(null);
    if (eventPointer.pointerType !== 'touch') {
      eventPointer.currentTarget.setPointerCapture(eventPointer.pointerId);
    }
    paintSlot(slotKey, mode, true);
  }

  function handlePointerMove(eventPointer: ReactPointerEvent<HTMLElement>) {
    if (!isDragging || activePointerIdRef.current !== eventPointer.pointerId) {
      return;
    }

    eventPointer.preventDefault();
    const pointedElement = document.elementFromPoint(eventPointer.clientX, eventPointer.clientY);

    if (!(pointedElement instanceof HTMLElement)) {
      return;
    }

    const slotButton = pointedElement.closest<HTMLElement>('[data-slot-key]');
    const slotKey = slotButton?.dataset.slotKey;

    if (!slotKey) {
      return;
    }

    paintSlot(slotKey, dragMode);
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
    <section className="space-y-4 sm:space-y-6">
      <div className="panel-border rounded-[24px] bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
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
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] bg-surface-soft px-4 py-3.5 sm:rounded-[24px] sm:px-5 sm:py-4">
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
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#5c439d] sm:w-auto"
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

      <div className="panel-border rounded-[24px] bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-sm text-ink-soft sm:gap-5">
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
            <p className="text-sm text-ink-soft">Tap once or drag across the grid to paint your availability.</p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              className="w-full rounded-xl border border-line bg-surface-soft px-4 py-2.5 text-sm font-medium text-ink-soft transition-all duration-150 hover:border-primary/20 hover:text-ink sm:w-auto"
              type="button"
            >
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Calendar sync coming soon
              </span>
            </button>
            <button
              className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-ink-soft transition-all duration-150 hover:bg-surface-soft hover:text-ink sm:w-auto"
              onClick={() => setSelectedSlots(new Set())}
              type="button"
            >
              Clear all
            </button>
          </div>
        </div>
      </div>

      <div className="panel-border rounded-[24px] bg-white p-3 pb-5 shadow-soft sm:rounded-[32px] sm:p-6">
        <div className="relative">
          <div
            className={cn(
              'transition-opacity duration-150',
              participantName ? '' : 'pointer-events-none opacity-45',
            )}
          >
            <div className="grid-scroll overflow-x-auto px-1 pb-4 pt-2 sm:px-0 sm:pb-1 sm:pt-0">
              <div className="slot-grid pr-5 sm:pr-4" onPointerMove={handlePointerMove} style={{minWidth: `${gridMinWidth}px`}}>
                <div
                  className="grid grid-cols-[60px_repeat(var(--date-count),minmax(88px,1fr))] gap-2 sm:grid-cols-[84px_repeat(var(--date-count),minmax(110px,1fr))] sm:gap-2"
                  style={{'--date-count': event.dates.length} as React.CSSProperties}
                >
                  <div className="sticky-time-cell sticky-time-cell--corner h-16 sm:h-14" />
                  {event.dates.map((date) => {
                    const label = formatDateHeader(date);

                    return (
                      <div className="pointer-events-none mb-2 flex min-h-[64px] flex-col items-center justify-center gap-1 py-2 text-center sm:mb-1 sm:min-h-0 sm:py-0" key={date}>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">{label.weekday}</span>
                        <span className="font-headline text-lg font-bold tracking-tight text-ink sm:text-xl">{label.day}</span>
                      </div>
                    );
                  })}

                  {timeRows.map((time) => (
                    <>
                      <div
                        className="sticky-time-cell flex h-11 items-center justify-end pr-3 text-[11px] font-medium text-ink-soft sm:h-12 sm:pr-4 sm:text-xs"
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
                              'h-11 rounded-[18px] border transition-all duration-100 sm:h-12 sm:rounded-2xl',
                              isSelected ? 'border-white bg-primary text-white' : 'border-white bg-surface-soft hover:bg-primary/8',
                            )}
                            aria-pressed={isSelected}
                            data-slot-key={slotKey}
                            key={slotKey}
                            onPointerDown={(eventPointer) => handlePointerDown(slotKey, eventPointer)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={(eventPointer) => finishDrag(eventPointer.pointerId, eventPointer.currentTarget)}
                            onPointerCancel={(eventPointer) => finishDrag(eventPointer.pointerId, eventPointer.currentTarget)}
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

      <div className="flex flex-col items-start justify-between gap-4 rounded-[24px] bg-tertiary-soft/70 p-4 sm:rounded-[28px] sm:p-5 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold text-tertiary">{selectedSlots.size} slots selected</p>
          <p className="mt-1 text-sm text-tertiary/80">Submit to save your response and reveal the shared overlap.</p>
        </div>
        <button
          className="w-full rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#5c439d] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
