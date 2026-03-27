import {NextRequest, NextResponse} from 'next/server';

import {prisma} from '@/lib/prisma';
import type {ApiErrorResponse, ApiFieldErrors, SubmitAvailabilityRequest, SubmitAvailabilityResponse} from '@/lib/types';
import {generateSlotKeys, normalizeDateValues, parseJsonArray, sortAvailability} from '@/lib/utils';

function errorResponse(error: string, fieldErrors?: ApiFieldErrors, status = 400) {
  return NextResponse.json<ApiErrorResponse>({error, fieldErrors}, {status});
}

export async function POST(request: NextRequest) {
  let body: SubmitAvailabilityRequest;

  try {
    body = (await request.json()) as SubmitAvailabilityRequest;
  } catch {
    return errorResponse('Invalid request body.');
  }

  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  const participantName = typeof body.participantName === 'string' ? body.participantName.trim() : '';
  const availability = Array.isArray(body.availability) ? sortAvailability(body.availability) : [];
  const fieldErrors: ApiFieldErrors = {};

  if (!eventId) {
    fieldErrors.general = 'Event id is required.';
  }

  if (!participantName) {
    fieldErrors.participantName = 'Participant name is required.';
  }

  const event = eventId
    ? await prisma.event.findUnique({
        where: {id: eventId},
      })
    : null;

  if (!event) {
    return errorResponse('This link no longer exists.', undefined, 404);
  }

  const validSlots = new Set(
    generateSlotKeys(normalizeDateValues(parseJsonArray(event.dates)), event.timeRangeStart, event.timeRangeEnd),
  );

  if (availability.some((slotKey) => !validSlots.has(slotKey))) {
    fieldErrors.availability = 'Some selected slots fall outside this link.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return errorResponse('Please correct the highlighted fields.', fieldErrors);
  }

  const response = await prisma.response.upsert({
    where: {
      eventId_participantName: {
        eventId,
        participantName,
      },
    },
    update: {
      availability: JSON.stringify(availability),
    },
    create: {
      eventId,
      participantName,
      availability: JSON.stringify(availability),
    },
  });

  return NextResponse.json<SubmitAvailabilityResponse>({
    id: response.id,
    participantName: response.participantName,
  });
}
