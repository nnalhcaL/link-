import {NextRequest, NextResponse} from 'next/server';

import {prisma} from '@/lib/prisma';
import type {ApiErrorResponse, ApiFieldErrors, CreateEventRequest, CreateEventResponse} from '@/lib/types';
import {isValidTimeValue, isValidTimezone, normalizeDateValues, timeToMinutes} from '@/lib/utils';

function errorResponse(error: string, fieldErrors?: ApiFieldErrors, status = 400) {
  return NextResponse.json<ApiErrorResponse>({error, fieldErrors}, {status});
}

export async function POST(request: NextRequest) {
  let body: CreateEventRequest;

  try {
    body = (await request.json()) as CreateEventRequest;
  } catch {
    return errorResponse('Invalid request body.');
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() || null : null;
  const location = typeof body.location === 'string' ? body.location.trim() || null : null;
  const timezone =
    typeof body.timezone === 'string' && body.timezone.trim().length > 0 ? body.timezone.trim() : 'America/New_York';
  const dates = Array.isArray(body.dates) ? normalizeDateValues(body.dates) : [];
  const fieldErrors: ApiFieldErrors = {};

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

