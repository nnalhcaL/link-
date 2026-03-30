'use client';

import {useEffect, useState} from 'react';
import {CloudSun, Sparkles} from 'lucide-react';

import type {AvailabilityWindowSummary, EventRecord, EventWeatherResponse, SlotWeatherForecast} from '@/lib/types';
import {
  buildSlotKey,
  buildAvailabilityWindowSummaries,
  buildBestOptionWindowSummaries,
  formatDateLabel,
  formatTimeLabel,
  getDurationOptions,
  minutesToTime,
  timeToMinutes,
} from '@/lib/utils';

interface PlaceholderFeaturesProps {
  event: EventRecord;
}

const MATCH_BATCH_SIZE = 3;
const BEST_OPTIONS_OPTION = 'best';

interface MatchWeatherSummary {
  conditionLabel: string;
  temperatureLabel: string | null;
  rainLabel: string | null;
}

function formatDurationLabel(hours: number) {
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

function formatWindowTimeLabel(startTime: string, endTime: string) {
  return `${formatTimeLabel(startTime)} to ${formatTimeLabel(endTime)}`;
}

function formatMatchSummary(hours: number, count: number, totalParticipants: number, isFullGroup: boolean) {
  if (isFullGroup) {
    return `Everyone can make this ${formatDurationLabel(hours)} window.`;
  }

  return `${formatDurationLabel(hours)} window with ${count} of ${totalParticipants} people available.`;
}

function formatWeatherCondition(weatherCode: number | null) {
  if (weatherCode === null) {
    return 'Forecast';
  }

  if (weatherCode === 0) {
    return 'Clear';
  }

  if (weatherCode === 1 || weatherCode === 2 || weatherCode === 3) {
    return 'Cloudy';
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return 'Fog';
  }

  if ([51, 53, 55, 56, 57].includes(weatherCode)) {
    return 'Drizzle';
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return 'Rain';
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return 'Snow';
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return 'Storms';
  }

  return 'Forecast';
}

function buildMatchWeatherSummary(
  match: AvailabilityWindowSummary,
  forecastsBySlotKey: Map<string, SlotWeatherForecast>,
): MatchWeatherSummary | null {
  if (forecastsBySlotKey.size === 0) {
    return null;
  }

  const slotForecasts = Array.from({length: match.durationHours}, (_, index) => {
    const slotTime = minutesToTime(timeToMinutes(match.startTime) + index * 60);
    return forecastsBySlotKey.get(buildSlotKey(match.date, slotTime)) ?? null;
  }).filter((forecast): forecast is SlotWeatherForecast => forecast !== null);

  if (slotForecasts.length === 0) {
    return null;
  }

  const firstForecastWithCode = slotForecasts.find((forecast) => forecast.weatherCode !== null) ?? slotForecasts[0];
  const temperatureValues = slotForecasts
    .map((forecast) => forecast.temperatureC)
    .filter((temperature): temperature is number => temperature !== null);
  let maxRainProbability: number | null = null;

  for (const forecast of slotForecasts) {
    if (forecast.precipitationProbability === null) {
      continue;
    }

    maxRainProbability =
      maxRainProbability === null
        ? Math.round(forecast.precipitationProbability)
        : Math.max(maxRainProbability, Math.round(forecast.precipitationProbability));
  }

  const hasForecastData =
    firstForecastWithCode.weatherCode !== null || temperatureValues.length > 0 || maxRainProbability !== null;

  if (!hasForecastData) {
    return null;
  }

  return {
    conditionLabel: formatWeatherCondition(firstForecastWithCode.weatherCode),
    temperatureLabel:
      temperatureValues.length > 0
        ? (() => {
            const minTemperature = Math.round(Math.min(...temperatureValues));
            const maxTemperature = Math.round(Math.max(...temperatureValues));

            return minTemperature === maxTemperature ? `${minTemperature} C` : `${minTemperature}-${maxTemperature} C`;
          })()
        : null,
    rainLabel: maxRainProbability !== null ? `${maxRainProbability}% rain` : null,
  };
}

export default function PlaceholderFeatures({event}: PlaceholderFeaturesProps) {
  const totalParticipants = event.responses.length;
  const durationOptions = getDurationOptions(event);
  const [selectedDurationOption, setSelectedDurationOption] = useState<string>(BEST_OPTIONS_OPTION);
  const [visibleMatchCount, setVisibleMatchCount] = useState(MATCH_BATCH_SIZE);
  const [weather, setWeather] = useState<EventWeatherResponse | null>(null);

  const isBestOptionsSelected = selectedDurationOption === BEST_OPTIONS_OPTION;
  const selectedDurationHours = Number(selectedDurationOption);
  const matches = isBestOptionsSelected
    ? buildBestOptionWindowSummaries(event)
    : buildAvailabilityWindowSummaries(event, selectedDurationHours);
  const visibleMatches = matches.slice(0, visibleMatchCount);
  const hiddenMatchCount = Math.max(matches.length - visibleMatches.length, 0);
  const durationInputId = `summary-duration-${event.id}`;
  const forecastsBySlotKey = new Map((weather?.forecasts ?? []).map((forecast) => [forecast.slotKey, forecast]));

  useEffect(() => {
    if (event.locationLatitude === null || event.locationLongitude === null) {
      setWeather(null);
      return;
    }

    const controller = new AbortController();

    async function loadWeather() {
      try {
        const response = await fetch(`/api/events/${event.id}/weather`, {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Weather fetch failed with status ${response.status}.`);
        }

        const payload = (await response.json()) as EventWeatherResponse;
        setWeather(payload.available ? payload : null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.warn('Weather fetch failed.', error);
        setWeather(null);
      }
    }

    void loadWeather();

    return () => {
      controller.abort();
    };
  }, [event.id, event.locationLatitude, event.locationLongitude]);

  return (
    <section className="panel-border rounded-[28px] bg-white p-6 shadow-soft">
      <div className="flex flex-col gap-5 border-b border-line pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold tracking-tight text-ink">AI Summary</h2>
            <p className="text-sm leading-6 text-ink-soft">Continuous overlap for the group, ranked into useful windows.</p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-[280px]">
          <label className="text-sm font-semibold text-ink" htmlFor={durationInputId}>
            Hangout duration
          </label>
          <select
            className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition-colors duration-150 focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
            disabled={totalParticipants === 0}
            id={durationInputId}
            onChange={(event) => {
              setSelectedDurationOption(event.target.value);
              setVisibleMatchCount(MATCH_BATCH_SIZE);
            }}
            value={selectedDurationOption}
          >
            <option value={BEST_OPTIONS_OPTION}>Best options</option>
            {durationOptions.map((durationHours) => (
              <option key={durationHours} value={String(durationHours)}>
                {formatDurationLabel(durationHours)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5">
        {totalParticipants === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface-soft px-4 py-4 text-sm leading-6 text-ink-soft">
            Smart scheduling suggestions will appear here once your group starts responding.
          </div>
        ) : (
          <>
            {isBestOptionsSelected ? (
              <p className="text-sm leading-6 text-ink-soft">
                Showing distinct best-fit time blocks first, prioritizing the most people and then longer windows.
              </p>
            ) : (
              <p className="text-sm leading-6 text-ink-soft">
                Showing the top {formatDurationLabel(selectedDurationHours)} matches for that hangout length.
              </p>
            )}

            {matches.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface-soft px-4 py-4 text-sm leading-6 text-ink-soft">
                {isBestOptionsSelected
                  ? 'No shared windows are available yet.'
                  : `No one has a continuous ${formatDurationLabel(selectedDurationHours)} window yet.`}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleMatches.map((match, index) => {
                  const matchWeather = buildMatchWeatherSummary(match, forecastsBySlotKey);

                  return (
                    <div
                      className={index === 0 ? 'rounded-2xl bg-surface-soft px-4 py-4' : 'rounded-2xl border border-line px-4 py-4'}
                      key={match.windowKey}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-ink">{formatDateLabel(match.date)}</p>
                          <p className="mt-1 text-lg font-semibold text-ink">
                            {formatWindowTimeLabel(match.startTime, match.endTime)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-ink-soft">
                            {formatMatchSummary(match.durationHours, match.count, totalParticipants, match.isFullGroup)}
                          </p>
                          {matchWeather ? (
                            <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-ink-soft">
                              <CloudSun className="h-4 w-4 text-primary" />
                              <span className="text-ink">{matchWeather.conditionLabel}</span>
                              {matchWeather.temperatureLabel ? <span>{matchWeather.temperatureLabel}</span> : null}
                              {matchWeather.rainLabel ? <span>{matchWeather.rainLabel}</span> : null}
                            </div>
                          ) : null}
                        </div>

                        <div className="group relative shrink-0 self-start">
                          <button
                            aria-label={`Show who can make the ${formatWindowTimeLabel(match.startTime, match.endTime)} window`}
                            className={
                              index === 0
                                ? 'rounded-xl border border-line bg-white px-3 py-2 text-right outline-none transition-colors duration-150 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10'
                                : 'rounded-xl border border-line bg-surface-soft px-3 py-2 text-right outline-none transition-colors duration-150 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10'
                            }
                            type="button"
                          >
                            <p className="text-xs text-ink-soft">Responses</p>
                            <p className="text-sm font-semibold text-ink">
                              {match.isFullGroup ? 'Everyone free' : `${match.count}/${totalParticipants} free`}
                            </p>
                          </button>

                          <div className="pointer-events-none absolute right-0 top-[calc(100%+10px)] z-20 hidden w-64 rounded-xl border border-line bg-white p-3 text-left shadow-soft group-hover:block group-focus-within:block">
                            <p className="text-xs font-semibold text-ink-soft">Who can make it</p>
                            <p className="mt-2 text-sm leading-6 text-ink">{match.participantNames.join(', ')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {hiddenMatchCount > 0 ? (
              <button
                className="mt-4 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:border-primary/30 hover:text-primary"
                onClick={() => setVisibleMatchCount((current) => current + MATCH_BATCH_SIZE)}
                type="button"
              >
                Show {Math.min(MATCH_BATCH_SIZE, hiddenMatchCount)} more
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
