import {NextRequest, NextResponse} from 'next/server';

import {consumeLocationSearchRateLimit, getLocationSearchRateLimitKey, searchLocationCandidates} from '@/lib/location-search';
import type {ApiErrorResponse, ApiFieldErrors, LocationSearchRequest, LocationSearchResponse} from '@/lib/types';

function errorResponse(error: string, fieldErrors?: ApiFieldErrors, status = 400) {
  return NextResponse.json<ApiErrorResponse>({error, fieldErrors}, {status});
}

export async function POST(request: NextRequest) {
  let body: LocationSearchRequest;

  try {
    body = (await request.json()) as LocationSearchRequest;
  } catch {
    return errorResponse('Invalid request body.');
  }

  const query = typeof body.query === 'string' ? body.query.trim() : '';

  if (!query) {
    return errorResponse('Enter a place or address to search for.', {location: 'Enter a place or address to search for.'});
  }

  const rateLimitKey = getLocationSearchRateLimitKey(request.headers);
  const rateLimit = consumeLocationSearchRateLimit(rateLimitKey);

  if (!rateLimit.allowed) {
    return NextResponse.json<ApiErrorResponse>(
      {error: 'Too many location searches. Please wait a moment and try again.'},
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const candidates = await searchLocationCandidates(query);

    return NextResponse.json<LocationSearchResponse>({candidates});
  } catch (error) {
    console.error('Location search failed.', error);
    return errorResponse('We could not search for that location right now.', undefined, 502);
  }
}
