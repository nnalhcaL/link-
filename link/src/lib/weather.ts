import type {EventRecord, SlotWeatherForecast} from '@/lib/types';
import {buildSlotKey, generateTimeRows} from '@/lib/utils';

interface OpenMeteoForecastResponse {
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    weather_code?: Array<number | null>;
  };
}

export async function getEventSlotWeather(event: Pick<EventRecord, 'dates' | 'timeRangeStart' | 'timeRangeEnd' | 'timezone' | 'locationLatitude' | 'locationLongitude'>) {
  if (event.locationLatitude === null || event.locationLongitude === null || event.dates.length === 0) {
    return [] as SlotWeatherForecast[];
  }

  const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
  weatherUrl.searchParams.set('latitude', String(event.locationLatitude));
  weatherUrl.searchParams.set('longitude', String(event.locationLongitude));
  weatherUrl.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weather_code');
  weatherUrl.searchParams.set('start_date', event.dates[0]);
  weatherUrl.searchParams.set('end_date', event.dates[event.dates.length - 1]);
  weatherUrl.searchParams.set('timezone', event.timezone);

  const response = await fetch(weatherUrl.toString(), {
    next: {
      revalidate: 1800,
    },
  });

  if (!response.ok) {
    throw new Error(`Weather lookup failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as OpenMeteoForecastResponse;
  const hourlyTimes = payload.hourly?.time ?? [];
  const temperatures = payload.hourly?.temperature_2m ?? [];
  const precipitationProbabilities = payload.hourly?.precipitation_probability ?? [];
  const weatherCodes = payload.hourly?.weather_code ?? [];
  const hourlyForecasts = new Map<
    string,
    {
      temperatureC: number | null;
      precipitationProbability: number | null;
      weatherCode: number | null;
    }
  >();

  for (let index = 0; index < hourlyTimes.length; index += 1) {
    hourlyForecasts.set(hourlyTimes[index], {
      temperatureC: typeof temperatures[index] === 'number' ? temperatures[index] : null,
      precipitationProbability: typeof precipitationProbabilities[index] === 'number' ? precipitationProbabilities[index] : null,
      weatherCode: typeof weatherCodes[index] === 'number' ? weatherCodes[index] : null,
    });
  }

  return event.dates.flatMap((date) =>
    generateTimeRows(event.timeRangeStart, event.timeRangeEnd).map((time) => {
      const hourlyForecast = hourlyForecasts.get(`${date}T${time}`);

      return {
        slotKey: buildSlotKey(date, time),
        weatherCode: hourlyForecast?.weatherCode ?? null,
        temperatureC: hourlyForecast?.temperatureC ?? null,
        precipitationProbability: hourlyForecast?.precipitationProbability ?? null,
      } satisfies SlotWeatherForecast;
    }),
  );
}
