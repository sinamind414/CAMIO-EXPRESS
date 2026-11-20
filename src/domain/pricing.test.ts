import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEmptyReturnDiscountPct,
  estimateIntercityReference,
  estimateUrbanRide,
  validateIntercityQuotePrice,
  validatePriceRevision,
  validateUrbanOfferPrice,
} from './pricing';
import type { PricingRule } from './types';

const mediumTruckRule: PricingRule = {
  vehicleCategory: 'medium_truck',
  baseFareDzd: 4000,
  perKmDzd: 700,
  perFloorDzd: 500,
  porterUnitDzd: 2400,
  minPriceDzd: 4000,
  intercityBaseDzd: 6000,
  intercityPerKmDzd: 55,
};

test('computeEmptyReturnDiscountPct retourne la remise réelle, jamais plus de 100', () => {
  assert.equal(computeEmptyReturnDiscountPct(30000, 40000), 25);
  assert.equal(computeEmptyReturnDiscountPct(34000, 40000), 15);
  assert.equal(computeEmptyReturnDiscountPct(44000, 40000), 0);
  assert.equal(computeEmptyReturnDiscountPct(1000, 0), 0);
});

const defaultSettings = {
  floorMultiplier: 0.85,
  capMultiplier: 2.5,
  intercityFloorMultiplier: 0.85,
  intercityCapMultiplier: 1.8,
  emptyReturnDiscountMaxPct: 25,
  groupageDiscountMaxPct: 35,
};

test('urban moving estimate matches CDC §8.1 worked example', () => {
  const est = estimateUrbanRide(
    {
      serviceType: 'moving',
      vehicleCategory: 'medium_truck',
      pickupLat: 35.6971,
      pickupLng: -0.6308,
      dropoffLat: 35.711,
      dropoffLng: -0.641,
      roadDistanceKm: 8.4,
      floorFrom: 3,
      floorTo: 0,
      hasElevatorFrom: false,
      hasElevatorTo: true,
      portersCount: 2,
    },
    mediumTruckRule,
    defaultSettings
  );

  // 4000 + 5880 + 1500 + 4800 = 16180 -> ceil to 500 = 16500
  assert.equal(est.estimatedPriceDzd, 16500);
  assert.equal(est.priceFloorDzd, 14000);
  assert.equal(est.priceCapDzd, 41500);
  assert.equal(est.distanceKm, 8.4);
});

test('urban waste removal works without dropoff and adds 3000 DA dump fee', () => {
  const est = estimateUrbanRide(
    {
      serviceType: 'waste_removal',
      vehicleCategory: 'medium_truck',
      pickupLat: 35.6971,
      pickupLng: -0.6308,
      dropoffLat: null,
      dropoffLng: null,
      floorFrom: 0,
      floorTo: null,
      hasElevatorFrom: false,
      hasElevatorTo: false,
      portersCount: 1,
    },
    mediumTruckRule,
    defaultSettings
  );

  // 4000 + (700 * 8 = 5600) + 2400 + 3000 = 15000
  assert.equal(est.estimatedPriceDzd, 15000);
  assert.equal(est.isApproximateDistance, true);
});

test('urban offer price validation enforces [floor, cap]', () => {
  assert.equal(validateUrbanOfferPrice(16000, 14000, 41500).valid, true);
  assert.equal(validateUrbanOfferPrice(12000, 14000, 41500).valid, false);
  assert.equal(validateUrbanOfferPrice(50000, 14000, 41500).valid, false);
});

test('intercity Oran -> Alger 432 km reference price matches CDC §8.5', () => {
  const est = estimateIntercityReference(
    {
      vehicleCategory: 'medium_truck',
      distanceKm: 432,
      axisCoefficient: 1.0,
      portersCount: 0,
      floorFrom: 0,
      floorTo: 0,
      hasElevatorFrom: false,
      hasElevatorTo: false,
      needsDisassembly: false,
      needsPacking: false,
    },
    mediumTruckRule,
    defaultSettings
  );

  // 6000 + (55 * 432 = 23760) = 29760 -> rounded to 500 = 30000
  assert.equal(est.refPriceDzd, 30000);
  assert.equal(est.priceFloorDzd, 25500);
  assert.equal(est.priceCapDzd, 54000);
});

test('intercity quote validation allows empty return discount up to -25%', () => {
  const normalReject = validateIntercityQuotePrice(
    23000,
    30000,
    { isEmptyReturn: false, isGroupage: false },
    defaultSettings
  );
  assert.equal(normalReject.valid, false);

  const emptyReturnOk = validateIntercityQuotePrice(
    23000,
    30000,
    { isEmptyReturn: true, isGroupage: false },
    defaultSettings
  );
  assert.equal(emptyReturnOk.valid, true);
});

test('price revision enforces +30% cap (CDC T28)', () => {
  const tooHigh = validatePriceRevision(30000, 45000, 30);
  assert.equal(tooHigh.valid, false);
  assert.equal(tooHigh.maxAllowedDzd, 39000);

  const ok = validatePriceRevision(30000, 38000, 30);
  assert.equal(ok.valid, true);
});

test('specialized services refrigerated (+20%) and towing (+25%) adjust urban and intercity prices', () => {
  const baseUrban = estimateUrbanRide(
    {
      serviceType: 'moving',
      vehicleCategory: 'medium_truck',
      pickupLat: 35.6971,
      pickupLng: -0.6308,
      dropoffLat: 35.711,
      dropoffLng: -0.641,
      roadDistanceKm: 10,
      floorFrom: 0,
      floorTo: 0,
      hasElevatorFrom: true,
      hasElevatorTo: true,
      portersCount: 0,
    },
    mediumTruckRule,
    defaultSettings
  );
  const coldUrban = estimateUrbanRide(
    {
      serviceType: 'refrigerated',
      vehicleCategory: 'medium_truck',
      pickupLat: 35.6971,
      pickupLng: -0.6308,
      dropoffLat: 35.711,
      dropoffLng: -0.641,
      roadDistanceKm: 10,
      floorFrom: 0,
      floorTo: 0,
      hasElevatorFrom: true,
      hasElevatorTo: true,
      portersCount: 0,
    },
    mediumTruckRule,
    defaultSettings
  );
  const towUrban = estimateUrbanRide(
    {
      serviceType: 'towing',
      vehicleCategory: 'medium_truck',
      pickupLat: 35.6971,
      pickupLng: -0.6308,
      dropoffLat: 35.711,
      dropoffLng: -0.641,
      roadDistanceKm: 10,
      floorFrom: 0,
      floorTo: 0,
      hasElevatorFrom: true,
      hasElevatorTo: true,
      portersCount: 0,
    },
    mediumTruckRule,
    defaultSettings
  );
  assert.ok(coldUrban.estimatedPriceDzd > baseUrban.estimatedPriceDzd);
  assert.ok(towUrban.estimatedPriceDzd > coldUrban.estimatedPriceDzd);

  const coldIntercity = estimateIntercityReference(
    {
      serviceType: 'refrigerated',
      vehicleCategory: 'medium_truck',
      distanceKm: 432,
      axisCoefficient: 1.0,
      portersCount: 0,
      floorFrom: 0,
      floorTo: 0,
      hasElevatorFrom: true,
      hasElevatorTo: true,
      needsDisassembly: false,
      needsPacking: false,
    },
    mediumTruckRule,
    defaultSettings
  );
  const towIntercity = estimateIntercityReference(
    {
      serviceType: 'towing',
      vehicleCategory: 'medium_truck',
      distanceKm: 432,
      axisCoefficient: 1.0,
      portersCount: 0,
      floorFrom: 0,
      floorTo: 0,
      hasElevatorFrom: true,
      hasElevatorTo: true,
      needsDisassembly: false,
      needsPacking: false,
    },
    mediumTruckRule,
    defaultSettings
  );
  assert.equal(coldIntercity.refPriceDzd, 36000);
  assert.equal(towIntercity.refPriceDzd, 37500);
});

