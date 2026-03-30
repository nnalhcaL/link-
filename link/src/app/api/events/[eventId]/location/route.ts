import {NextRequest, NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';

import {canEditEventLocation} from '@/lib/host-access';
import {prisma} from '@/lib/prisma';
import type {ApiErrorResponse, ApiFieldErrors, EventLocationInput, UpdateEventLocationRequest} from '@/lib/types';
import {serializeEventRecord} from '@/lib/utils';

interface RouteContext {
  params: {
    eventId: string;
  };
}

interface ErrorResponseOptions {
  fieldErrors?: ApiFieldErrors;
  status?: number;
  errorCode?: string;
}

function errorResponse(error: string, options: ErrorResponseOptions = {}) {
  return NextResponse.json<ApiErrorResponse>(
    {
      error,
      fieldErrors: options.fieldErrors,
      errorCode: options.errorCode,
    },
    {status: options.status ?? 400},
  );
}

function isStructuredLocation(value: unknown): value is EventLocationInput {
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

function classifyUpdateLocationError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return {
        errorCode: 'EVENT_LOCATION_NOT_FOUND',
        message: 'This link does not exist.',
        status: 404,
      };
    }

    return {
      errorCode: 'EVENT_LOCATION_UPDATE_FAILED',
      message: 'We could not update the location just now.',
      status: 500,
    };
  }

  return {
    errorCode: 'EVENT_LOCATION_UPDATE_FAILED',
    message: 'We could not update the location just now.',
    status: 500,
  };
}

export async function PATCH(request: NextRequest, {params}: RouteContext) {
  let body: UpdateEventLocationRequest | null;

  try {
    body = (await request.json()) as UpdateEventLocationRequest;
  } catch {
    return errorResponse('Invalid request body.', {
      status: 400,
      errorCode: 'EVENT_LOCATION_INVALID_JSON',
    });
  }

  const event = await prisma.event.findUnique({
    where: {id: params.eventId},
  });

  if (!event) {
    return errorResponse('This link does not exist.', {
      status: 404,
      errorCode: 'EVENT_LOCATION_NOT_FOUND',
    });
  }

  if (!canEditEventLocation(event, request.cookies)) {
    return errorResponse('Only the event host on the original device can update this location.', {
      status: 403,
      errorCode: 'EVENT_LOCATION_FORBIDDEN',
    });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.prototype.hasOwnProperty.call(body, 'location')) {
    return errorResponse('Choose a specific location or clear the current one.', {
      status: 400,
      fieldErrors: {
        location: 'Choose a specific location or clear the current one.',
      },
      errorCode: 'EVENT_LOCATION_MISSING_VALUE',
    });
  }

  const fieldErrors: ApiFieldErrors = {};
  let location: string | null = null;
  let locationAddress: string | null = null;
  let locationLatitude: number | null = null;
  let locationLongitude: number | null = null;

  if (body.location === null) {
    location = null;
  } else if (isStructuredLocation(body.location)) {
    location = body.location.label.trim();
    locationAddress = body.location.address.trim();
    locationLatitude = body.location.latitude;
    locationLongitude = body.location.longitude;
  } else {
    fieldErrors.location = 'Choose a specific location from the search results or clear the field.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return errorResponse('Please correct the highlighted fields.', {
      status: 400,
      fieldErrors,
      errorCode: 'EVENT_LOCATION_VALIDATION_FAILED',
    });
  }

  try {
    const updatedEvent = await prisma.event.update({
      where: {id: event.id},
      data: {
        location,
        locationAddress,
        locationLatitude,
        locationLongitude,
      },
      include: {
        responses: true,
      },
    });

    return NextResponse.json(serializeEventRecord(updatedEvent));
  } catch (error) {
    const diagnostic = classifyUpdateLocationError(error);

    console.error('[api/events/:eventId/location] Failed to update location.', {
      eventId: params.eventId,
      errorCode: diagnostic.errorCode,
      hasLocation: location !== null,
    });

    return errorResponse(diagnostic.message, {
      status: diagnostic.status,
      errorCode: diagnostic.errorCode,
    });
  }
}
