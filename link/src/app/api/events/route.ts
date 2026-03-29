import {NextRequest, NextResponse} from 'next/server';

import {prisma} from '@/lib/prisma';
import type {ApiErrorResponse, ApiFieldErrors, CreateEventRequest, CreateEventResponse} from '@/lib/types';
import {isValidTimeValue, isValidTimezone, normalizeDateValues, timeToMinutes} from '@/lib/utils';

type IncomingCreateEventRequest = Omit<CreateEventRequest, 'location'> & {
  location?: CreateEventRequest['location'] | string;
};

function errorResponse(error: string, fieldErrors?: ApiFieldErrors, status = 400) {
  return NextResponse.json<ApiErrorResponse>({error, fieldErrors}, {status});
}

function isStructuredLocation(value: unknown): value is CreateEventRequest['location'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const location = value as {
    label?: unknown;
    address?: unknown;
    latitude?: unknown;
    longitude?: unknown;
  };

  return (
    typeof location.label === 'string' &&
    location.label.trim().length > 0 &&
    typeof location.address === 'string' &&
    location.address.trim().length > 0 &&
    typeof location.latitude === 'number' &&
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    typeof location.longitude === 'number' &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

export async function POST(request: NextRequest) {
  let body: IncomingCreateEventRequest;

  try {
    body = (await request.json()) as IncomingCreateEventRequest;
  } catch {
    return errorResponse('Invalid request body.');
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() || null : null;
  const timezone =
    typeof body.timezone === 'string' && body.timezone.trim().length > 0 ? body.timezone.trim() : 'America/New_York';
  const dates = Array.isArray(body.dates) ? normalizeDateValues(body.dates) : [];
  const fieldErrors: ApiFieldErrors = {};
  let location: string | null = null;
  let locationAddress: string | null = null;
  let locationLatitude: number | null = null;
  let locationLongitude: number | null = null;

  if (typeof body.location === 'string') {
    location = body.location.trim() || null;
  } else if (body.location == null) {
    location = null;
  } else if (isStructuredLocation(body.location)) {
    location = body.location.label.trim();
    locationAddress = body.location.address.trim();
    locationLatitude = body.location.latitude;
    locationLongitude = body.location.longitude;
  } else {
    fieldErrors.location = 'Choose a specific location from the search results or clear the field.';
  }

  if (!title) {
    fieldErrors.title = 'Give your link a title.';
  }

  if (dates.length === 0) {
    fieldErrors.dates = 'Pick at least one date.';
  } else if (dates.length > 14) {
    fieldErrors.dates = 'Choose up to 14 dates for this link.';
  }

  if (!isValidTimeValue(body.timeRangeStart)) {
    fieldErrors.timeRangeStart = 'Choose a valid start time.';
  }

  if (!isValidTimeValue(body.timeRangeEnd)) {
    fieldErrors.timeRangeEnd = 'Choose a valid end time.';
  }

  if (isValidTimeValue(body.timeRangeStart) && isValidTimeValue(body.timeRangeEnd)) {
    if (timeToMinutes(body.timeRangeStart) >= timeToMinutes(body.timeRangeEnd)) {
      fieldErrors.timeRangeEnd = 'End time needs to be later than the start time.';
    }
  }

  if (!isValidTimezone(timezone)) {
    fieldErrors.timezone = 'Choose a valid timezone.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return errorResponse('Please correct the highlighted fields.', fieldErrors);
  }

  const event = await prisma.event.create({
    data: {
      title,
      description,
      dates: JSON.stringify(dates),
      timeRangeStart: body.timeRangeStart,
      timeRangeEnd: body.timeRangeEnd,
      timezone,
      location,
      locationAddress,
      locationLatitude,
      locationLongitude,
    },
  });

  return NextResponse.json<CreateEventResponse>(
    {
      id: event.id,
      shareUrl: `/event/${event.id}`,
    },
    {status: 201},
  );
}
