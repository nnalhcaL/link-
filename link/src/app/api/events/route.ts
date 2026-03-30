import {randomUUID} from 'crypto';
import {NextRequest, NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';

import {createEventHostSecret, hashEventHostSecret, setEventHostCookie} from '@/lib/host-access';
import {prisma} from '@/lib/prisma';
import type {ApiErrorResponse, ApiFieldErrors, CreateEventRequest, CreateEventResponse} from '@/lib/types';
import {isValidTimeValue, isValidTimezone, normalizeDateValues, timeToMinutes} from '@/lib/utils';

type IncomingCreateEventRequest = Omit<CreateEventRequest, 'location'> & {
  location?: CreateEventRequest['location'] | string;
};

interface ErrorResponseOptions {
  fieldErrors?: ApiFieldErrors;
  status?: number;
  errorCode?: string;
  requestId?: string;
  hint?: string;
  details?: string;
}

function shouldExposeDebugDetails() {
  return process.env.NODE_ENV !== 'production';
}

function compactErrorDetails(message: string, maxLength = 280) {
  const normalized = message.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function errorResponse(error: string, options: ErrorResponseOptions = {}) {
  const body: ApiErrorResponse = {
    error,
    fieldErrors: options.fieldErrors,
    errorCode: options.errorCode,
    requestId: options.requestId,
  };

  if (shouldExposeDebugDetails()) {
    if (options.hint) {
      body.hint = options.hint;
    }

    if (options.details) {
      body.details = options.details;
    }
  }

  return NextResponse.json<ApiErrorResponse>(body, {
    status: options.status ?? 400,
    headers: options.requestId ? {'x-request-id': options.requestId} : undefined,
  });
}

function classifyCreateEventError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    const details = compactErrorDetails(error.message);

    if (/can't reach database server/i.test(details)) {
      return {
        errorCode: 'EVENT_CREATE_DB_UNREACHABLE',
        hint: 'Check DATABASE_URL, pooled host reachability, and whether the Supabase database is available.',
        details,
      };
    }

    if (/authentication failed/i.test(details)) {
      return {
        errorCode: 'EVENT_CREATE_DB_AUTH_FAILED',
        hint: 'Check the database username/password and URL-encode any special characters in the password.',
        details,
      };
    }

    if (/getaddrinfo|enotfound|nodename nor servname provided|name or service not known/i.test(details)) {
      return {
        errorCode: 'EVENT_CREATE_DB_HOST_UNRESOLVED',
        hint: 'Check the Supabase host in DATABASE_URL for typos or stale values.',
        details,
      };
    }

    return {
      errorCode: 'EVENT_CREATE_DB_INIT_FAILED',
      hint: 'The database connection could not be initialized for event creation.',
      details,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const details = compactErrorDetails(`${error.code}: ${error.message}`);

    if (error.code === 'P2002') {
      return {
        errorCode: 'EVENT_CREATE_DB_UNIQUE_CONSTRAINT',
        hint: 'A unique constraint blocked the create operation.',
        details,
      };
    }

    if (error.code === 'P2021') {
      return {
        errorCode: 'EVENT_CREATE_DB_MISSING_TABLE',
        hint: 'The connected database is missing the Event table expected by Prisma.',
        details,
      };
    }

    if (error.code === 'P2022') {
      return {
        errorCode: 'EVENT_CREATE_DB_MISSING_COLUMN',
        hint: 'The connected database is missing a column expected by Prisma. Check recent migrations.',
        details,
      };
    }

    return {
      errorCode: 'EVENT_CREATE_DB_KNOWN_REQUEST',
      hint: 'Prisma returned a known database error during event creation.',
      details,
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      errorCode: 'EVENT_CREATE_DB_VALIDATION',
      hint: 'Prisma rejected the create payload before sending it to the database.',
      details: compactErrorDetails(error.message),
    };
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return {
      errorCode: 'EVENT_CREATE_DB_UNKNOWN_REQUEST',
      hint: 'Prisma returned an unknown database error during event creation.',
      details: compactErrorDetails(error.message),
    };
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return {
      errorCode: 'EVENT_CREATE_DB_PANIC',
      hint: 'The Prisma query engine crashed while creating the event.',
      details: compactErrorDetails(error.message),
    };
  }

  if (error instanceof Error) {
    return {
      errorCode: 'EVENT_CREATE_UNKNOWN',
      hint: 'An unexpected server error occurred while creating the event.',
      details: compactErrorDetails(error.message),
    };
  }

  return {
    errorCode: 'EVENT_CREATE_UNKNOWN',
    hint: 'An unexpected non-Error value was thrown while creating the event.',
  };
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
  const requestId = randomUUID();
  let body: IncomingCreateEventRequest;

  try {
    body = (await request.json()) as IncomingCreateEventRequest;
  } catch {
    return errorResponse('Invalid request body.', {
      status: 400,
      errorCode: 'EVENT_CREATE_INVALID_JSON',
      requestId,
      hint: 'The request body could not be parsed as JSON.',
    });
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
  const hostAccessSecret = createEventHostSecret();
  const hostAccessSecretHash = hashEventHostSecret(hostAccessSecret);

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
    return errorResponse('Please correct the highlighted fields.', {
      fieldErrors,
      status: 400,
      errorCode: 'EVENT_CREATE_VALIDATION_FAILED',
      requestId,
      hint: 'One or more submitted event fields failed validation.',
    });
  }

  let event;

  try {
    event = await prisma.event.create({
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
        hostAccessSecretHash,
        hostAccessCreatedAt: new Date(),
      },
    });
  } catch (error) {
    const diagnostic = classifyCreateEventError(error);

    console.error('[api/events] Failed to create event.', {
      requestId,
      errorCode: diagnostic.errorCode,
      hint: diagnostic.hint,
      details: diagnostic.details,
      titleLength: title.length,
      dateCount: dates.length,
      timeRangeStart: body.timeRangeStart,
      timeRangeEnd: body.timeRangeEnd,
      timezone,
      hasLocation: Boolean(location),
    });

    return errorResponse('We could not create your link just now.', {
      status: 500,
      errorCode: diagnostic.errorCode,
      requestId,
      hint: diagnostic.hint,
      details: diagnostic.details,
    });
  }

  const response = NextResponse.json<CreateEventResponse>(
    {
      id: event.id,
      shareUrl: `/event/${event.id}`,
    },
    {status: 201},
  );

  setEventHostCookie(response, event.id, hostAccessSecret);

  return response;
}
