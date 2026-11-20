import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendTrailPoint,
  computeBearingDeg,
  computeIntercityLiveTelemetry,
  computeLiveTripTelemetry,
  computeMapBounds,
  computeNextStepTowardsTarget,
  findCorridorWilayas,
  formatEtaDuration,
  isOngoingTrackableIntercity,
  isOngoingTrackableRide,
  projectLatLng,
  resolveIntercityEndpoints,
} from './tracking';
import { SEED_WILAYAS } from './seedData';

test('isOngoingTrackableRide identifies active trips only', () => {
  assert.equal(isOngoingTrackableRide('assigned'), true);
  assert.equal(isOngoingTrackableRide('driver_arriving'), true);
  assert.equal(isOngoingTrackableRide('arrived_pickup'), true);
  assert.equal(isOngoingTrackableRide('loading'), true);
  assert.equal(isOngoingTrackableRide('in_transit'), true);
  assert.equal(isOngoingTrackableRide('arrived_dropoff'), true);
  assert.equal(isOngoingTrackableRide('searching'), false);
  assert.equal(isOngoingTrackableRide('completed'), false);
  assert.equal(isOngoingTrackableRide('cancelled_client'), false);
});

test('isOngoingTrackableIntercity identifies booked and in_progress intercity trips', () => {
  assert.equal(isOngoingTrackableIntercity('booked'), true);
  assert.equal(isOngoingTrackableIntercity('in_progress'), true);
  assert.equal(isOngoingTrackableIntercity('collecting'), false);
  assert.equal(isOngoingTrackableIntercity('quoted'), false);
  assert.equal(isOngoingTrackableIntercity('completed'), false);
  assert.equal(isOngoingTrackableIntercity('rated'), false);
});

test('resolveIntercityEndpoints and findCorridorWilayas resolve Oran -> Alger corridor', () => {
  const endpoints = resolveIntercityEndpoints(
    {
      fromWilaya: 31,
      toWilaya: 16,
      pickupAddress: 'Bir El Djir, Oran',
      dropoffAddress: 'Bab Ezzouar, Alger',
    },
    SEED_WILAYAS
  );
  assert.equal(endpoints.fromWilaya?.nameFr, 'Oran');
  assert.equal(endpoints.toWilaya?.nameFr, 'Alger');
  assert.equal(endpoints.pickup.address, 'Bir El Djir, Oran');
  assert.equal(endpoints.dropoff.address, 'Bab Ezzouar, Alger');

  const corridor = findCorridorWilayas(31, 16, SEED_WILAYAS);
  assert.ok(corridor.some((w) => w.code === 48)); // Relizane lies on Oran -> Alger corridor
  assert.ok(!corridor.some((w) => w.code === 31 || w.code === 16));
});

test('formatEtaDuration formats minutes and hours cleanly in FR and AR', () => {
  assert.equal(formatEtaDuration(42, 'fr'), '~42 min');
  assert.equal(formatEtaDuration(42, 'ar'), '~42 د');
  assert.equal(formatEtaDuration(166, 'fr'), '~2h 46');
  assert.equal(formatEtaDuration(120, 'fr'), '~2h');
  assert.equal(formatEtaDuration(166, 'ar'), '~2 س 46 د');
});

test('computeBearingDeg calculates cardinal bearings accurately', () => {
  const north = computeBearingDeg({ lat: 35.6, lng: -0.6 }, { lat: 35.7, lng: -0.6 });
  assert.ok(north <= 2 || north >= 358);

  const east = computeBearingDeg({ lat: 35.6, lng: -0.6 }, { lat: 35.6, lng: -0.5 });
  assert.ok(east >= 85 && east <= 95);

  const south = computeBearingDeg({ lat: 35.7, lng: -0.6 }, { lat: 35.6, lng: -0.6 });
  assert.ok(south >= 175 && south <= 185);
});

test('projectLatLng keeps points strictly within map viewport safe bounds', () => {
  const pts = [
    { lat: 35.6971, lng: -0.6308 },
    { lat: 35.6479, lng: -0.6217 },
    { lat: 35.68, lng: -0.626 },
  ];
  const bounds = computeMapBounds(pts);
  for (const pt of pts) {
    const projected = projectLatLng(pt, bounds);
    assert.ok(projected.x >= 14 && projected.x <= 86);
    assert.ok(projected.y >= 14 && projected.y <= 78);
  }
});

test('computeLiveTripTelemetry switches target and calculates ETA for driver_arriving vs in_transit', () => {
  const pickup = { address: 'Oran Centre', lat: 35.6971, lng: -0.6308 };
  const dropoff = { address: 'Es Senia', lat: 35.6479, lng: -0.6217 };

  const arriving = computeLiveTripTelemetry({
    status: 'driver_arriving',
    pickup,
    dropoff,
    driverPos: { lat: 35.71, lng: -0.63, speedKmh: 36 },
    routeDistanceKm: 8.4,
  });
  assert.equal(arriving.phase, 'to_pickup');
  assert.equal(arriving.targetAddress, 'Oran Centre');
  assert.ok(arriving.remainingKm > 1);
  assert.ok(arriving.etaMinutes >= 1);

  const transit = computeLiveTripTelemetry({
    status: 'in_transit',
    pickup,
    dropoff,
    driverPos: { lat: 35.67, lng: -0.625, speedKmh: 40 },
    routeDistanceKm: 8.4,
  });
  assert.equal(transit.phase, 'to_dropoff');
  assert.equal(transit.targetAddress, 'Es Senia');
  assert.ok(transit.remainingKm < 4);
  assert.ok(transit.progressPct >= 50 && transit.progressPct <= 98);
});

test('computeIntercityLiveTelemetry tracks booked, in_progress, and completed intercity stages', () => {
  const endpoints = resolveIntercityEndpoints(
    {
      fromWilaya: 31,
      toWilaya: 16,
      pickupAddress: 'Oran',
      dropoffAddress: 'Alger',
    },
    SEED_WILAYAS
  );

  const booked = computeIntercityLiveTelemetry({
    status: 'booked',
    pickup: endpoints.pickup,
    dropoff: endpoints.dropoff,
    driverPos: { lat: 35.6971, lng: -0.6308, speedKmh: 0 },
    routeDistanceKm: 420,
  });
  assert.equal(booked.phase, 'at_pickup');
  assert.equal(booked.remainingKm, 420);
  assert.equal(booked.progressPct, 8);

  const inProgress = computeIntercityLiveTelemetry({
    status: 'in_progress',
    pickup: endpoints.pickup,
    dropoff: endpoints.dropoff,
    driverPos: { lat: 36.1652, lng: 1.3345, speedKmh: 78 },
    routeDistanceKm: 420,
  });
  assert.equal(inProgress.phase, 'to_dropoff');
  assert.ok(inProgress.remainingKm > 120 && inProgress.remainingKm < 300);
  assert.ok(inProgress.progressPct > 30 && inProgress.progressPct < 80);
  assert.ok(inProgress.etaMinutes > 90);

  const completed = computeIntercityLiveTelemetry({
    status: 'completed',
    pickup: endpoints.pickup,
    dropoff: endpoints.dropoff,
    driverPos: { lat: 36.7538, lng: 3.0588, speedKmh: 0 },
    routeDistanceKm: 420,
  });
  assert.equal(completed.phase, 'arrived');
  assert.equal(completed.remainingKm, 0);
  assert.equal(completed.progressPct, 100);
});

test('appendTrailPoint deduplicates consecutive identical WebSocket coordinates and caps length', () => {
  const t1 = appendTrailPoint([], { lat: 35.69, lng: -0.63, ts: '2026-11-18T10:00:00Z' }, 3);
  const t2 = appendTrailPoint(t1, { lat: 35.69, lng: -0.63, ts: '2026-11-18T10:00:02Z' }, 3);
  assert.equal(t2.length, 1);

  const t3 = appendTrailPoint(t2, { lat: 35.68, lng: -0.628, ts: '2026-11-18T10:00:05Z' }, 3);
  const t4 = appendTrailPoint(t3, { lat: 35.67, lng: -0.625, ts: '2026-11-18T10:00:08Z' }, 3);
  const t5 = appendTrailPoint(t4, { lat: 35.66, lng: -0.623, ts: '2026-11-18T10:00:10Z' }, 3);
  assert.equal(t5.length, 3);
  assert.equal(t5[0].lat, 35.68);
  assert.equal(t5[2].lat, 35.66);
});

test('computeNextStepTowardsTarget moves vehicle closer to target with realistic heading and highway speed', () => {
  const cur = { lat: 35.6971, lng: -0.6308 };
  const target = { lat: 35.6479, lng: -0.6217 };
  const step = computeNextStepTowardsTarget(cur, target, 0.4);
  assert.ok(step.lat < cur.lat && step.lat > target.lat);
  assert.ok(step.heading >= 160 && step.heading <= 185);
  assert.ok(step.speedKmh > 0 && step.speedKmh <= 45);

  const highwayStep = computeNextStepTowardsTarget(
    { lat: 35.6971, lng: -0.6308 },
    { lat: 36.7538, lng: 3.0588 },
    0.15
  );
  assert.ok(highwayStep.speedKmh >= 74);
});
