import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import process from 'node:process';
import {setTimeout as delay} from 'node:timers/promises';

import {PrismaClient} from '@prisma/client';

const PORT = 3107;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const START_TIMEOUT_MS = 30_000;

const prisma = new PrismaClient();
const createdEventIds = new Set();

let devServer;
let devServerLogs = '';

async function waitForServerReady() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    if (devServer?.exitCode != null) {
      throw new Error(`Next dev server exited early.\n${devServerLogs}`);
    }

    try {
      const response = await fetch(BASE_URL, {redirect: 'manual'});

      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // Server is still booting.
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for Next dev server.\n${devServerLogs}`);
}

async function createEvent(payload) {
  const response = await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return {response, body};
}

before(async () => {
  devServer = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    env: {...process.env, PORT: String(PORT)},
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  for (const stream of [devServer.stdout, devServer.stderr]) {
    stream?.on('data', (chunk) => {
      devServerLogs += chunk.toString();
    });
  }

  await waitForServerReady();
});

after(async () => {
  if (createdEventIds.size > 0) {
    await prisma.event.deleteMany({where: {id: {in: [...createdEventIds]}}});
  }

  await prisma.$disconnect();

  if (devServer && devServer.exitCode == null) {
    devServer.kill('SIGTERM');
    await delay(500);
  }
});

test('creates an event without a location', async () => {
  const payload = {
    title: 'Smoke test without location',
    description: '',
    dates: ['2026-03-29', '2026-03-30', '2026-03-31'],
    timeRangeStart: '09:00',
    timeRangeEnd: '17:00',
    timezone: 'Australia/Sydney',
  };

  const {response, body} = await createEvent(payload);

  assert.equal(response.status, 201, `Expected 201 but received ${response.status}: ${JSON.stringify(body)}`);
  assert.ok(body?.id, 'Expected event id in response body.');
  assert.equal(body?.shareUrl, `/event/${body.id}`);

  createdEventIds.add(body.id);

  const event = await prisma.event.findUnique({where: {id: body.id}});

  assert.ok(event, 'Expected event row to be persisted.');
  assert.equal(event.title, payload.title);
  assert.equal(event.timezone, payload.timezone);
  assert.equal(event.location, null);
  assert.equal(event.locationAddress, null);
  assert.equal(event.locationLatitude, null);
  assert.equal(event.locationLongitude, null);
});

test('creates an event with a structured location', async () => {
  const payload = {
    title: 'Smoke test with location',
    description: 'Structured location payload',
    dates: ['2026-04-01', '2026-04-02'],
    timeRangeStart: '10:00',
    timeRangeEnd: '18:00',
    timezone: 'Australia/Sydney',
    location: {
      label: 'Sydney Opera House',
      address: 'Bennelong Point, Sydney NSW 2000, Australia',
      latitude: -33.8568,
      longitude: 151.2153,
    },
  };

  const {response, body} = await createEvent(payload);

  assert.equal(response.status, 201, `Expected 201 but received ${response.status}: ${JSON.stringify(body)}`);
  assert.ok(body?.id, 'Expected event id in response body.');
  assert.equal(body?.shareUrl, `/event/${body.id}`);

  createdEventIds.add(body.id);

  const event = await prisma.event.findUnique({where: {id: body.id}});

  assert.ok(event, 'Expected event row to be persisted.');
  assert.equal(event.title, payload.title);
  assert.equal(event.location, payload.location.label);
  assert.equal(event.locationAddress, payload.location.address);
  assert.equal(event.locationLatitude, payload.location.latitude);
  assert.equal(event.locationLongitude, payload.location.longitude);
});
