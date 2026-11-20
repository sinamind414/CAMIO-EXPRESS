import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminAnalytics } from './adminAnalytics';
import {
  SEED_DRIVERS,
  SEED_INTERCITY,
  SEED_PAYMENTS,
  SEED_RIDES,
  SEED_WILAYAS,
} from './seedData';

test('buildAdminAnalytics in live mode aggregates only active rides, intercity requests, and approved payments', () => {
  const result = buildAdminAnalytics({
    locale: 'fr',
    wilayas: SEED_WILAYAS,
    drivers: SEED_DRIVERS,
    rides: SEED_RIDES,
    intercityRequests: SEED_INTERCITY,
    payments: SEED_PAYMENTS,
    mode: 'live',
  });

  // SEED_RIDES has 2 rides in Oran (31), SEED_INTERCITY has 2 requests from Oran (31)
  assert.equal(result.totals.totalUrban, 2);
  assert.equal(result.totals.totalIntercity, 2);
  assert.equal(result.totals.totalTrips, 4);
  assert.equal(result.wilayaVolume.length, 1);
  assert.equal(result.wilayaVolume[0]?.wilayaCode, 31);
  assert.equal(result.wilayaVolume[0]?.urbanCount, 2);
  assert.equal(result.wilayaVolume[0]?.intercityCount, 2);

  // Only approved payments contribute to subscription revenue (pay-2 = 1000 DA reviewed in 2026-11)
  assert.equal(result.totals.totalSubscriptionRevenueDzd, 1000);
  const nov = result.monthlyRevenue.find((m) => m.monthKey === '2026-11');
  assert.equal(nov?.subscriptionRevenueDzd, 1000);
});

test('buildAdminAnalytics in 6m mode includes multi-wilaya baseline plus live records and orders top wilaya first', () => {
  const result = buildAdminAnalytics({
    locale: 'fr',
    wilayas: SEED_WILAYAS,
    drivers: SEED_DRIVERS,
    rides: SEED_RIDES,
    intercityRequests: SEED_INTERCITY,
    payments: SEED_PAYMENTS,
    mode: '6m',
  });

  assert.equal(result.wilayaVolume.length >= 8, true);
  assert.equal(result.wilayaVolume[0]?.wilayaCode, 31);
  assert.equal(result.monthlyRevenue.length, 6);
  assert.equal(result.totals.subscriptionGrowthPct > 0, true);
});

test('buildAdminAnalytics localizes wilaya and month names in Arabic', () => {
  const result = buildAdminAnalytics({
    locale: 'ar',
    wilayas: SEED_WILAYAS,
    drivers: SEED_DRIVERS,
    rides: SEED_RIDES,
    intercityRequests: SEED_INTERCITY,
    payments: SEED_PAYMENTS,
    mode: '6m',
  });

  assert.equal(result.wilayaVolume[0]?.name, 'وهران');
  assert.equal(result.monthlyRevenue[0]?.monthLabel, 'يونيو');
  assert.equal(result.monthlyRevenue[5]?.monthLabel, 'نوفمبر');
});

test('buildAdminAnalytics reflects newly added ride and newly approved payment in real time', () => {
  const extraRide = {
    ...SEED_RIDES[0],
    id: 'ride-alger-live',
    wilayaCode: 16,
    finalAgreedPriceDzd: 22000,
    createdAt: '2026-11-18T12:00:00Z',
  };
  const approvedPayment = {
    ...SEED_PAYMENTS[0],
    status: 'approved' as const,
    reviewedAt: '2026-11-18T12:05:00Z',
  };

  const result = buildAdminAnalytics({
    locale: 'fr',
    wilayas: SEED_WILAYAS,
    drivers: SEED_DRIVERS,
    rides: [...SEED_RIDES, extraRide],
    intercityRequests: SEED_INTERCITY,
    payments: [approvedPayment, SEED_PAYMENTS[1]],
    mode: 'live',
  });

  const alger = result.wilayaVolume.find((w) => w.wilayaCode === 16);
  assert.equal(alger?.urbanCount, 1);
  assert.equal(alger?.volumeDzd, 22000);

  const nov = result.monthlyRevenue.find((m) => m.monthKey === '2026-11');
  assert.equal(nov?.subscriptionRevenueDzd, 2000);
  assert.equal(result.totals.totalSubscriptionRevenueDzd, 2000);
});
