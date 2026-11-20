import { VEHICLE_LABELS } from './i18n';
import { estimateIntercityReference, estimateUrbanRide, haversineKm, roundTo500 } from './pricing';
import type {
  AppSettings,
  PriceBreakdownItem,
  PricingRule,
  RouteMatrixEntry,
  VehicleCategory,
  Wilaya,
} from './types';

export type SimulatorServiceType = 'moving' | 'freight' | 'refrigerated' | 'towing';
export type SimulatorMode = 'urban' | 'intercity';

export interface VehicleRecommendation {
  vehicleCategory: VehicleCategory;
  capacityM3: number;
  fillRatioPct: number;
  exceedsSingleTruck: boolean;
}

export interface WilayaDistanceResolution {
  distanceKm: number;
  axisCoefficient: number;
  durationMinEst: number;
  source: 'matrix' | 'haversine' | 'same_wilaya';
}

export interface IntercityVehicleTierComparison {
  vehicleCategory: VehicleCategory;
  capacityM3: number;
  intercityBaseDzd: number;
  intercityPerKmDzd: number;
  estimatedPriceDzd: number;
  isRecommended: boolean;
  isSufficientCapacity: boolean;
}

export interface PriceSimulationInput {
  mode: SimulatorMode;
  serviceType: SimulatorServiceType;
  distanceKm: number;
  volumeM3: number;
  axisCoefficient?: number;
  portersCount?: number;
  floorsNoElevator?: number;
  needsPacking?: boolean;
  vehicleCategoryOverride?: VehicleCategory;
}

export interface PriceSimulationResult {
  mode: SimulatorMode;
  serviceType: SimulatorServiceType;
  distanceKm: number;
  volumeM3: number;
  axisCoefficient: number;
  portersCount: number;
  floorsNoElevator: number;
  vehicleCategory: VehicleCategory;
  estimatedPriceDzd: number;
  priceFloorDzd: number;
  priceCapDzd: number;
  durationMinEst: number;
  recommendation: VehicleRecommendation;
  breakdown: PriceBreakdownItem[];
}

export function clampVolumeM3(volumeM3: number): number {
  if (!Number.isFinite(volumeM3)) return 8;
  return Math.min(30, Math.max(1, Math.round(volumeM3 * 10) / 10));
}

export function clampDistanceKm(distanceKm: number, mode: SimulatorMode): number {
  const fallback = mode === 'urban' ? 12 : 432;
  if (!Number.isFinite(distanceKm)) return fallback;
  const min = mode === 'urban' ? 2 : 30;
  const max = mode === 'urban' ? 120 : 1800;
  return Math.min(max, Math.max(min, Math.round(distanceKm * 10) / 10));
}

export function resolveWilayaDistance(
  fromCode: number,
  toCode: number,
  wilayas: Wilaya[],
  routeMatrix: RouteMatrixEntry[]
): WilayaDistanceResolution {
  if (fromCode === toCode) {
    return {
      distanceKm: 30,
      axisCoefficient: 1.0,
      durationMinEst: 45,
      source: 'same_wilaya',
    };
  }

  const direct = routeMatrix.find(
    (r) => r.fromWilaya === fromCode && r.toWilaya === toCode && r.isActive
  );
  const reverse = !direct
    ? routeMatrix.find((r) => r.fromWilaya === toCode && r.toWilaya === fromCode && r.isActive)
    : undefined;
  const matched = direct ?? reverse;

  if (matched) {
    return {
      distanceKm: matched.distanceKm,
      axisCoefficient: matched.axisCoefficient,
      durationMinEst: matched.durationMin,
      source: 'matrix',
    };
  }

  const fromW = wilayas.find((w) => w.code === fromCode);
  const toW = wilayas.find((w) => w.code === toCode);
  if (fromW && toW) {
    const straightKm = haversineKm(fromW.lat, fromW.lng, toW.lat, toW.lng);
    // Road detour factor (~1.25x straight-line distance across Algeria highway network)
    const roadKm = Math.max(30, Math.round((straightKm * 1.25) / 5) * 5);
    return {
      distanceKm: roadKm,
      axisCoefficient: 1.0,
      durationMinEst: Math.max(45, Math.round((roadKm / 72) * 60)),
      source: 'haversine',
    };
  }

  return {
    distanceKm: 432,
    axisCoefficient: 1.0,
    durationMinEst: 315,
    source: 'haversine',
  };
}

export function recommendVehicleForVolume(volumeM3: number): VehicleRecommendation {
  const safeVol = clampVolumeM3(volumeM3);
  let vehicleCategory: VehicleCategory = 'large_truck';
  if (safeVol <= VEHICLE_LABELS.small_van.volM3) {
    vehicleCategory = 'small_van';
  } else if (safeVol <= VEHICLE_LABELS.utility_van.volM3) {
    vehicleCategory = 'utility_van';
  } else if (safeVol <= VEHICLE_LABELS.medium_truck.volM3) {
    vehicleCategory = 'medium_truck';
  }

  const capacityM3 = VEHICLE_LABELS[vehicleCategory].volM3;
  const fillRatioPct = Math.min(100, Math.round((safeVol / capacityM3) * 100));
  const exceedsSingleTruck = safeVol > VEHICLE_LABELS.large_truck.volM3;

  return {
    vehicleCategory,
    capacityM3,
    fillRatioPct,
    exceedsSingleTruck,
  };
}

export function defaultPortersForSimulation(
  serviceType: SimulatorServiceType,
  volumeM3: number
): number {
  if (serviceType === 'freight' || serviceType === 'towing') return 0;
  if (serviceType === 'refrigerated') return 1;
  const safeVol = clampVolumeM3(volumeM3);
  if (safeVol <= 4) return 1;
  if (safeVol <= 12) return 2;
  return 3;
}

export function simulateTripPrice(
  input: PriceSimulationInput,
  pricingRules: PricingRule[],
  settings: Pick<
    AppSettings,
    'floorMultiplier' | 'capMultiplier' | 'intercityFloorMultiplier' | 'intercityCapMultiplier'
  >
): PriceSimulationResult {
  const volumeM3 = clampVolumeM3(input.volumeM3);
  const distanceKm = clampDistanceKm(input.distanceKm, input.mode);
  const axisCoefficient = input.axisCoefficient && input.axisCoefficient > 0 ? input.axisCoefficient : 1.0;
  const baseRecommendation = recommendVehicleForVolume(volumeM3);
  const activeVehicleCategory = input.vehicleCategoryOverride ?? baseRecommendation.vehicleCategory;
  const activeCapacityM3 = VEHICLE_LABELS[activeVehicleCategory].volM3;
  const recommendation: VehicleRecommendation = input.vehicleCategoryOverride
    ? {
        vehicleCategory: activeVehicleCategory,
        capacityM3: activeCapacityM3,
        fillRatioPct: Math.min(100, Math.round((volumeM3 / activeCapacityM3) * 100)),
        exceedsSingleTruck: volumeM3 > activeCapacityM3,
      }
    : baseRecommendation;

  const portersCount =
    input.portersCount != null
      ? Math.min(4, Math.max(0, Math.round(input.portersCount)))
      : defaultPortersForSimulation(input.serviceType, volumeM3);
  const floorsNoElevator =
    input.floorsNoElevator != null
      ? Math.min(12, Math.max(0, Math.round(input.floorsNoElevator)))
      : 0;

  const rule =
    pricingRules.find((r) => r.vehicleCategory === activeVehicleCategory) ??
    pricingRules[1] ??
    pricingRules[0];

  if (input.mode === 'urban') {
    const urban = estimateUrbanRide(
      {
        serviceType: input.serviceType,
        vehicleCategory: activeVehicleCategory,
        pickupLat: 35.6971,
        pickupLng: -0.6308,
        dropoffLat: 35.711,
        dropoffLng: -0.641,
        roadDistanceKm: distanceKm,
        floorFrom: floorsNoElevator,
        floorTo: 0,
        hasElevatorFrom: false,
        hasElevatorTo: true,
        portersCount,
      },
      rule,
      {
        floorMultiplier: settings.floorMultiplier,
        capMultiplier: settings.capMultiplier,
      }
    );

    return {
      mode: input.mode,
      serviceType: input.serviceType,
      distanceKm,
      volumeM3,
      axisCoefficient: 1.0,
      portersCount,
      floorsNoElevator,
      vehicleCategory: activeVehicleCategory,
      estimatedPriceDzd: urban.estimatedPriceDzd,
      priceFloorDzd: urban.priceFloorDzd,
      priceCapDzd: urban.priceCapDzd,
      durationMinEst: urban.durationMinEst,
      recommendation,
      breakdown: urban.breakdown,
    };
  }

  const intercity = estimateIntercityReference(
    {
      serviceType: input.serviceType,
      vehicleCategory: activeVehicleCategory,
      distanceKm,
      axisCoefficient,
      portersCount,
      floorFrom: floorsNoElevator,
      floorTo: 0,
      hasElevatorFrom: false,
      hasElevatorTo: true,
      needsDisassembly: input.serviceType === 'moving' && volumeM3 > 4,
      needsPacking: Boolean(input.needsPacking),
    },
    rule,
    {
      intercityFloorMultiplier: settings.intercityFloorMultiplier,
      intercityCapMultiplier: settings.intercityCapMultiplier,
    }
  );

  const durationMinEst = Math.max(45, Math.round((distanceKm / 70) * 60 + portersCount * 15));

  return {
    mode: input.mode,
    serviceType: input.serviceType,
    distanceKm,
    volumeM3,
    axisCoefficient,
    portersCount,
    floorsNoElevator,
    vehicleCategory: activeVehicleCategory,
    estimatedPriceDzd: intercity.refPriceDzd,
    priceFloorDzd: intercity.priceFloorDzd,
    priceCapDzd: intercity.priceCapDzd,
    durationMinEst,
    recommendation,
    breakdown: intercity.breakdown,
  };
}

const MOVING_VEHICLE_TIERS: VehicleCategory[] = [
  'small_van',
  'utility_van',
  'medium_truck',
  'large_truck',
];

export function compareIntercityVehiclesByRules(
  input: Omit<PriceSimulationInput, 'mode' | 'vehicleCategoryOverride'>,
  pricingRules: PricingRule[],
  settings: Pick<
    AppSettings,
    'floorMultiplier' | 'capMultiplier' | 'intercityFloorMultiplier' | 'intercityCapMultiplier'
  >
): IntercityVehicleTierComparison[] {
  const recommended = recommendVehicleForVolume(input.volumeM3).vehicleCategory;
  const safeVol = clampVolumeM3(input.volumeM3);

  return MOVING_VEHICLE_TIERS.map((category) => {
    const rule =
      pricingRules.find((r) => r.vehicleCategory === category) ??
      pricingRules[1] ??
      pricingRules[0];
    const sim = simulateTripPrice(
      {
        ...input,
        mode: 'intercity',
        vehicleCategoryOverride: category,
      },
      pricingRules,
      settings
    );
    const capacityM3 = VEHICLE_LABELS[category].volM3;

    return {
      vehicleCategory: category,
      capacityM3,
      intercityBaseDzd: rule.intercityBaseDzd,
      intercityPerKmDzd: rule.intercityPerKmDzd,
      estimatedPriceDzd: sim.estimatedPriceDzd,
      isRecommended: category === recommended,
      isSufficientCapacity: capacityM3 >= safeVol,
    };
  });
}
