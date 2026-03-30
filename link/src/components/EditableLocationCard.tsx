'use client';

import {type KeyboardEvent, useEffect, useState} from 'react';
import {Check, LoaderCircle, MapPin, PencilLine, Search, X} from 'lucide-react';

import type {
  ApiErrorResponse,
  ApiFieldErrors,
  EventLocationInput,
  EventRecord,
  LocationSearchCandidate,
  LocationSearchResponse,
  UpdateEventLocationRequest,
} from '@/lib/types';
import {cn} from '@/lib/utils';

interface EditableLocationCardProps {
  event: EventRecord;
  canEditLocation: boolean;
  onEventUpdate: (event: EventRecord) => void;
}

function buildLocationInput(event: EventRecord): EventLocationInput | null {
  if (
    !event.location ||
    !event.locationAddress ||
    event.locationLatitude === null ||
    event.locationLongitude === null
  ) {
    return null;
  }

  return {
    label: event.location,
    address: event.locationAddress,
    latitude: event.locationLatitude,
    longitude: event.locationLongitude,
  };
}

export default function EditableLocationCard({event, canEditLocation, onEventUpdate}: EditableLocationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<EventLocationInput | null>(null);
  const [locationCandidates, setLocationCandidates] = useState<LocationSearchCandidate[]>([]);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [locationSaveError, setLocationSaveError] = useState<string | null>(null);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  function resetDraft(nextEvent: EventRecord = event) {
    const currentLocation = buildLocationInput(nextEvent);
    setLocationQuery(currentLocation?.address ?? nextEvent.locationAddress ?? nextEvent.location ?? '');
    setSelectedLocation(currentLocation);
    setLocationCandidates([]);
    setLocationSearchError(null);
    setFieldErrors({});
    setLocationSaveError(null);
  }

  useEffect(() => {
    if (!isEditing) {
      resetDraft(event);
    }
  }, [event, isEditing]);

  async function handleLocationSearch() {
    const trimmedQuery = locationQuery.trim();

    if (!trimmedQuery) {
      setLocationCandidates([]);
      setSelectedLocation(null);
      setLocationSearchError(null);
      setFieldErrors((current) => ({...current, location: undefined}));
      return;
    }

    setIsSearchingLocation(true);
    setLocationSearchError(null);
    setFieldErrors((current) => ({...current, location: undefined}));

    try {
      const response = await fetch('/api/location/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({query: trimmedQuery}),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        const nextError = errorPayload?.fieldErrors?.location ?? errorPayload?.error ?? 'We could not search for that location.';

        setLocationCandidates([]);
        setSelectedLocation(null);
        setLocationSearchError(nextError);
        return;
      }

      const result = (await response.json()) as LocationSearchResponse;

      setLocationCandidates(result.candidates);
      setSelectedLocation(null);
      setLocationSearchError(
        result.candidates.length === 0 ? 'No exact matches found yet. Try a venue, suburb, or full street address.' : null,
      );
    } catch {
      setLocationCandidates([]);
      setSelectedLocation(null);
      setLocationSearchError('We could not search for that location right now.');
    } finally {
      setIsSearchingLocation(false);
    }
  }

  function handleLocationInputChange(value: string) {
    setLocationQuery(value);
    setLocationCandidates([]);
    setLocationSearchError(null);
    setFieldErrors((current) => ({...current, location: undefined}));
    setLocationSaveError(null);

    if (!value.trim()) {
      setSelectedLocation(null);
      return;
    }

    if (selectedLocation && value.trim() !== selectedLocation.address) {
      setSelectedLocation(null);
    }
  }

  function handleLocationKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    void handleLocationSearch();
  }

  function handleLocationSelect(candidate: LocationSearchCandidate) {
    setSelectedLocation(candidate);
    setLocationQuery(candidate.address);
    setLocationSearchError(null);
    setFieldErrors((current) => ({...current, location: undefined}));
    setLocationSaveError(null);
  }

  function handleStartEditing() {
    resetDraft();
    setIsEditing(true);
  }

  function handleCancelEditing() {
    resetDraft();
    setIsEditing(false);
  }

  async function handleSaveLocation() {
    const nextFieldErrors: ApiFieldErrors = {};
    const trimmedQuery = locationQuery.trim();

    if (trimmedQuery && !selectedLocation) {
      nextFieldErrors.location = 'Choose a specific location from the search results or clear the field.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setIsSavingLocation(true);
    setLocationSaveError(null);
    setFieldErrors({});

    const payload: UpdateEventLocationRequest = {
      location: trimmedQuery ? selectedLocation : null,
    };

    try {
      const response = await fetch(`/api/events/${event.id}/location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ApiErrorResponse | null;

        if (errorPayload?.fieldErrors) {
          setFieldErrors(errorPayload.fieldErrors);
        }

        setLocationSaveError(errorPayload?.error ?? 'We could not update the location right now.');
        return;
      }

      const updatedEvent = (await response.json()) as EventRecord;
      onEventUpdate(updatedEvent);
      resetDraft(updatedEvent);
      setIsEditing(false);
    } catch {
      setLocationSaveError('We could not update the location right now.');
    } finally {
      setIsSavingLocation(false);
    }
  }

  return (
    <div className={cn('rounded-[18px] bg-surface-soft p-3 sm:rounded-[24px] sm:p-4', isEditing ? 'md:col-span-2' : '')}>
      {!isEditing ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Location</p>
              <p className="mt-1 text-sm font-semibold text-ink">{event.location || 'No location added yet'}</p>
              {event.locationAddress && event.locationAddress !== event.location ? (
                <p className="mt-1 text-xs leading-5 text-ink-soft">{event.locationAddress}</p>
              ) : null}
            </div>
          </div>

          {canEditLocation ? (
            <button
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:border-primary/30 hover:text-primary"
              onClick={handleStartEditing}
              type="button"
            >
              <PencilLine className="h-4 w-4" />
              {event.location ? 'Edit location' : 'Add location'}
            </button>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Location</p>
                <p className="mt-1 text-sm font-semibold text-ink">Update the event location</p>
                <p className="mt-1 text-xs leading-5 text-ink-soft">
                  Search once, choose the exact place, then save the update for everyone.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                <input
                  className={cn(
                    'w-full rounded-2xl border bg-white py-3.5 pl-12 pr-12 text-sm text-ink outline-none transition-all duration-150',
                    fieldErrors.location
                      ? 'border-danger'
                      : 'border-line focus:border-primary/30 focus:ring-2 focus:ring-primary/10',
                  )}
                  onChange={(currentEvent) => handleLocationInputChange(currentEvent.target.value)}
                  onKeyDown={handleLocationKeyDown}
                  placeholder="Search for a venue or full address"
                  value={locationQuery}
                />

                {locationQuery ? (
                  <button
                    aria-label="Clear location"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft transition-colors duration-150 hover:bg-surface-soft hover:text-ink"
                    onClick={() => handleLocationInputChange('')}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <button
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition-colors duration-150 hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSearchingLocation || !locationQuery.trim()}
                onClick={() => void handleLocationSearch()}
                type="button"
              >
                {isSearchingLocation ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isSearchingLocation ? 'Searching...' : 'Find location'}
              </button>
            </div>

            {selectedLocation ? (
              <div className="rounded-2xl border border-line bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{selectedLocation.label}</p>
                    <p className="mt-1 text-sm leading-6 text-ink-soft">{selectedLocation.address}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <Check className="h-3.5 w-3.5" />
                    Selected
                  </span>
                </div>
              </div>
            ) : null}

            {locationCandidates.length > 0 ? (
              <div className="space-y-2">
                {locationCandidates.map((candidate) => {
                  const isSelected = selectedLocation?.address === candidate.address;

                  return (
                    <button
                      className={cn(
                        'flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-150',
                        isSelected
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-line bg-white hover:border-primary/20 hover:bg-[#f6f8fc]',
                      )}
                      key={`${candidate.address}-${candidate.latitude}-${candidate.longitude}`}
                      onClick={() => handleLocationSelect(candidate)}
                      type="button"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">{candidate.label}</p>
                        <p className="mt-1 text-sm leading-6 text-ink-soft">{candidate.address}</p>
                      </div>
                      {isSelected ? (
                        <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {locationSearchError ? <p className="text-sm text-danger">{locationSearchError}</p> : null}
            {fieldErrors.location ? <p className="text-sm text-danger">{fieldErrors.location}</p> : null}
            {locationSaveError ? <p className="text-sm text-danger">{locationSaveError}</p> : null}
            {locationCandidates.length > 0 || selectedLocation ? (
              <p className="text-xs leading-5 text-ink-soft">Search by OpenStreetMap</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#5c439d] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSavingLocation}
                onClick={() => void handleSaveLocation()}
                type="button"
              >
                {isSavingLocation ? 'Saving...' : 'Save'}
              </button>
              <button
                className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:border-primary/30 hover:text-primary"
                onClick={handleCancelEditing}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors duration-150 hover:border-danger/20 hover:text-danger"
                onClick={() => handleLocationInputChange('')}
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
