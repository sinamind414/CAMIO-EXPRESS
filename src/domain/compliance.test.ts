import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canRevealIntercityContact,
  canRevealUrbanContact,
  canSendIntercityChat,
  canSendUrbanChat,
  computeDriverReactivity,
  detectSuspiciousCancellations,
  isDriverBlockedByIntercity,
  isDriverEligibleForIntercity,
  isLateIntercityCancellation,
  recordDriverIgnoredRequest,
  recordDriverOfferResponse,
  sanitizeIntercityForApi,
  sanitizeRideForApi,
  sanitizeRideOfferForApi,
} from './compliance';
import { SEED_DRIVERS, SEED_INTERCITY, SEED_RIDES, SEED_SETTINGS } from './seedData';
import type { RideOffer } from './types';

test('CDC C11 / T33: sanitizeRideOfferForApi strips all phone fields from offers', () => {
  const dirtyOffer = {
    ...SEED_RIDES[0].offers[0],
    driverPhone: '+213661234567',
    driver_phone: '+213661234567',
    phone: '+213661234567',
  } as RideOffer & Record<string, unknown>;

  const clean = sanitizeRideOfferForApi(dirtyOffer) as unknown as Record<string, unknown>;
  assert.equal('driverPhone' in clean, false);
  assert.equal('driver_phone' in clean, false);
  assert.equal('phone' in clean, false);
  assert.equal(clean.driverName, 'Mourad Mansouri');
});

test('CDC C11 / T34-T35: contact is hidden before assignment/booking and revealed afterward', () => {
  assert.equal(canRevealUrbanContact('searching'), false);
  assert.equal(canRevealUrbanContact('cancelled_client'), false);
  assert.equal(canRevealUrbanContact('assigned'), true);
  assert.equal(canRevealUrbanContact('in_transit'), true);
  assert.equal(canRevealUrbanContact('completed'), true);

  assert.equal(canRevealIntercityContact('collecting'), false);
  assert.equal(canRevealIntercityContact('quoted'), false);
  assert.equal(canRevealIntercityContact('booked'), true);
  assert.equal(canRevealIntercityContact('in_progress'), true);

  const searchingSanitized = sanitizeRideForApi(SEED_RIDES[0]);
  assert.equal(searchingSanitized.clientPhone, '');
  assert.equal(searchingSanitized.driverPhone, undefined);

  const completedSanitized = sanitizeRideForApi(SEED_RIDES[1]);
  assert.equal(completedSanitized.clientPhone, '+213551889900');
  assert.equal(completedSanitized.driverPhone, '+213661234567');

  const quotedIc = SEED_INTERCITY.find((ic) => ic.status === 'quoted')!;
  const quotedSanitized = sanitizeIntercityForApi(quotedIc);
  assert.equal(quotedSanitized.clientPhone, '');
  assert.equal(quotedSanitized.driverPhone, undefined);
});

test('CDC C11 / T36: chat is locked before assignment unless explicitly enabled by admin settings', () => {
  assert.equal(canSendUrbanChat('searching', { chatEnabledBeforeAssignment: false }), false);
  assert.equal(canSendUrbanChat('assigned', { chatEnabledBeforeAssignment: false }), true);
  assert.equal(canSendUrbanChat('cancelled_client', { chatEnabledBeforeAssignment: true }), false);
  assert.equal(canSendUrbanChat('searching', { chatEnabledBeforeAssignment: true }), true);

  assert.equal(canSendIntercityChat('quoted', { chatEnabledBeforeAssignment: false }), false);
  assert.equal(canSendIntercityChat('booked', { chatEnabledBeforeAssignment: false }), true);
});

test('CDC C12 / T37: driver ignoring 20 consecutive requests is automatically demoted in broadcast', () => {
  let drv = {
    ...SEED_DRIVERS[0],
    requestsReceivedCount: 0,
    requestsRespondedCount: 0,
    ignoredRequestsStreak: 0,
    responseRate: 1,
    isDemotedInBroadcast: false,
  };

  for (let i = 0; i < 19; i++) {
    drv = recordDriverIgnoredRequest(drv, SEED_SETTINGS);
  }
  assert.equal(drv.ignoredRequestsStreak, 19);
  assert.equal(drv.isDemotedInBroadcast, false);

  drv = recordDriverIgnoredRequest(drv, SEED_SETTINGS);
  assert.equal(drv.ignoredRequestsStreak, 20);
  assert.equal(drv.responseRate, 0);
  assert.equal(drv.isDemotedInBroadcast, true);

  // Even after 1 response resets streak, low response rate (1/21 = 5% < 30%) keeps demotion until recovered
  const afterOneReply = recordDriverOfferResponse(drv, SEED_SETTINGS);
  assert.equal(afterOneReply.ignoredRequestsStreak, 0);
  assert.equal(afterOneReply.isDemotedInBroadcast, true);

  // High response rate clears demotion
  const healthy = computeDriverReactivity(
    { requestsReceivedCount: 20, requestsRespondedCount: 10, ignoredRequestsStreak: 2 },
    SEED_SETTINGS
  );
  assert.equal(healthy.responseRate, 0.5);
  assert.equal(healthy.isDemotedInBroadcast, false);
});

test('CDC §6.5 / T25: intercity booked trip blocks driver for urban rides within ±24h window', () => {
  const bookedTrip = {
    ...SEED_INTERCITY[0],
    id: 'ic-t25',
    driverId: 'drv-karim',
    status: 'booked' as const,
    preferredDate: '2026-11-20',
  };

  const blockedSameDay = isDriverBlockedByIntercity('drv-karim', [bookedTrip], '2026-11-20', SEED_SETTINGS);
  assert.equal(blockedSameDay.blocked, true);

  const blockedPrevDay = isDriverBlockedByIntercity('drv-karim', [bookedTrip], '2026-11-19', SEED_SETTINGS);
  assert.equal(blockedPrevDay.blocked, true);

  const freeTwoDaysLater = isDriverBlockedByIntercity('drv-karim', [bookedTrip], '2026-11-22', SEED_SETTINGS);
  assert.equal(freeTwoDaysLater.blocked, false);
});

test('CDC §7.5: driver with >= 3 intercity ratings and average < 3.5 is suspended from intercity', () => {
  const lowQualityDriver = {
    ...SEED_DRIVERS[0],
    intercityRatingsCount: 3,
    ratingIntercityAvg: 3.2,
  };
  const check = isDriverEligibleForIntercity(lowQualityDriver, '2026-11-19');
  assert.equal(check.eligible, false);
  assert.equal(check.code, 'INTERCITY_QUALITY_SUSPENDED');

  const okDriver = isDriverEligibleForIntercity(SEED_DRIVERS[0], '2026-11-19');
  assert.equal(okDriver.eligible, true);
});

test('CDC §5.14 / T27 & C12: detects < 48h client intercity cancellation and repeated post-assignment cancellations', () => {
  assert.equal(isLateIntercityCancellation('2026-11-20', '2026-11-19T12:00:00Z'), true);
  assert.equal(isLateIntercityCancellation('2026-11-25', '2026-11-19T12:00:00Z'), false);

  const cancelledRides = [
    { ...SEED_RIDES[1], id: 'r-c1', status: 'cancelled_client' as const },
    { ...SEED_RIDES[1], id: 'r-c2', status: 'cancelled_client' as const },
  ];
  const lateIc = [
    {
      ...SEED_INTERCITY[0],
      id: 'ic-c1',
      status: 'cancelled_client' as const,
      lateClientCancellationFlag: true,
    },
  ];
  const alerts = detectSuspiciousCancellations(cancelledRides, lateIc);
  assert.ok(alerts.some((a) => a.kind === 'repeated_pair'));
  assert.ok(alerts.some((a) => a.kind === 'late_intercity_cancellation'));
});
