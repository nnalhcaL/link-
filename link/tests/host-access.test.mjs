import {test} from 'node:test';
import assert from 'node:assert/strict';

import {NextResponse} from 'next/server.js';

import {
  canEditEventLocation,
  createEventHostSecret,
  getEventHostCookieName,
  hashEventHostSecret,
  setEventHostCookie,
} from '../src/lib/host-access.ts';

test('host access succeeds only when the matching event cookie is present', () => {
  const eventId = 'evt_123';
  const secret = createEventHostSecret();
  const cookieName = getEventHostCookieName(eventId);
  const cookieReader = {
    get(name) {
      return name === cookieName ? {value: secret} : undefined;
    },
  };

  assert.equal(
    canEditEventLocation(
      {
        id: eventId,
        hostAccessSecretHash: hashEventHostSecret(secret),
      },
      cookieReader,
    ),
    true,
  );

  assert.equal(
    canEditEventLocation(
      {
        id: eventId,
        hostAccessSecretHash: hashEventHostSecret(createEventHostSecret()),
      },
      cookieReader,
    ),
    false,
  );

  assert.equal(
    canEditEventLocation(
      {
        id: eventId,
        hostAccessSecretHash: null,
      },
      cookieReader,
    ),
    false,
  );

  assert.equal(
    canEditEventLocation(
      {
        id: 'evt_other',
        hostAccessSecretHash: hashEventHostSecret(secret),
      },
      cookieReader,
    ),
    false,
  );
});

test('setEventHostCookie stores an httpOnly same-site cookie for the event', () => {
  const eventId = 'evt_cookie';
  const secret = createEventHostSecret();
  const response = NextResponse.json({ok: true});

  setEventHostCookie(response, eventId, secret);

  const cookieName = getEventHostCookieName(eventId);
  const cookieHeader = response.headers.get('set-cookie');

  assert.ok(cookieHeader, 'Expected a set-cookie header.');
  assert.match(cookieHeader, new RegExp(`^${cookieName}=`));
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /SameSite=Lax/i);
  assert.match(cookieHeader, /Path=\//i);
  assert.equal(response.cookies.get(cookieName)?.value, secret);
});
