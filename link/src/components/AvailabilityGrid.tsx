'use client';

import {
  type CSSProperties,
  Fragment,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CheckCircle2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  PencilLine,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react';

import {
  buildGoogleCalendarImportProjection,
  fetchGoogleBusyDetails,
  fetchGoogleBusyIntervals,
  fetchGoogleCalendars,
  getDefaultSelectedCalendarIds,
  getGoogleReconnectHint,
  getStoredSelectedCalendarIds,
  loadGoogleIdentityScript,
  requestGoogleAccessToken,
  setGoogleReconnectHint,
  setStoredSelectedCalendarIds,
} from '@/lib/google-calendar';
import {
  getClampedMobileDateIndex,
  getMobileDatePageRange,
  getMobileVisibleDayCount,
  getSlotPointerDownBehavior,
} from '@/lib/availability-interactions';
import type {
  EventRecord,
  GoogleCalendarBusyDetail,
  GoogleCalendarConnectionState,
  GoogleCalendarImportState,
  GoogleCalendarRecord,
  SlotSummary,
} from '@/lib/types';
import {
  buildSlotSummaries,
  cn,
  formatDateHeader,
  formatDateLabel,
  formatTimeLabel,
  generateTimeRows,
  getHeatmapColor,
  sortAvailability,
} from '@/lib/utils';

interface AvailabilityGridProps {
  event: EventRecord;
  participantName: string;
  initialAvailability: string[];
  isManualEntryOpen: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onOpenManualEntry: () => void;
  onRequestName: () => void;
  onSubmit: (availability: string[]) => Promise<{ok: boolean; error?: string}>;
  responseId?: string;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? '';

function formatMobilePageDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatMobilePageSummary(dates: string[]) {
  if (dates.length === 0) {
    return 'Choose dates';
  }

  if (dates.length === 1) {
    return formatMobilePageDate(dates[0]);
  }

  return `${formatMobilePageDate(dates[0])} to ${formatMobilePageDate(dates[dates.length - 1])}`;
}

export default function AvailabilityGrid({
  event,
  participantName,
  initialAvailability,
  isManualEntryOpen,
  onDirtyChange,
  onOpenManualEntry,
  onRequestName,
  onSubmit,
  responseId,
}: AvailabilityGridProps) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set(initialAvailability));
  const [importedBusySlots, setImportedBusySlots] = useState<Set<string>>(new Set());
  const [importedBusyDetailsBySlot, setImportedBusyDetailsBySlot] = useState<Record<string, GoogleCalendarBusyDetail[]>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasUnsavedManualChanges, setHasUnsavedManualChanges] = useState(false);
  const [googleConnectionState, setGoogleConnectionState] = useState<GoogleCalendarConnectionState>(
    GOOGLE_CLIENT_ID ? 'connecting' : 'unavailable',
  );
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarRecord[]>([]);
  const [selectedGoogleCalendarIds, setSelectedGoogleCalendarIds] = useState<Set<string>>(new Set());
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleStatusMessage, setGoogleStatusMessage] = useState<string | null>(null);
  const [googleErrorMessage, setGoogleErrorMessage] = useState<string | null>(null);
  const [isImportingGoogle, setIsImportingGoogle] = useState(false);
  const [lastImportedAt, setLastImportedAt] = useState<string | null>(null);
  const [mobileVisibleDayCount, setMobileVisibleDayCount] = useState<2 | 3>(3);
  const [activeMobileDateIndex, setActiveMobileDateIndex] = useState(0);
  const [activeGoogleBusySlotKey, setActiveGoogleBusySlotKey] = useState<string | null>(null);
  const [hoveredGoogleBusySlotKey, setHoveredGoogleBusySlotKey] = useState<string | null>(null);
  const [googleBusyTooltip, setGoogleBusyTooltip] = useState<{
    slotKey: string;
    date: string;
    time: string;
    left: number;
    top: number;
  } | null>(null);
  const [hoveredHeatmapSlotKey, setHoveredHeatmapSlotKey] = useState<string | null>(null);
  const [selectedHeatmapSlotKey, setSelectedHeatmapSlotKey] = useState<string | null>(null);
  const [heatmapTooltip, setHeatmapTooltip] = useState<{
    slotKey: string;
    date: string;
    time: string;
    left: number;
    top: number;
  } | null>(null);

  const activePointerIdRef = useRef<number | null>(null);
  const lastPaintedSlotRef = useRef<string | null>(null);
  const googleBusyTooltipHostRef = useRef<HTMLDivElement>(null);
  const heatmapTooltipHostRef = useRef<HTMLDivElement>(null);
  const timeRows = useMemo(() => generateTimeRows(event.timeRangeStart, event.timeRangeEnd), [event.timeRangeEnd, event.timeRangeStart]);
  const initialSignature = initialAvailability.join('|');
  const eventDatesSignature = event.dates.join('|');
  const slotSummaries = useMemo(() => buildSlotSummaries(event), [event]);
  const summaryMap = useMemo(() => new Map(slotSummaries.map((summary) => [summary.slotKey, summary])), [slotSummaries]);
  const totalParticipants = event.responses.length;
  const activeSummary =
    summaryMap.get(hoveredHeatmapSlotKey ?? '') ??
    summaryMap.get(selectedHeatmapSlotKey ?? '') ??
    slotSummaries.find((summary) => summary.count > 0) ??
    null;
  const tooltipSummary = heatmapTooltip ? summaryMap.get(heatmapTooltip.slotKey) ?? null : null;
  const gridMinWidth = Math.max(264, event.dates.length * 88);
  const heatmapGridMinWidth = Math.max(320, 72 + event.dates.length * 92);
  const mobilePageRange = useMemo(
    () => getMobileDatePageRange(activeMobileDateIndex, mobileVisibleDayCount, event.dates.length),
    [activeMobileDateIndex, event.dates.length, mobileVisibleDayCount],
  );
  const mobileVisibleDates = event.dates.slice(mobilePageRange.startIndex, mobilePageRange.endIndex);
  const mobileVisibleDateCount = Math.max(mobileVisibleDates.length, 1);
  const mobileVisibleRangeLabel = formatMobilePageSummary(mobileVisibleDates);
  const googleImportState: GoogleCalendarImportState = useMemo(
    () => ({
      connectionState: googleConnectionState,
      selectedCalendarIds: [...selectedGoogleCalendarIds],
      importedBusySlotKeys: [...importedBusySlots],
      lastImportedAt,
    }),
    [googleConnectionState, importedBusySlots, lastImportedAt, selectedGoogleCalendarIds],
  );
  const hasImportedGoogleBusyHints = googleImportState.importedBusySlotKeys.length > 0;
  const isGoogleConnected = googleConnectionState === 'connected';
  const isGoogleUnavailable = googleConnectionState === 'unavailable';
  const activeGoogleBusyDetails = activeGoogleBusySlotKey ? importedBusyDetailsBySlot[activeGoogleBusySlotKey] ?? [] : [];
  const tooltipGoogleBusyDetails = googleBusyTooltip ? importedBusyDetailsBySlot[googleBusyTooltip.slotKey] ?? [] : [];
  const activeMobileDate = event.dates[activeMobileDateIndex] ?? mobileVisibleDates[0] ?? event.dates[0] ?? null;
  const activeMobileSlotKey =
    activeGoogleBusySlotKey && activeMobileDate && activeGoogleBusySlotKey.startsWith(`${activeMobileDate}T`)
      ? activeGoogleBusySlotKey
      : null;
  const hasPreviousMobilePage = mobilePageRange.startIndex > 0;
  const hasNextMobilePage = mobilePageRange.endIndex < event.dates.length;
  const activeMobileDayBusyDetails = useMemo(() => {
    if (!activeMobileDate) {
      return [];
    }

    const uniqueDetails = new Map<string, GoogleCalendarBusyDetail>();

    for (const [slotKey, details] of Object.entries(importedBusyDetailsBySlot)) {
      if (!slotKey.startsWith(`${activeMobileDate}T`)) {
        continue;
      }

      for (const detail of details) {
        const uniqueKey = `${detail.id}:${detail.start}:${detail.end}:${detail.calendarId}:${detail.title}`;

        if (!uniqueDetails.has(uniqueKey)) {
          uniqueDetails.set(uniqueKey, detail);
        }
      }
    }

    return [...uniqueDetails.values()].sort((left, right) => {
      if (left.start !== right.start) {
        return left.start.localeCompare(right.start);
      }

      if (left.end !== right.end) {
        return left.end.localeCompare(right.end);
      }

      if (left.calendarSummary !== right.calendarSummary) {
        return left.calendarSummary.localeCompare(right.calendarSummary);
      }

      return left.title.localeCompare(right.title);
    });
  }, [activeMobileDate, importedBusyDetailsBySlot]);
  const mobileInspectorDetails = activeMobileSlotKey ? importedBusyDetailsBySlot[activeMobileSlotKey] ?? [] : activeMobileDayBusyDetails;

  useEffect(() => {
    if (hasUnsavedManualChanges || isManualEntryOpen) {
      return;
    }

    setSelectedSlots(new Set(initialAvailability));
    setImportedBusySlots(new Set());
    setImportedBusyDetailsBySlot({});
    setActiveGoogleBusySlotKey(null);
    setHoveredGoogleBusySlotKey(null);
    setGoogleBusyTooltip(null);
    setLastImportedAt(null);
    setStatusMessage(null);
    setErrorMessage(null);
  }, [hasUnsavedManualChanges, isManualEntryOpen, participantName, initialSignature, initialAvailability]);

  useEffect(() => {
    onDirtyChange?.(hasUnsavedManualChanges);
  }, [hasUnsavedManualChanges, onDirtyChange]);

  useEffect(() => {
    setActiveMobileDateIndex(0);
  }, [event.id]);

  useEffect(() => {
    setActiveMobileDateIndex((current) => getClampedMobileDateIndex(current, event.dates.length));
  }, [eventDatesSignature, event.dates.length, mobileVisibleDayCount]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQueryList = window.matchMedia('(min-width: 390px)');
    const updateMobileVisibleDays = () => {
      setMobileVisibleDayCount(getMobileVisibleDayCount(window.innerWidth));
    };

    updateMobileVisibleDays();

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', updateMobileVisibleDays);

      return () => {
        mediaQueryList.removeEventListener('change', updateMobileVisibleDays);
      };
    }

    mediaQueryList.addListener(updateMobileVisibleDays);

    return () => {
      mediaQueryList.removeListener(updateMobileVisibleDays);
    };
  }, []);

  useEffect(() => {
    if (!activeMobileDate) {
      setActiveGoogleBusySlotKey(null);
      return;
    }

    setActiveGoogleBusySlotKey((current) => (current?.startsWith(`${activeMobileDate}T`) ? current : null));
  }, [activeMobileDate]);

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
    setSelectedGoogleCalendarIds(new Set(getStoredSelectedCalendarIds(event.id)));
    setGoogleStatusMessage(null);
    setGoogleErrorMessage(null);
    setImportedBusySlots(new Set());
    setImportedBusyDetailsBySlot({});
    setActiveGoogleBusySlotKey(null);
    setHoveredGoogleBusySlotKey(null);
    setGoogleBusyTooltip(null);
    setLastImportedAt(null);
  }, [event.id]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setGoogleConnectionState('unavailable');
      return;
    }

    let isCancelled = false;

    async function initializeGoogleImport() {
      try {
        await loadGoogleIdentityScript();

        if (isCancelled) {
          return;
        }

        setGoogleConnectionState('ready');
      } catch {
        if (isCancelled) {
          return;
        }

        setGoogleConnectionState('unavailable');
        setGoogleErrorMessage('Google Calendar import is unavailable right now.');
      }
    }

    void initializeGoogleImport();

    return () => {
      isCancelled = true;
    };
  }, [event.id]);

  function paintSlot(slotKey: string, mode: 'select' | 'deselect', force = false) {
    if (!force && lastPaintedSlotRef.current === slotKey) {
      return;
    }

    lastPaintedSlotRef.current = slotKey;
    setHasUnsavedManualChanges(true);
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

  function requireNameBeforeGoogleImport() {
    if (participantName) {
      return true;
    }

    setGoogleErrorMessage('Enter your name before importing from Google Calendar.');
    onRequestName();
    return false;
  }

  function formatGoogleImportTimestamp(value: string) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  function formatBusyDetailDateTime(value: string, includeDate = false) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: event.timezone,
      month: includeDate ? 'short' : undefined,
      day: includeDate ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  function formatBusyDetailRange(detail: GoogleCalendarBusyDetail) {
    if (detail.isAllDay) {
      return 'All day';
    }

    const startDate = new Date(detail.start);
    const endDate = new Date(detail.end);
    const sameDay =
      startDate.toLocaleDateString('en-CA', {timeZone: event.timezone}) === endDate.toLocaleDateString('en-CA', {timeZone: event.timezone});

    if (sameDay) {
      return `${formatBusyDetailDateTime(detail.start)} to ${formatBusyDetailDateTime(detail.end)}`;
    }

    return `${formatBusyDetailDateTime(detail.start, true)} to ${formatBusyDetailDateTime(detail.end, true)}`;
  }

  function showGoogleBusyTooltip(
    slotKey: string,
    date: string,
    time: string,
    target: HTMLElement,
  ) {
    if (!googleBusyTooltipHostRef.current) {
      return;
    }

    const hostRect = googleBusyTooltipHostRef.current.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const estimatedTooltipWidth = 288;
    const minLeft = estimatedTooltipWidth / 2 + 16;
    const maxLeft = Math.max(minLeft, hostRect.width - estimatedTooltipWidth / 2 - 16);
    const unclampedLeft = targetRect.left + targetRect.width / 2 - hostRect.left;
    const left = Math.min(Math.max(unclampedLeft, minLeft), maxLeft);
    const top = Math.max(targetRect.top - hostRect.top - 12, 16);

    setHoveredGoogleBusySlotKey(slotKey);
    setGoogleBusyTooltip({
      slotKey,
      date,
      time,
      left,
      top,
    });
  }

  function hideGoogleBusyTooltip(slotKey: string) {
    setHoveredGoogleBusySlotKey((current) => (current === slotKey ? null : current));
    setGoogleBusyTooltip((current) => (current?.slotKey === slotKey ? null : current));
  }

  function applyLoadedGoogleCalendars(calendars: GoogleCalendarRecord[]) {
    const preferredIds = selectedGoogleCalendarIds.size > 0 ? [...selectedGoogleCalendarIds] : getStoredSelectedCalendarIds(event.id);
    const defaultIds = getDefaultSelectedCalendarIds(calendars, preferredIds);

    setGoogleCalendars(calendars);
    setSelectedGoogleCalendarIds(new Set(defaultIds));
    setStoredSelectedCalendarIds(event.id, defaultIds);
  }

  async function authorizeGoogleCalendar(interactive: boolean, quiet = false) {
    if (!GOOGLE_CLIENT_ID) {
      setGoogleConnectionState('unavailable');
      setGoogleErrorMessage('Google Calendar import is unavailable right now.');
      return null;
    }

    setGoogleConnectionState('connecting');

    if (!quiet) {
      setGoogleErrorMessage(null);
      setGoogleStatusMessage(null);
    }

    try {
      const accessToken = await requestGoogleAccessToken(GOOGLE_CLIENT_ID, interactive ? 'consent' : '');
      const calendars = await fetchGoogleCalendars(accessToken);

      setGoogleAccessToken(accessToken);
      applyLoadedGoogleCalendars(calendars);
      setGoogleReconnectHint(true);
      setGoogleConnectionState('connected');

      if (!quiet) {
        setGoogleStatusMessage('Google Calendar connected. Choose calendars, then import when you are ready.');
      }

      return accessToken;
    } catch (error) {
      setGoogleAccessToken(null);
      setGoogleConnectionState('ready');

      if (!quiet && interactive) {
        setGoogleErrorMessage(error instanceof Error ? error.message : 'Google Calendar connection failed.');
      }

      return null;
    }
  }

  async function ensureGoogleAccessToken() {
    if (googleAccessToken) {
      return googleAccessToken;
    }

    const silentAccessToken = getGoogleReconnectHint() ? await authorizeGoogleCalendar(false, true) : null;

    if (silentAccessToken) {
      return silentAccessToken;
    }

    return await authorizeGoogleCalendar(true, true);
  }

  function toggleGoogleCalendar(calendarId: string) {
    setSelectedGoogleCalendarIds((current) => {
      const next = new Set(current);

      if (next.has(calendarId)) {
        next.delete(calendarId);
      } else {
        next.add(calendarId);
      }

      setStoredSelectedCalendarIds(event.id, [...next]);
      return next;
    });
  }

  async function handleGoogleImport() {
    if (!requireNameBeforeGoogleImport()) {
      return;
    }

    if (selectedGoogleCalendarIds.size === 0) {
      setGoogleErrorMessage('Choose at least one Google calendar to import.');
      setGoogleStatusMessage(null);
      return;
    }

    setIsImportingGoogle(true);
    setGoogleErrorMessage(null);
    setGoogleStatusMessage(null);

    try {
      let accessToken = await ensureGoogleAccessToken();

      if (!accessToken) {
        throw new Error('Google Calendar connection failed.');
      }

      let busyIntervals: Awaited<ReturnType<typeof fetchGoogleBusyIntervals>>;

      try {
        busyIntervals = await fetchGoogleBusyIntervals(accessToken, [...selectedGoogleCalendarIds], event);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'Google Calendar connection expired.') {
          throw error;
        }

        setGoogleAccessToken(null);
        accessToken = await authorizeGoogleCalendar(true, true);

        if (!accessToken) {
          throw new Error('Google Calendar connection failed.');
        }

        busyIntervals = await fetchGoogleBusyIntervals(accessToken, [...selectedGoogleCalendarIds], event);
      }

      const selectedCalendars = googleCalendars.filter((calendar) => selectedGoogleCalendarIds.has(calendar.id));
      let busyDetails: GoogleCalendarBusyDetail[] = [];
      let detailImportNotice: string | null = null;

      try {
        busyDetails = await fetchGoogleBusyDetails(accessToken, selectedCalendars, event);
      } catch (error) {
        detailImportNotice = error instanceof Error ? error.message : 'Google Calendar event details could not be loaded.';
      }

      const importProjection = buildGoogleCalendarImportProjection(event, busyIntervals, busyDetails, selectedCalendars);

      if (isDevelopment) {
        const debugByDate = Object.fromEntries(
          event.dates.map((date) => [
            date,
            {
              blockedSlots: [...importProjection.busySlotKeys].filter((slotKey) => slotKey.startsWith(`${date}T`)),
              detailTitles: Object.entries(importProjection.busyDetailsBySlot)
                .filter(([slotKey]) => slotKey.startsWith(`${date}T`))
                .flatMap(([, details]) => details.map((detail) => `${detail.title} (${detail.start} -> ${detail.end})`)),
            },
          ]),
        );
        const debugSummary = {
          selectedCalendars: selectedCalendars.map((calendar) => ({
            id: calendar.id,
            summary: calendar.summary,
            accessRole: calendar.accessRole,
          })),
          blockingIntervalCount: importProjection.blockingIntervals.length,
          busyDetailCount: busyDetails.length,
          byDate: debugByDate,
        };

        console.info('[Google Calendar import]', {
          eventId: event.id,
          ...debugSummary,
        });
      }

      setImportedBusySlots(importProjection.busySlotKeys);
      setImportedBusyDetailsBySlot(importProjection.busyDetailsBySlot);
      setActiveGoogleBusySlotKey(null);
      setHoveredGoogleBusySlotKey(null);
      setGoogleBusyTooltip(null);
      setSelectedSlots(new Set(importProjection.freeSlotKeys));
      setHasUnsavedManualChanges(true);
      onOpenManualEntry();
      setLastImportedAt(new Date().toISOString());
      setErrorMessage(null);
      setStatusMessage(null);
      setGoogleStatusMessage(
        importProjection.busySlotKeys.size > 0
          ? detailImportNotice
            ? `Availability imported from Google. Busy markers stay visible while you adjust anything manually. ${detailImportNotice}`
            : 'Availability imported from Google. Busy markers stay visible while you adjust anything manually.'
          : 'Availability imported from Google. No busy events were found inside this event window.',
      );
    } catch (error) {
      setGoogleErrorMessage(error instanceof Error ? error.message : 'Google Calendar import failed.');
    } finally {
      setIsImportingGoogle(false);
    }
  }

  function handlePointerDown(slotKey: string, eventPointer: ReactPointerEvent<HTMLButtonElement>, mobileDateIndex?: number) {
    if (!participantName) {
      onRequestName();
      return;
    }

    if (typeof mobileDateIndex === 'number') {
      setActiveMobileDateIndex(mobileDateIndex);
    }

    eventPointer.preventDefault();
    const hasBusyDetails = (importedBusyDetailsBySlot[slotKey]?.length ?? 0) > 0;
    const pointerDownBehavior = getSlotPointerDownBehavior(eventPointer.pointerType, hasBusyDetails);

    if (pointerDownBehavior.shouldActivateBusySlotPreview) {
      setActiveGoogleBusySlotKey(slotKey);
      setHoveredGoogleBusySlotKey(null);
      setGoogleBusyTooltip(null);
    }

    if (!pointerDownBehavior.shouldBeginPaint) {
      setErrorMessage(null);
      setStatusMessage(null);
      return;
    }

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
      onRequestName();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await onSubmit(sortAvailability(selectedSlots));
    setIsSubmitting(false);

    if (result.ok) {
      setHasUnsavedManualChanges(false);
      setStatusMessage('Availability saved.');
      return;
    }

    setErrorMessage(result.error ?? 'We could not save your availability.');
  }

  function handlePrimaryAction() {
    if (isManualEntryOpen) {
      void handleSubmit();
      return;
    }

    if (!participantName) {
      onRequestName();
      return;
    }

    onOpenManualEntry();
  }

  function showHeatmapTooltip(
    summary: SlotSummary,
    target: HTMLElement,
  ) {
    if (!heatmapTooltipHostRef.current) {
      return;
    }

    const hostRect = heatmapTooltipHostRef.current.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const estimatedTooltipWidth = 240;
    const minLeft = estimatedTooltipWidth / 2 + 12;
    const maxLeft = Math.max(minLeft, hostRect.width - estimatedTooltipWidth / 2 - 12);
    const unclampedLeft = targetRect.left + targetRect.width / 2 - hostRect.left;
    const left = Math.min(Math.max(unclampedLeft, minLeft), maxLeft);
    const top = Math.max(targetRect.top - hostRect.top - 12, 16);

    setHoveredHeatmapSlotKey(summary.slotKey);
    setHeatmapTooltip({
      slotKey: summary.slotKey,
      date: summary.date,
      time: summary.time,
      left,
      top,
    });
  }

  function hideHeatmapTooltip(slotKey: string) {
    setHoveredHeatmapSlotKey((current) => (current === slotKey ? null : current));
    setHeatmapTooltip((current) => (current?.slotKey === slotKey ? null : current));
  }

  function handleGoogleBusyMouseEnter(
    slotKey: string,
    date: string,
    time: string,
    busyDetails: GoogleCalendarBusyDetail[],
    eventMouse: ReactMouseEvent<HTMLButtonElement>,
  ) {
    if (busyDetails.length === 0 || isDragging) {
      hideGoogleBusyTooltip(slotKey);
      return;
    }

    setActiveGoogleBusySlotKey(slotKey);
    showGoogleBusyTooltip(slotKey, date, time, eventMouse.currentTarget);
  }

  function handleGoogleBusyFocus(
    slotKey: string,
    date: string,
    time: string,
    busyDetails: GoogleCalendarBusyDetail[],
    eventFocus: ReactFocusEvent<HTMLButtonElement>,
  ) {
    if (busyDetails.length === 0) {
      hideGoogleBusyTooltip(slotKey);
      return;
    }

    setActiveGoogleBusySlotKey(slotKey);
    showGoogleBusyTooltip(slotKey, date, time, eventFocus.currentTarget);
  }

  function changeActiveMobileDate(direction: 'previous' | 'next') {
    setActiveMobileDateIndex((current) => {
      const {startIndex, endIndex} = getMobileDatePageRange(current, mobileVisibleDayCount, event.dates.length);

      if (direction === 'previous') {
        return Math.max(0, startIndex - mobileVisibleDayCount);
      }

      if (endIndex >= event.dates.length) {
        return current;
      }

      return Math.min(event.dates.length - 1, startIndex + mobileVisibleDayCount);
    });
  }

  return (
    <section>
      <div className="panel-border rounded-[24px] bg-white p-5 pb-6 shadow-soft sm:rounded-[28px] sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                {isManualEntryOpen ? <PencilLine className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <h2 className="font-headline text-xl font-bold tracking-tight text-ink">
                  {isManualEntryOpen ? 'Your availability' : 'Group availability'}
                </h2>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  {isManualEntryOpen
                    ? 'Tap or drag across the grid to choose the times that work for you.'
                    : 'Darker slots mean more people are available. Tap a slot to see who can make it.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
              {isManualEntryOpen ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-primary" />
                    Selected
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-surface-strong" />
                    Unselected
                  </div>
                  {hasImportedGoogleBusyHints ? (
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm border border-danger/25 bg-danger/10" />
                      Google busy
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft">
                  <span>Low</span>
                  <span className="h-3 w-3 rounded-sm bg-[#ebe4ff]" />
                  <span className="h-3 w-3 rounded-sm bg-[#d7cafb]" />
                  <span className="h-3 w-3 rounded-sm bg-[#a38be4]" />
                  <span className="h-3 w-3 rounded-sm bg-primary" />
                  <span>All available</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-primary" />
                {event.timezone}
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[300px] lg:items-end">
            {participantName ? (
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface-soft px-3.5 py-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:border-primary/20 hover:text-primary sm:w-auto lg:max-w-[300px]"
                onClick={onRequestName}
                type="button"
              >
                <UserRound className="h-4 w-4" />
                <span className="truncate">{participantName}</span>
              </button>
            ) : null}
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:justify-end">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:border-primary/20 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={googleConnectionState === 'connecting' || isImportingGoogle || isGoogleUnavailable}
                onClick={() => void authorizeGoogleCalendar(true)}
                type="button"
              >
                {googleConnectionState === 'connecting' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                {googleConnectionState === 'connecting'
                  ? 'Connecting...'
                  : isGoogleConnected
                    ? 'Reconnect Google'
                    : isGoogleUnavailable
                      ? 'Google unavailable'
                      : 'Connect Google Calendar'}
              </button>
              {!isManualEntryOpen ? (
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#5c439d]"
                  onClick={handlePrimaryAction}
                  type="button"
                >
                  <PencilLine className="h-4 w-4" />
                  {responseId ? 'Edit availability' : 'Manual input'}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {isGoogleConnected && googleCalendars.length > 0 ? (
          <div className="mt-6 border-t border-line pt-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Calendars to include</p>
                {googleImportState.lastImportedAt ? (
                  <p className="mt-1 text-xs text-ink-soft">Last imported {formatGoogleImportTimestamp(googleImportState.lastImportedAt)}</p>
                ) : (
                  <p className="mt-1 text-xs text-ink-soft">Choose calendars, then import your free slots.</p>
                )}
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#5c439d] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={selectedGoogleCalendarIds.size === 0 || isImportingGoogle}
                onClick={() => void handleGoogleImport()}
                type="button"
              >
                {isImportingGoogle ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isImportingGoogle ? 'Importing...' : 'Import from Google'}
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {googleCalendars.map((calendar) => {
                const isSelected = selectedGoogleCalendarIds.has(calendar.id);

                return (
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors duration-150',
                      isSelected ? 'border-primary/25 bg-surface-soft' : 'border-line bg-white hover:border-primary/20',
                    )}
                    key={calendar.id}
                  >
                    <input
                      checked={isSelected}
                      className="mt-1 h-4 w-4 rounded border-line text-primary focus:ring-primary/20"
                      onChange={() => toggleGoogleCalendar(calendar.id)}
                      type="checkbox"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {calendar.summary}
                        {calendar.primary ? ' (Primary)' : ''}
                      </p>
                      {calendar.accessRole === 'freeBusyReader' ? (
                        <p className="mt-1 text-xs leading-5 text-ink-soft">Busy-only access</p>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        {googleStatusMessage ? <p className="mt-4 text-sm text-success">{googleStatusMessage}</p> : null}
        {googleErrorMessage ? <p className="mt-4 text-sm text-danger">{googleErrorMessage}</p> : null}

        <div className="mt-7 sm:mt-8">
      {isManualEntryOpen ? (
        <>
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 z-[120]" ref={googleBusyTooltipHostRef}>
              {googleBusyTooltip && tooltipGoogleBusyDetails.length > 0 ? (
                <div
                  className="absolute hidden w-72 -translate-x-1/2 -translate-y-full rounded-2xl bg-slate-950 px-4 py-3 text-left text-white shadow-2xl sm:block"
                  style={{
                    left: `${googleBusyTooltip.left}px`,
                    top: `${googleBusyTooltip.top}px`,
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                    {formatDateLabel(googleBusyTooltip.date)} at {formatTimeLabel(googleBusyTooltip.time)}
                  </p>
                  <div className="mt-2 space-y-2">
                    {tooltipGoogleBusyDetails.slice(0, 3).map((detail) => (
                      <div key={`${detail.id}:${detail.start}:${detail.end}`}>
                        <p className="truncate text-sm font-semibold">{detail.title}</p>
                        <p className="text-xs text-white/70">
                          {formatBusyDetailRange(detail)}
                          {' · '}
                          {detail.calendarSummary}
                        </p>
                      </div>
                    ))}
                    {tooltipGoogleBusyDetails.length > 3 ? (
                      <p className="text-xs text-white/70">+{tooltipGoogleBusyDetails.length - 3} more blocking events</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

          <div
            className={cn(
              'transition-opacity duration-150',
              participantName ? '' : 'pointer-events-none opacity-45',
            )}
          >
            <div className="relative isolate overflow-visible rounded-[20px] sm:rounded-[28px]">
              <div className="sm:hidden">
                <div className="rounded-[20px] border border-line bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <button
                      aria-label="Show previous days"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-soft text-ink transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!hasPreviousMobilePage}
                      onClick={() => changeActiveMobileDate('previous')}
                      type="button"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <div className="min-w-0 text-center">
                      <p className="text-sm font-semibold text-ink">{mobileVisibleRangeLabel}</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        Days {Math.min(mobilePageRange.startIndex + 1, event.dates.length)}-{mobilePageRange.endIndex} of {event.dates.length}
                      </p>
                    </div>

                    <button
                      aria-label="Show next days"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-soft text-ink transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!hasNextMobilePage}
                      onClick={() => changeActiveMobileDate('next')}
                      type="button"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div
                    className="grid grid-cols-[52px_repeat(var(--day-count),minmax(0,1fr))] gap-x-1.5 gap-y-2 pt-2"
                    onPointerMove={handlePointerMove}
                    style={{'--day-count': mobileVisibleDateCount} as CSSProperties}
                  >
                    <div aria-hidden="true" />
                    {mobileVisibleDates.map((date, dateOffset) => {
                      const label = formatDateHeader(date);
                      const dateIndex = mobilePageRange.startIndex + dateOffset;
                      const isActiveDate = activeMobileDateIndex === dateIndex;

                      return (
                        <button
                          aria-label={`Focus ${formatDateLabel(date)}`}
                          aria-pressed={isActiveDate}
                          className={cn(
                            'flex h-12 flex-col items-center justify-center rounded-xl border px-1 text-center transition-colors duration-150',
                            isActiveDate ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink hover:border-primary/20',
                          )}
                          key={`mobile-date-${date}`}
                          onClick={() => setActiveMobileDateIndex(dateIndex)}
                          type="button"
                        >
                          <span className={cn('text-[10px] font-semibold uppercase tracking-[0.16em]', isActiveDate ? 'text-white/80' : 'text-ink-soft')}>
                            {label.weekday}
                          </span>
                          <span className="mt-1 font-headline text-base font-bold leading-none">{label.day}</span>
                        </button>
                      );
                    })}

                    {timeRows.map((time) => {
                      return (
                        <Fragment key={`mobile-row-${time}`}>
                          <div className="flex h-11 items-center justify-end pr-1 text-[10px] font-medium text-ink-soft">
                            {formatTimeLabel(time).replace(':00', '')}
                          </div>

                          {mobileVisibleDates.map((date, dateOffset) => {
                            const slotKey = `${date}T${time}`;
                            const dateIndex = mobilePageRange.startIndex + dateOffset;
                            const isSelected = selectedSlots.has(slotKey);
                            const isImportedBusy = importedBusySlots.has(slotKey);
                            const busyDetails = importedBusyDetailsBySlot[slotKey] ?? [];
                            const isActiveGoogleBusySlot = activeGoogleBusySlotKey === slotKey && busyDetails.length > 0;

                            return (
                              <button
                                aria-pressed={isSelected}
                                className={cn(
                                  'relative h-11 w-full touch-none rounded-[16px] border transition-all duration-100',
                                  isSelected ? 'border-white bg-primary text-white' : 'border-white bg-surface-soft',
                                  isImportedBusy && !isSelected ? 'border-danger/20 bg-danger/5' : '',
                                  isImportedBusy && isSelected ? 'border-primary shadow-[inset_0_0_0_2px_rgba(252,165,165,0.55)]' : '',
                                  isActiveGoogleBusySlot ? 'ring-2 ring-slate-900/15' : '',
                                )}
                                data-slot-key={slotKey}
                                key={slotKey}
                                onPointerDown={(eventPointer) => handlePointerDown(slotKey, eventPointer, dateIndex)}
                                onPointerMove={handlePointerMove}
                                onPointerUp={(eventPointer) => finishDrag(eventPointer.pointerId, eventPointer.currentTarget)}
                                onPointerCancel={(eventPointer) => finishDrag(eventPointer.pointerId, eventPointer.currentTarget)}
                                style={
                                  isImportedBusy && !isSelected
                                    ? ({
                                        backgroundImage:
                                          'linear-gradient(135deg, rgba(220, 38, 38, 0.08) 0, rgba(220, 38, 38, 0.08) 6px, rgba(255, 255, 255, 0) 6px, rgba(255, 255, 255, 0) 12px)',
                                      } as CSSProperties)
                                    : undefined
                                }
                                title={isImportedBusy && busyDetails.length === 0 ? 'Google Calendar marked this slot busy. You can still override it manually.' : undefined}
                                type="button"
                              />
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="hidden sm:block">
                <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[104px_minmax(0,1fr)] sm:gap-x-4">
                  <div className="relative z-[2] bg-white">
                    <div className="flex flex-col gap-2 pt-[72px] sm:pt-16">
                      {timeRows.map((time) => (
                        <div
                          className="flex h-11 items-center justify-end pr-3 text-[11px] font-medium text-ink-soft sm:h-12 sm:pr-4 sm:text-xs"
                          key={`desktop-time-${time}`}
                        >
                          {formatTimeLabel(time)}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="relative min-w-0">
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-6 bg-gradient-to-r from-white via-white/92 to-transparent sm:w-7" />
                    <div className="grid-scroll overflow-x-auto pb-5 pt-2 sm:pb-2 sm:pt-0">
                      <div className="slot-grid relative z-0 pr-6 sm:pr-4" onPointerMove={handlePointerMove} style={{minWidth: `${gridMinWidth}px`}}>
                        <div
                          className="grid grid-cols-[repeat(var(--date-count),minmax(88px,1fr))] gap-2 sm:grid-cols-[repeat(var(--date-count),minmax(110px,1fr))] sm:gap-2"
                          style={{'--date-count': event.dates.length} as CSSProperties}
                        >
                          {event.dates.map((date) => {
                            const label = formatDateHeader(date);

                            return (
                              <div className="pointer-events-none flex h-16 flex-col items-center justify-center gap-1 text-center sm:h-14" key={date}>
                                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">{label.weekday}</span>
                                <span className="font-headline text-lg font-bold tracking-tight text-ink sm:text-xl">{label.day}</span>
                              </div>
                            );
                          })}

                          {timeRows.map((time) => (
                            <Fragment key={`desktop-row-${time}`}>
                              {event.dates.map((date) => {
                                const slotKey = `${date}T${time}`;
                                const isSelected = selectedSlots.has(slotKey);
                                const isImportedBusy = importedBusySlots.has(slotKey);
                                const busyDetails = importedBusyDetailsBySlot[slotKey] ?? [];
                                const isActiveGoogleBusySlot = activeGoogleBusySlotKey === slotKey && busyDetails.length > 0;

                                return (
                                  <button
                                    className={cn(
                                      'relative h-11 touch-none rounded-[18px] border transition-all duration-100 sm:h-12 sm:rounded-2xl',
                                      isSelected ? 'border-white bg-primary text-white' : 'border-white bg-surface-soft hover:bg-primary/8',
                                      isImportedBusy && !isSelected ? 'border-danger/20 bg-danger/5 hover:border-danger/30 hover:bg-danger/10' : '',
                                      isImportedBusy && isSelected ? 'border-primary shadow-[inset_0_0_0_2px_rgba(252,165,165,0.55)]' : '',
                                      isActiveGoogleBusySlot ? 'z-20 ring-2 ring-slate-900/15' : '',
                                      hoveredGoogleBusySlotKey === slotKey ? 'z-30' : '',
                                    )}
                                    aria-pressed={isSelected}
                                    data-slot-key={slotKey}
                                    key={slotKey}
                                    onFocus={(eventFocus) => handleGoogleBusyFocus(slotKey, date, time, busyDetails, eventFocus)}
                                    onBlur={() => hideGoogleBusyTooltip(slotKey)}
                                    onMouseEnter={(eventMouse) => handleGoogleBusyMouseEnter(slotKey, date, time, busyDetails, eventMouse)}
                                    onMouseLeave={() => hideGoogleBusyTooltip(slotKey)}
                                    onPointerDown={(eventPointer) => handlePointerDown(slotKey, eventPointer)}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={(eventPointer) => finishDrag(eventPointer.pointerId, eventPointer.currentTarget)}
                                    onPointerCancel={(eventPointer) => finishDrag(eventPointer.pointerId, eventPointer.currentTarget)}
                                    style={isImportedBusy && !isSelected ? ({backgroundImage: 'linear-gradient(135deg, rgba(220, 38, 38, 0.08) 0, rgba(220, 38, 38, 0.08) 6px, rgba(255, 255, 255, 0) 6px, rgba(255, 255, 255, 0) 12px)'} as CSSProperties) : undefined}
                                    title={isImportedBusy && busyDetails.length === 0 ? 'Google Calendar marked this slot busy. You can still override it manually.' : undefined}
                                    type="button"
                                  />
                                );
                              })}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {hasImportedGoogleBusyHints && activeMobileDate && mobileInspectorDetails.length > 0 ? (
            <div className="mt-4 rounded-xl border border-line bg-surface-soft px-4 py-3 sm:hidden">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {activeMobileSlotKey ? 'Google Calendar at this slot' : `Google Calendar on ${formatDateLabel(activeMobileDate)}`}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  {activeMobileSlotKey
                    ? `${formatDateLabel(activeMobileSlotKey.slice(0, 10))} at ${formatTimeLabel(activeMobileSlotKey.slice(11))}`
                    : 'Imported conflicts for the day you are viewing.'}
                </p>
                <div className="mt-3 space-y-2">
                  {mobileInspectorDetails.slice(0, 4).map((detail) => (
                    <div className="rounded-lg border border-line bg-white px-3 py-2.5" key={`${detail.id}:${detail.start}:${detail.end}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{detail.title}</p>
                          <p className="mt-1 text-xs text-ink-soft">{formatBusyDetailRange(detail)}</p>
                        </div>
                        <span className="shrink-0 text-xs text-ink-soft">{detail.calendarSummary}</span>
                      </div>
                    </div>
                  ))}
                  {mobileInspectorDetails.length > 4 ? (
                    <p className="text-xs text-ink-soft">+{mobileInspectorDetails.length - 4} more Google events</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {hasImportedGoogleBusyHints && activeGoogleBusySlotKey && activeGoogleBusyDetails.length > 0 ? (
            <div className="mt-4 rounded-xl border border-line bg-surface-soft px-4 py-3">
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-ink">Google Calendar at this slot</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {formatDateLabel(activeGoogleBusySlotKey.slice(0, 10))} at {formatTimeLabel(activeGoogleBusySlotKey.slice(11))}
                </p>
                <div className="mt-3 space-y-2">
                  {activeGoogleBusyDetails.slice(0, 4).map((detail) => (
                    <div className="rounded-lg border border-line bg-white px-3 py-2.5" key={`${detail.id}:${detail.start}:${detail.end}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{detail.title}</p>
                          <p className="mt-1 text-xs text-ink-soft">{formatBusyDetailRange(detail)}</p>
                        </div>
                        <span className="shrink-0 text-xs text-ink-soft">{detail.calendarSummary}</span>
                      </div>
                    </div>
                  ))}
                  {activeGoogleBusyDetails.length > 4 ? (
                    <p className="text-xs text-ink-soft">+{activeGoogleBusyDetails.length - 4} more Google events in this slot</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-line bg-surface-soft p-3 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {selectedSlots.size} {selectedSlots.size === 1 ? 'slot' : 'slots'} selected
              </p>
              <p className="mt-1 text-sm text-ink-soft">Save when your times are ready.</p>
            </div>
            <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:mt-0 sm:flex sm:shrink-0 sm:items-center">
              <button
                className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-white hover:text-ink sm:hover:bg-surface-strong"
                onClick={() => {
                  setSelectedSlots(new Set());
                  setHasUnsavedManualChanges(true);
                }}
                type="button"
              >
                Clear all
              </button>
              <button
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#5c439d] disabled:cursor-not-allowed disabled:opacity-60',
                  hasUnsavedManualChanges
                    ? 'motion-safe:animate-pulse motion-reduce:ring-2 motion-reduce:ring-primary/30'
                    : '',
                )}
                disabled={isSubmitting}
                onClick={handlePrimaryAction}
                type="button"
              >
                {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isSubmitting ? 'Saving availability...' : 'Save availability'}
              </button>
            </div>
          </div>

          {!participantName ? (
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <button
                className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-all duration-150 hover:border-primary/30 hover:text-primary"
                onClick={onRequestName}
                type="button"
              >
                Enter your name to choose times
              </button>
            </div>
          ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 z-[120]" ref={heatmapTooltipHostRef}>
              {heatmapTooltip && tooltipSummary ? (
                <div
                  className="absolute hidden w-60 -translate-x-1/2 -translate-y-full rounded-2xl bg-slate-950 px-4 py-3 text-left text-white shadow-2xl sm:block"
                  style={{
                    left: `${heatmapTooltip.left}px`,
                    top: `${heatmapTooltip.top}px`,
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                    {formatDateLabel(heatmapTooltip.date)} at {formatTimeLabel(heatmapTooltip.time)}
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {tooltipSummary.count} of {Math.max(totalParticipants, 1)} available
                  </p>
                  <p className="mt-2 text-sm text-white/75">
                    {tooltipSummary.participantNames.length > 0
                      ? tooltipSummary.participantNames.join(', ')
                      : 'Nobody has marked this slot yet.'}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid-scroll overflow-x-auto pb-1">
              <div className="pr-3 sm:pr-7" style={{minWidth: `${heatmapGridMinWidth}px`}}>
                <div
                  className="grid grid-cols-[72px_repeat(var(--date-count),minmax(92px,1fr))] gap-1.5 sm:grid-cols-[84px_repeat(var(--date-count),minmax(110px,1fr))] sm:gap-2"
                  style={{'--date-count': event.dates.length} as CSSProperties}
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
                    <div className="contents" key={`heatmap-row-${time}`}>
                      <div className="sticky-time-cell flex h-11 items-center justify-end pr-2 text-[11px] font-medium text-ink-soft sm:h-12 sm:pr-4 sm:text-xs">
                        {formatTimeLabel(time)}
                      </div>
                      {event.dates.map((date) => {
                        const slotKey = `${date}T${time}`;
                        const summary = summaryMap.get(slotKey);

                        if (!summary) {
                          return <div className="h-11 rounded-[18px] border border-white bg-surface-soft sm:h-12 sm:rounded-2xl" key={slotKey} />;
                        }

                        const isHovered = hoveredHeatmapSlotKey === slotKey;
                        const isSelected = selectedHeatmapSlotKey === slotKey;

                        return (
                          <button
                            className={cn(
                              'relative flex h-11 items-center justify-center rounded-[18px] border border-white text-xs font-semibold text-white transition-colors duration-150 sm:h-12 sm:rounded-2xl',
                              isHovered || isSelected ? 'z-30' : 'z-[1]',
                            )}
                            key={slotKey}
                            onBlur={() => hideHeatmapTooltip(slotKey)}
                            onClick={() => setSelectedHeatmapSlotKey(slotKey)}
                            onFocus={(eventFocus: ReactFocusEvent<HTMLButtonElement>) => showHeatmapTooltip(summary, eventFocus.currentTarget)}
                            onMouseEnter={(eventMouse: ReactMouseEvent<HTMLButtonElement>) => showHeatmapTooltip(summary, eventMouse.currentTarget)}
                            onMouseLeave={() => hideHeatmapTooltip(slotKey)}
                            style={{
                              backgroundColor: getHeatmapColor(summary.count, totalParticipants),
                              boxShadow: isSelected ? 'inset 0 0 0 2px rgba(255,255,255,0.65)' : undefined,
                            }}
                            type="button"
                          >
                            {summary.ratio === 1 && totalParticipants > 0 ? <Sparkles className="h-4 w-4" /> : summary.count || ''}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-surface-soft px-4 py-3">
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
        </>
      )}

          {statusMessage ? <p className="mt-4 text-sm text-success">{statusMessage}</p> : null}
          {errorMessage ? <p className="mt-4 text-sm text-danger">{errorMessage}</p> : null}

        </div>
      </div>
    </section>
  );
}
