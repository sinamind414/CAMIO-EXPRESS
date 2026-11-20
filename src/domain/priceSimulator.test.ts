import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareIntercityVehiclesByRules,
  recommendVehicleForVolume,
  resolveWilayaDistance,
  simulateTripPrice,
} from './priceSimulator';
import {
  SEED_PRICING_RULES,
  SEED_ROUTE_MATRIX,
  SEED_SETTINGS,
  SEED_WILAYAS,
} from './seedData';

test('recommendVehicleForVolume selects small_van, utility_van, medium_truck, and large_truck by m3 thresholds', () => {
  const small = recommendVehicleForVolume(3);
  assert.equal(small.vehicleCategory, 'small_van');
  assert.equal(small.capacityM3, 4);
  assert.equal(small.fillRatioPct, 75);
  assert.equal(small.exceedsSingleTruck, false);

  const utility = recommendVehicleForVolume(6);
  assert.equal(utility.vehicleCategory, 'utility_van');
  assert.equal(utility.capacityM3, 8);
  assert.equal(utility.fillRatioPct, 75);
  assert.equal(utility.exceedsSingleTruck, false);

  const medium = recommendVehicleForVolume(10);
  assert.equal(medium.vehicleCategory, 'medium_truck');
  assert.equal(medium.capacityM3, 12);
  assert.equal(medium.exceedsSingleTruck, false);

  const large = recommendVehicleForVolume(20);
  assert.equal(large.vehicleCategory, 'large_truck');
  assert.equal(large.capacityM3, 25);
  assert.equal(large.exceedsSingleTruck, false);

  const oversized = recommendVehicleForVolume(28);
  assert.equal(oversized.vehicleCategory, 'large_truck');
  assert.equal(oversized.exceedsSingleTruck, true);
});

test('resolveWilayaDistance uses routeMatrix (direct or reverse) and falls back to haversine road estimation', () => {
  const direct = resolveWilayaDistance(31, 16, SEED_WILAYAS, SEED_ROUTE_MATRIX);
  assert.equal(direct.source, 'matrix');
  assert.equal(direct.distanceKm, 432);
  assert.equal(direct.axisCoefficient, 1.0);

  const reverse = resolveWilayaDistance(25, 31, SEED_WILAYAS, SEED_ROUTE_MATRIX);
  assert.equal(reverse.source, 'matrix');
  assert.equal(reverse.distanceKm, 760);

  const withCoef = resolveWilayaDistance(31, 8, SEED_WILAYAS, SEED_ROUTE_MATRIX);
  assert.equal(withCoef.source, 'matrix');
  assert.equal(withCoef.distanceKm, 580);
  assert.equal(withCoef.axisCoefficient, 1.15);

  const computed = resolveWilayaDistance(16, 25, SEED_WILAYAS, SEED_ROUTE_MATRIX);
  assert.equal(computed.source, 'haversine');
  assert.ok(computed.distanceKm >= 350 && computed.distanceKm <= 450);
});

test('simulateTripPrice scales urban cost upward with distance and volume', () => {
  const shortSmall = simulateTripPrice(
    {
      mode: 'urban',
      serviceType: 'moving',
      distanceKm: 5,
      volumeM3: 3,
      portersCount: 1,
      floorsNoElevator: 0,
    },
    SEED_PRICING_RULES,
    SEED_SETTINGS
  );

  const longerMedium = simulateTripPrice(
    {
      mode: 'urban',
      serviceType: 'moving',
      distanceKm: 20,
      volumeM3: 10,
      portersCount: 2,
      floorsNoElevator: 2,
    },
    SEED_PRICING_RULES,
    SEED_SETTINGS
  );

  assert.equal(shortSmall.recommendation.vehicleCategory, 'small_van');
  assert.equal(longerMedium.recommendation.vehicleCategory, 'medium_truck');
  assert.ok(longerMedium.estimatedPriceDzd > shortSmall.estimatedPriceDzd);
  assert.ok(longerMedium.priceFloorDzd <= longerMedium.estimatedPriceDzd);
  assert.ok(longerMedium.priceCapDzd >= longerMedium.estimatedPriceDzd);
});

test('simulateTripPrice prices freight lower than moving for identical distance and volume', () => {
  const movingUrban = simulateTripPrice(
    {
      mode: 'urban',
      serviceType: 'moving',
      distanceKm: 15,
      volumeM3: 10,
      portersCount: 0,
      floorsNoElevator: 0,
    },
    SEED_PRICING_RULES,
    SEED_SETTINGS
  );

  const freightUrban = simulateTripPrice(
    {
      mode: 'urban',
      serviceType: 'freight',
      distanceKm: 15,
      volumeM3: 10,
      portersCount: 0,
      floorsNoElevator: 0,
    },
    SEED_PRICING_RULES,
    SEED_SETTINGS
  );

  assert.ok(freightUrban.estimatedPriceDzd < movingUrban.estimatedPriceDzd);

  const movingIntercity = simulateTripPrice(
    {
      mode: 'intercity',
      serviceType: 'moving',
      distanceKm: 432,
      volumeM3: 12,
    },
    SEED_PRICING_RULES,
    SEED_SETTINGS
  );

  const freightIntercity = simulateTripPrice(
    {
      mode: 'intercity',
      serviceType: 'freight',
      distanceKm: 432,
      volumeM3: 12,
    },
    SEED_PRICING_RULES,
    SEED_SETTINGS
  );

  assert.ok(freightIntercity.estimatedPriceDzd < movingIntercity.estimatedPriceDzd);
});

test('compareIntercityVehiclesByRules returns all 4 vehicle tiers priced from pricingRules', () => {
  const tiers = compareIntercityVehiclesByRules(
    {
      serviceType: 'moving',
      distanceKm: 432,
      volumeM3: 10,
      axisCoefficient: 1.0,
      portersCount: 2,
      floorsNoElevator: 2,
    },
    SEED_PRICING_RULES,
    SEED_SETTINGS
  );

  assert.equal(tiers.length, 4);
  assert.equal(tiers[0].vehicleCategory, 'small_van');
  assert.equal(tiers[0].intercityPerKmDzd, 45);
  assert.equal(tiers[0].isSufficientCapacity, false);
  assert.equal(tiers[2].vehicleCategory, 'medium_truck');
  assert.equal(tiers[2].intercityBaseDzd, 6000);
  assert.equal(tiers[2].intercityPerKmDzd, 55);
  assert.equal(tiers[2].isRecommended, true);
  assert.equal(tiers[2].isSufficientCapacity, true);
  assert.ok(tiers[3].estimatedPriceDzd > tiers[2].estimatedPriceDzd);
  assert.ok(tiers[2].estimatedPriceDzd > tiers[1].estimatedPriceDzd);
});
