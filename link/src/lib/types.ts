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
  location?: string;
  participantName?: string;
  availability?: string;
  general?: string;
}

export interface ApiErrorResponse {
  error: string;
  fieldErrors?: ApiFieldErrors;
}

export interface EventLocationInput {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  dates: string[];
  timeRangeStart: string;
  timeRangeEnd: string;
  timezone: string;
  location?: EventLocationInput;
}

export interface CreateEventResponse {
  id: string;
  shareUrl: string;
}

export interface LocationSearchRequest {
  query: string;
}

export interface LocationSearchCandidate extends EventLocationInput {}

export interface LocationSearchResponse {
  candidates: LocationSearchCandidate[];
}

export interface SubmitAvailabilityRequest {
  eventId: string;
  participantName: string;
  availability: string[];
  responseId?: string;
}

export interface SubmitAvailabilityResponse {
  id: string;
  participantName: string;
}

export type GoogleCalendarConnectionState = 'unavailable' | 'ready' | 'connecting' | 'connected';

export interface GoogleCalendarRecord {
  id: string;
  summary: string;
  description: string | null;
  primary: boolean;
  selected: boolean;
  accessRole: string;
}

export interface GoogleCalendarBusyDetail {
  id: string;
  slotKey: string;
  calendarId: string;
  calendarSummary: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  detailsAvailable: boolean;
}

export interface GoogleCalendarImportState {
  connectionState: GoogleCalendarConnectionState;
  selectedCalendarIds: string[];
  importedBusySlotKeys: string[];
  lastImportedAt: string | null;
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
  locationAddress: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
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

export interface AvailabilityWindowSummary {
  windowKey: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  count: number;
  participantNames: string[];
  isFullGroup: boolean;
}

export interface SlotWeatherForecast {
  slotKey: string;
  weatherCode: number | null;
  temperatureC: number | null;
  precipitationProbability: number | null;
}

export interface EventWeatherResponse {
  available: boolean;
  locationLabel: string | null;
  forecasts: SlotWeatherForecast[];
  source: 'open-meteo';
}
