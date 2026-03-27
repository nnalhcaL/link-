export interface CalendarDay {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isPast: boolean;
}

export interface CalendarMonth {
  label: string;
  month: number;
  year: number;
  weeks: Array<Array<CalendarDay | null>>;
}

export interface ApiFieldErrors {
  title?: string;
  dates?: string;
  timeRangeStart?: string;
  timeRangeEnd?: string;
  timezone?: string;
  participantName?: string;
  availability?: string;
  general?: string;
}

export interface ApiErrorResponse {
  error: string;
  fieldErrors?: ApiFieldErrors;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  dates: string[];
  timeRangeStart: string;
  timeRangeEnd: string;
  timezone: string;
  location?: string;
}

export interface CreateEventResponse {
  id: string;
  shareUrl: string;
}

export interface SubmitAvailabilityRequest {
  eventId: string;
  participantName: string;
  availability: string[];
}

export interface SubmitAvailabilityResponse {
  id: string;
  participantName: string;
}

export interface EventResponseRecord {
  id: string;
  participantName: string;
  eventId: string;
  availability: string[];
  createdAt: string;
}

export interface EventRecord {
  id: string;
  title: string;
  description: string | null;
  dates: string[];
  timeRangeStart: string;
  timeRangeEnd: string;
  timezone: string;
  location: string | null;
  createdAt: string;
  responses: EventResponseRecord[];
}

export interface SlotSummary {
  slotKey: string;
  date: string;
  time: string;
  count: number;
  ratio: number;
  participantNames: string[];
}

