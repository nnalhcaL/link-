import {createHash, randomBytes, timingSafeEqual} from 'crypto';
import type {NextResponse} from 'next/server';

const EVENT_HOST_COOKIE_PREFIX = 'link-event-host-';
const EVENT_HOST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

interface CookieRecord {
  value: string;
}

interface CookieReader {
  get(name: string): CookieRecord | undefined;
}

interface EventHostAccessRecord {
  id: string;
  hostAccessSecretHash: string | null;
}

export function createEventHostSecret() {
  return randomBytes(32).toString('base64url');
}

export function hashEventHostSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

export function getEventHostCookieName(eventId: string) {
  return `${EVENT_HOST_COOKIE_PREFIX}${eventId}`;
}

export function setEventHostCookie(response: NextResponse, eventId: string, secret: string) {
  response.cookies.set({
    name: getEventHostCookieName(eventId),
    value: secret,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: EVENT_HOST_COOKIE_MAX_AGE_SECONDS,
  });
}

function compareSecretHashes(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function canEditEventLocation(event: EventHostAccessRecord, cookieReader: CookieReader) {
  if (!event.hostAccessSecretHash) {
    return false;
  }

  const cookieValue = cookieReader.get(getEventHostCookieName(event.id))?.value;

  if (!cookieValue) {
    return false;
  }

  return compareSecretHashes(hashEventHostSecret(cookieValue), event.hostAccessSecretHash);
}
