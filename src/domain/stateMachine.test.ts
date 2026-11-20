import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionUrbanRide,
  computeSubscriptionExtension,
  computeSubscriptionStatus,
  isQuoteDateCompatible,
  rankIntercityQuotes,
  validateIntercityDate,
} from './stateMachine';
import type { IntercityQuote } from './types';

test('geofence blocks arrived_pickup if driver is > 300m away (CDC T11)', () => {
  const far = canTransitionUrbanRide({
    from: 'driver_arriving',
    to: 'arrived_pickup',
    actor: 'driver',
    driverPos: { lat: 35.72, lng: -0.6308 },
    pickupPos: { lat: 35.6971, lng: -0.6308 },
  });
  assert.equal(far.ok, false);
  assert.equal(far.code, 'TOO_FAR_FROM_POINT');

  const near = canTransitionUrbanRide({
    from: 'driver_arriving',
    to: 'arrived_pickup',
    actor: 'driver',
    driverPos: { lat: 35.6975, lng: -0.6309 },
    pickupPos: { lat: 35.6971, lng: -0.6308 },
  });
  assert.equal(near.ok, true);
});

test('client cannot cancel after loading has started', () => {
  const res = canTransitionUrbanRide({
    from: 'loading',
    to: 'cancelled_client',
    actor: 'client',
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'CANCELLATION_LOCKED');
});

test('intercity date validation enforces J+1 to J+60 (CDC T21)', () => {
  const today = validateIntercityDate('2026-11-18', '2026-11-18', 1, 60);
  assert.equal(today.ok, false);
  assert.equal(today.code, 'MIN_LEAD_TIME');

  const valid = validateIntercityDate('2026-11-25', '2026-11-18', 1, 60);
  assert.equal(valid.ok, true);

  const tooFar = validateIntercityDate('2027-02-20', '2026-11-18', 1, 60);
  assert.equal(tooFar.ok, false);
  assert.equal(tooFar.code, 'MAX_LEAD_TIME');
});

test('intercity date flexibility checks compatibility properly', () => {
  assert.equal(isQuoteDateCompatible('2026-12-05', '2026-12-05', 'fixed'), true);
  assert.equal(isQuoteDateCompatible('2026-12-05', '2026-12-06', 'fixed'), false);
  assert.equal(isQuoteDateCompatible('2026-12-05', '2026-12-06', 'plus_minus_1'), true);
  assert.equal(isQuoteDateCompatible('2026-12-05', '2026-12-08', 'plus_minus_3'), true);
});

test('Meilleure offre ranking balances price, rating, axis experience, and reactivity', () => {
  const baseQuote: Omit<IntercityQuote, 'id' | 'priceDzd' | 'driverIntercityRating' | 'driverIntercityCount' | 'axisExperienceCount' | 'responseMinutes'> = {
    requestId: 'req-1',
    driverId: 'drv-1',
    driverName: 'Chauffeur',
    vehicleCategory: 'medium_truck',
    vehicleLabel: 'Hyundai HD65',
    plateMasked: '00123-***-31',
    availableDate: '2026-12-05',
    timeSlot: 'morning',
    portersIncluded: 2,
    includesPacking: false,
    includesDisassembly: true,
    isGroupage: false,
    isEmptyReturn: false,
    message: '',
    status: 'pending',
    createdAt: '2026-11-18T10:00:00Z',
  };

  const ranked = rankIntercityQuotes(
    [
      {
        ...baseQuote,
        id: 'cheap-unproven',
        priceDzd: 25000,
        driverIntercityRating: 3.0,
        driverIntercityCount: 1,
        axisExperienceCount: 0,
        responseMinutes: 400,
      },
      {
        ...baseQuote,
        id: 'balanced-expert',
        priceDzd: 29000,
        driverIntercityRating: 4.9,
        driverIntercityCount: 15,
        axisExperienceCount: 10,
        responseMinutes: 20,
      },
    ],
    39500
  );

  assert.equal(ranked[0].id, 'balanced-expert');
  assert.equal(ranked[1].isLowPriceWarning, true);
});

test('subscription extension starts from max(today, ends_on) (CDC T09)', () => {
  const activeExt = computeSubscriptionExtension('2026-11-25', 30, '2026-11-18', 3);
  assert.equal(activeExt.endsOn, '2026-12-25');

  const expiredExt = computeSubscriptionExtension('2026-11-01', 30, '2026-11-18', 3);
  assert.equal(expiredExt.startsOn, '2026-11-18');
  assert.equal(expiredExt.endsOn, '2026-12-18');
  assert.equal(expiredExt.graceUntil, '2026-12-21');
});

test('subscription status detects active, grace, and expired properly', () => {
  assert.equal(
    computeSubscriptionStatus({ endsOn: '2026-11-20', graceUntil: '2026-11-23', status: 'active' }, '2026-11-18')
      .status,
    'active'
  );
  assert.equal(
    computeSubscriptionStatus({ endsOn: '2026-11-17', graceUntil: '2026-11-20', status: 'active' }, '2026-11-18')
      .status,
    'grace'
  );
  assert.equal(
    computeSubscriptionStatus({ endsOn: '2026-11-10', graceUntil: '2026-11-13', status: 'active' }, '2026-11-18')
      .status,
    'expired'
  );
});
