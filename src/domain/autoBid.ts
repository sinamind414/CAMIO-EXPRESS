import { roundTo500 } from './pricing';
import type { AutoBidConfig, DriverProfile, Ride, RideOffer, VehicleCategory } from './types';

export const AUTO_BID_RETRACT_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

export const DEFAULT_AUTO_BID_CONFIG: AutoBidConfig = {
  enabled: false,
  ratePerKmDzd: 1400,
  minFloorPriceDzd: 12000,
  maxDistanceKm: 35,
  serviceTypes: ['moving', 'freight'],
  acceptSmallerLoads: true,
  message: 'Offre automatique · Disponible immédiatement',
};

const VEHICLE_CAPACITY_RANK: Record<VehicleCategory, number> = {
  motorcycle: 0, tow_truck: 5, sedan: 0, mpv: 1, van: 2, pickup_bak: 2, pickup_box: 3, engkel_box: 4, engkel_bak: 4, cdd_bak: 5, cdd_box: 5, tipper: 4,
  small_van: 2, utility_van: 3, medium_truck: 4, large_truck: 5,
};

export function isVehicleCompatibleForAutoBid(
  driverCategory: VehicleCategory,
  requestedCategory: VehicleCategory,
  acceptSmallerLoads = true
): boolean {
  if (driverCategory === requestedCategory) return true;
  if (!acceptSmallerLoads) return false;
  if (driverCategory === 'tipper' || requestedCategory === 'tipper') return false;
  return VEHICLE_CAPACITY_RANK[driverCategory] >= VEHICLE_CAPACITY_RANK[requestedCategory];
}

export interface AutoBidEvaluation {
  compatible: boolean;
  priceDzd?: number;
  reason?: string;
}

export function evaluateAutoBidForRide(
  ride: Pick<
    Ride,
    'status' | 'serviceType' | 'vehicleCategory' | 'distanceKm' | 'portersCount' | 'priceFloorDzd' | 'priceCapDzd'
  >,
  driver: Pick<DriverProfile, 'status' | 'isOnline' | 'vehicle'> & { autoBidConfig?: AutoBidConfig }
): AutoBidEvaluation {
  const cfg = driver.autoBidConfig;
  if (!cfg || !cfg.enabled) {
    return { compatible: false, reason: 'AUTO_BID_DISABLED' };
  }
  if (ride.status !== 'searching') {
    return { compatible: false, reason: 'RIDE_NOT_SEARCHING' };
  }
  if (driver.status !== 'approved' || !driver.isOnline) {
    return { compatible: false, reason: 'DRIVER_UNAVAILABLE' };
  }
  if (!cfg.serviceTypes.includes(ride.serviceType)) {
    return { compatible: false, reason: 'SERVICE_MISMATCH' };
  }
  if (ride.distanceKm > cfg.maxDistanceKm) {
    return { compatible: false, reason: 'DISTANCE_EXCEEDED' };
  }
  if (!isVehicleCompatibleForAutoBid(driver.vehicle.category, ride.vehicleCategory, cfg.acceptSmallerLoads ?? true)) {
    return { compatible: false, reason: 'VEHICLE_MISMATCH' };
  }
  if (cfg.minFloorPriceDzd > ride.priceCapDzd) {
    return { compatible: false, reason: 'FLOOR_ABOVE_CAP' };
  }

  const portersComponent = ride.portersCount * 2000;
  const computed = roundTo500(ride.distanceKm * cfg.ratePerKmDzd + portersComponent);
  const withFloor = Math.max(cfg.minFloorPriceDzd, computed);
  const clamped = Math.min(ride.priceCapDzd, Math.max(ride.priceFloorDzd, withFloor));

  return { compatible: true, priceDzd: clamped };
}

export function getOfferRetractStatus(
  offer: Pick<RideOffer, 'status' | 'retractableUntil' | 'createdAt'>,
  nowMs = Date.now()
): { canRetract: boolean; remainingMs: number; remainingLabel: string } {
  if (offer.status !== 'pending') {
    return { canRetract: false, remainingMs: 0, remainingLabel: '0:00' };
  }
  const deadlineMs = offer.retractableUntil
    ? new Date(offer.retractableUntil).getTime()
    : new Date(offer.createdAt).getTime() + AUTO_BID_RETRACT_WINDOW_MS;

  if (!Number.isFinite(deadlineMs)) {
    return { canRetract: false, remainingMs: 0, remainingLabel: '0:00' };
  }

  const remainingMs = Math.max(0, deadlineMs - nowMs);
  const totalSec = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const remainingLabel = `${mins}:${String(secs).padStart(2, '0')}`;

  return {
    canRetract: remainingMs > 0,
    remainingMs,
    remainingLabel,
  };
}

export interface AutoBidMatchPreview {
  rideId: string;
  rideCode: string;
  distanceKm: number;
  estimatedOfferDzd: number;
  alreadyOffered: boolean;
}

export function previewAutoBidMatches(
  rides: Ride[],
  driver: Pick<DriverProfile, 'id' | 'status' | 'isOnline' | 'vehicle'>,
  draftConfig: AutoBidConfig
): AutoBidMatchPreview[] {
  const simulatedDriver = {
    status: driver.status,
    isOnline: true, // evaluate rule compatibility even if driver is temporarily offline
    vehicle: driver.vehicle,
    autoBidConfig: { ...draftConfig, enabled: true },
  };

  const matches: AutoBidMatchPreview[] = [];
  for (const ride of rides) {
    if (ride.status !== 'searching') continue;
    const evalRes = evaluateAutoBidForRide(ride, simulatedDriver);
    if (!evalRes.compatible || evalRes.priceDzd == null) continue;
    const alreadyOffered = ride.offers.some(
      (o) => o.driverId === driver.id && o.status === 'pending'
    );
    matches.push({
      rideId: ride.id,
      rideCode: ride.rideCode,
      distanceKm: ride.distanceKm,
      estimatedOfferDzd: evalRes.priceDzd,
      alreadyOffered,
    });
  }
  return matches;
}

