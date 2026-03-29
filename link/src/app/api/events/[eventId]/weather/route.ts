import {NextResponse} from 'next/server';

import {prisma} from '@/lib/prisma';
import type {EventWeatherResponse} from '@/lib/types';
import {normalizeDateValues, parseJsonArray} from '@/lib/utils';
import {getEventSlotWeather} from '@/lib/weather';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    eventId: string;
  };
}

export async function GET(_: Request, {params}: RouteContext) {
  const event = await prisma.event.findUnique({
    where: {id: params.eventId},
  });

  if (!event) {
    return NextResponse.json({error: 'This link does not exist.'}, {status: 404});
  }

  if (event.locationLatitude === null || event.locationLongitude === null) {
    return NextResponse.json<EventWeatherResponse>({
      available: false,
      locationLabel: event.location,
      forecasts: [],
      source: 'open-meteo',
    });
  }

  try {
    const forecasts = await getEventSlotWeather({
      dates: normalizeDateValues(parseJsonArray(event.dates)),
      timeRangeStart: event.timeRangeStart,
      timeRangeEnd: event.timeRangeEnd,
      timezone: event.timezone,
      locationLatitude: event.locationLatitude,
      locationLongitude: event.locationLongitude,
    });

    const available = forecasts.some(
      (forecast) =>
        forecast.weatherCode !== null || forecast.temperatureC !== null || forecast.precipitationProbability !== null,
    );

    return NextResponse.json<EventWeatherResponse>({
      available,
      locationLabel: event.location,
      forecasts: available ? forecasts : [],
      source: 'open-meteo',
    });
  } catch (error) {
    console.error('Weather lookup failed.', error);

    return NextResponse.json<EventWeatherResponse>({
      available: false,
      locationLabel: event.location,
      forecasts: [],
      source: 'open-meteo',
    });
  }
}
