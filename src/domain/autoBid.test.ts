import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_BID_RETRACT_WINDOW_MS,
  evaluateAutoBidForRide,
  getOfferRetractStatus,
  previewAutoBidMatches,
} from './autoBid';
import type { DriverProfile, Ride } from './types';

const BASE_RIDE: Pick<
  Ride,
  'status' | 'serviceType' | 'vehicleCategory' | 'distanceKm' | 'portersCount' | 'priceFloorDzd' | 'priceCapDzd'
> = {
  status: 'searching',
  serviceType: 'moving',
  vehicleCategory: 'medium_truck',
  distanceKm: 10,
  portersCount: 2,
  priceFloorDzd: 14000,
  priceCapDzd: 38000,
};

const BASE_DRIVER: Pick<DriverProfile, 'status' | 'isOnline' | 'vehicle'> & {
  autoBidConfig: NonNullable<DriverProfile['autoBidConfig']>;
} = {
  status: 'approved',
  isOnline: true,
  vehicle: {
    id: 'v1',
    driverId: 'd1',
    category: 'medium_truck',
    brand: 'Hyundai',
    model: 'HD65',
    plateNumber: '04521-118-31',
    year: 2020,
    maxLoadKg: 3500,
    volumeM3: 12,
    hasTailgate: true,
    hasRamps: true,
    isActive: true,
  },
  autoBidConfig: {
    enabled: true,
    ratePerKmDzd: 1200,
    minFloorPriceDzd: 13000,
    maxDistanceKm: 30,
    serviceTypes: ['moving', 'freight'],
    acceptSmallerLoads: true,
    message: 'Offre auto',
  },
};

test('evaluateAutoBidForRide calculates price from km rate + porters above driver floor', () => {
  const res = evaluateAutoBidForRide(BASE_RIDE, BASE_DRIVER);
  // 10 * 1200 + 2 * 2000 = 16000 DA (within [14000, 38000])
  assert.equal(res.compatible, true);
  assert.equal(res.priceDzd, 16000);
});

test('evaluateAutoBidForRide respects minFloorPriceDzd and rejects when floor exceeds ride cap', () => {
  const highFloor = evaluateAutoBidForRide(
    { ...BASE_RIDE, distanceKm: 3, portersCount: 0, priceFloorDzd: 8000, priceCapDzd: 20000 },
    {
      ...BASE_DRIVER,
      autoBidConfig: { ...BASE_DRIVER.autoBidConfig, minFloorPriceDzd: 15000 },
    }
  );
  assert.equal(highFloor.compatible, true);
  assert.equal(highFloor.priceDzd, 15000);

  const impossibleFloor = evaluateAutoBidForRide(
    { ...BASE_RIDE, priceCapDzd: 12000 },
    {
      ...BASE_DRIVER,
      autoBidConfig: { ...BASE_DRIVER.autoBidConfig, minFloorPriceDzd: 15000 },
    }
  );
  assert.equal(impossibleFloor.compatible, false);
  assert.equal(impossibleFloor.reason, 'FLOOR_ABOVE_CAP');
});

test('evaluateAutoBidForRide skips incompatible service or distance limit', () => {
  const wrongService = evaluateAutoBidForRide(
    { ...BASE_RIDE, serviceType: 'refrigerated' },
    BASE_DRIVER
  );
  assert.equal(wrongService.compatible, false);
  assert.equal(wrongService.reason, 'SERVICE_MISMATCH');

  const tooFar = evaluateAutoBidForRide({ ...BASE_RIDE, distanceKm: 45 }, BASE_DRIVER);
  assert.equal(tooFar.compatible, false);
  assert.equal(tooFar.reason, 'DISTANCE_EXCEEDED');
});

test('getOfferRetractStatus allows retraction inside 3-minute window and locks afterward', () => {
  const createdMs = 1_700_000_000_000;
  const offer = {
    status: 'pending' as const,
    createdAt: new Date(createdMs).toISOString(),
    retractableUntil: new Date(createdMs + AUTO_BID_RETRACT_WINDOW_MS).toISOString(),
  };

  const midWindow = getOfferRetractStatus(offer, createdMs + 90_000);
  assert.equal(midWindow.canRetract, true);
  assert.equal(midWindow.remainingLabel, '1:30');

  const expired = getOfferRetractStatus(offer, createdMs + AUTO_BID_RETRACT_WINDOW_MS + 1000);
  assert.equal(expired.canRetract, false);
  assert.equal(expired.remainingLabel, '0:00');
});

test('previewAutoBidMatches returns compatible searching rides with computed prices', () => {
  const rides = [
    {
      ...BASE_RIDE,
      id: 'r1',
      rideCode: 'LM-1',
      offers: [],
    },
    {
      ...BASE_RIDE,
      id: 'r2',
      rideCode: 'LM-2',
      status: 'completed' as const,
      offers: [],
    },
    {
      ...BASE_RIDE,
      id: 'r3',
      rideCode: 'LM-3',
      distanceKm: 60, // exceeds maxDistanceKm 30
      offers: [],
    },
  ] as unknown as Ride[];

  const matches = previewAutoBidMatches(
    rides,
    { id: 'd1', status: 'approved', isOnline: false, vehicle: BASE_DRIVER.vehicle },
    { ...BASE_DRIVER.autoBidConfig, enabled: false }
  );

  assert.equal(matches.length, 1);
  assert.equal(matches[0].rideId, 'r1');
  assert.equal(matches[0].estimatedOfferDzd, 16000);
  assert.equal(matches[0].alreadyOffered, false);
});

