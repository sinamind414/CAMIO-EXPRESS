import { haversineKm } from './pricing';
import type { IntercityRequest, IntercityStatus, Locale, RideLocation, RideStatus, Wilaya } from './types';

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface TrailPoint extends LatLngPoint {
  ts: string;
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export const ONGOING_TRACKING_STATUSES: ReadonlyArray<RideStatus> = [
  'assigned',
  'driver_arriving',
  'arrived_pickup',
  'loading',
  'in_transit',
  'arrived_dropoff',
];

export const INTERCITY_TRACKING_STATUSES: ReadonlyArray<IntercityStatus> = [
  'booked',
  'in_progress',
];

export function isOngoingTrackableRide(status: RideStatus): boolean {
  return ONGOING_TRACKING_STATUSES.includes(status);
}

export function isOngoingTrackableIntercity(status: IntercityStatus): boolean {
  return INTERCITY_TRACKING_STATUSES.includes(status);
}

export function resolveIntercityEndpoints(
  ic: Pick<IntercityRequest, 'fromWilaya' | 'toWilaya' | 'pickupAddress' | 'dropoffAddress'>,
  wilayas: Wilaya[]
): { pickup: RideLocation; dropoff: RideLocation; fromWilaya?: Wilaya; toWilaya?: Wilaya } {
  const fromW = wilayas.find((w) => w.code === ic.fromWilaya);
  const toW = wilayas.find((w) => w.code === ic.toWilaya);

  return {
    pickup: {
      address: ic.pickupAddress || (fromW ? fromW.nameFr : `Wilaya ${ic.fromWilaya}`),
      lat: fromW?.lat ?? 35.6971,
      lng: fromW?.lng ?? -0.6308,
    },
    dropoff: {
      address: ic.dropoffAddress || (toW ? toW.nameFr : `Wilaya ${ic.toWilaya}`),
      lat: toW?.lat ?? 36.7538,
      lng: toW?.lng ?? 3.0588,
    },
    fromWilaya: fromW,
    toWilaya: toW,
  };
}

export function findCorridorWilayas(
  fromCode: number,
  toCode: number,
  wilayas: Wilaya[]
): Wilaya[] {
  const fromW = wilayas.find((w) => w.code === fromCode);
  const toW = wilayas.find((w) => w.code === toCode);
  if (!fromW || !toW) return [];

  const totalDirectKm = haversineKm(fromW.lat, fromW.lng, toW.lat, toW.lng);
  if (totalDirectKm < 25) return [];

  return wilayas
    .filter((w) => {
      if (!w.isActive || w.code === fromCode || w.code === toCode) return false;
      const d1 = haversineKm(fromW.lat, fromW.lng, w.lat, w.lng);
      const d2 = haversineKm(w.lat, w.lng, toW.lat, toW.lng);
      // Lies closely along the highway corridor between origin and destination
      return d1 + d2 <= totalDirectKm * 1.14;
    })
    .sort(
      (a, b) =>
        haversineKm(fromW.lat, fromW.lng, a.lat, a.lng) -
        haversineKm(fromW.lat, fromW.lng, b.lat, b.lng)
    );
}

export function formatEtaDuration(minutes: number, locale: Locale): string {
  const safeMin = Math.max(1, Math.round(minutes));
  if (safeMin < 60) {
    return locale === 'ar' ? `~${safeMin} د` : `~${safeMin} min`;
  }
  const h = Math.floor(safeMin / 60);
  const m = safeMin % 60;
  if (locale === 'ar') {
    return m > 0 ? `~${h} س ${m} د` : `~${h} س`;
  }
  return m > 0 ? `~${h}h ${String(m).padStart(2, '0')}` : `~${h}h`;
}

export function computeBearingDeg(from: LatLngPoint, to: LatLngPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);

  if (Math.abs(from.lat - to.lat) < 1e-7 && Math.abs(from.lng - to.lng) < 1e-7) {
    return 0;
  }

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return Math.round(bearing);
}

export function computeMapBounds(points: LatLngPoint[], paddingFactor = 0.25): MapBounds {
  if (points.length === 0) {
    return { minLat: 35.65, maxLat: 35.72, minLng: -0.66, maxLng: -0.60 };
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const rawMinLat = Math.min(...lats);
  const rawMaxLat = Math.max(...lats);
  const rawMinLng = Math.min(...lngs);
  const rawMaxLng = Math.max(...lngs);

  const latSpan = Math.max(0.015, rawMaxLat - rawMinLat);
  const lngSpan = Math.max(0.018, rawMaxLng - rawMinLng);

  return {
    minLat: rawMinLat - latSpan * paddingFactor,
    maxLat: rawMaxLat + latSpan * paddingFactor,
    minLng: rawMinLng - lngSpan * paddingFactor,
    maxLng: rawMaxLng + lngSpan * paddingFactor,
  };
}

export function projectLatLng(
  point: LatLngPoint,
  bounds: MapBounds
): { x: number; y: number } {
  const lngSpan = Math.max(0.001, bounds.maxLng - bounds.minLng);
  const latSpan = Math.max(0.001, bounds.maxLat - bounds.minLat);

  const normX = (point.lng - bounds.minLng) / lngSpan;
  const normY = (point.lat - bounds.minLat) / latSpan;

  const x = 14 + Math.min(1, Math.max(0, normX)) * 72;
  const y = 62 - Math.min(1, Math.max(0, normY)) * 40;

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  };
}

export function appendTrailPoint(
  trail: TrailPoint[],
  next: TrailPoint,
  maxPoints = 25
): TrailPoint[] {
  const last = trail[trail.length - 1];
  if (
    last &&
    Math.abs(last.lat - next.lat) < 1e-6 &&
    Math.abs(last.lng - next.lng) < 1e-6
  ) {
    return trail;
  }
  const updated = [...trail, next];
  return updated.length > maxPoints ? updated.slice(updated.length - maxPoints) : updated;
}

export interface LiveTripTelemetry {
  phase: 'to_pickup' | 'at_pickup' | 'to_dropoff' | 'arrived';
  remainingKm: number;
  etaMinutes: number;
  progressPct: number;
  targetAddress: string;
}

export function computeLiveTripTelemetry(params: {
  status: RideStatus;
  pickup: RideLocation;
  dropoff: RideLocation | null;
  driverPos: { lat: number; lng: number; speedKmh?: number } | null | undefined;
  routeDistanceKm: number;
}): LiveTripTelemetry {
  const { status, pickup, dropoff, driverPos, routeDistanceKm } = params;

  if (status === 'arrived_dropoff' || status === 'completed' || status === 'rated') {
    return {
      phase: 'arrived',
      remainingKm: 0,
      etaMinutes: 0,
      progressPct: 100,
      targetAddress: dropoff?.address ?? pickup.address,
    };
  }

  if (status === 'arrived_pickup' || status === 'loading') {
    return {
      phase: 'at_pickup',
      remainingKm: 0,
      etaMinutes: 0,
      progressPct: status === 'loading' ? 50 : 35,
      targetAddress: pickup.address,
    };
  }

  const speed = Math.max(18, driverPos?.speedKmh ?? 32);

  if (status === 'in_transit') {
    if (!dropoff) {
      return {
        phase: 'to_dropoff',
        remainingKm: Number(Math.max(1, routeDistanceKm * 0.5).toFixed(1)),
        etaMinutes: Math.max(2, Math.round(((routeDistanceKm * 0.5) / speed) * 60)),
        progressPct: 65,
        targetAddress: pickup.address,
      };
    }

    const totalLegKm = Math.max(0.5, routeDistanceKm || haversineKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng));
    const remKm = driverPos
      ? haversineKm(driverPos.lat, driverPos.lng, dropoff.lat, dropoff.lng)
      : totalLegKm;
    const clampedRem = Number(Math.min(totalLegKm * 1.3, remKm).toFixed(1));
    const eta = clampedRem <= 0.15 ? 1 : Math.max(1, Math.round((clampedRem / speed) * 60));
    const pct = Math.round(Math.min(98, Math.max(10, (1 - Math.min(1, remKm / totalLegKm)) * 100)));

    return {
      phase: 'to_dropoff',
      remainingKm: clampedRem,
      etaMinutes: eta,
      progressPct: pct,
      targetAddress: dropoff.address,
    };
  }

  // assigned or driver_arriving -> heading toward pickup
  const remKm = driverPos
    ? haversineKm(driverPos.lat, driverPos.lng, pickup.lat, pickup.lng)
    : 2.5;
  const roundedRem = Number(remKm.toFixed(1));
  const eta = roundedRem <= 0.15 ? 1 : Math.max(1, Math.round((roundedRem / speed) * 60));
  const pct = Math.round(Math.min(95, Math.max(8, (1 - Math.min(1, remKm / 5)) * 100)));

  return {
    phase: 'to_pickup',
    remainingKm: roundedRem,
    etaMinutes: eta,
    progressPct: pct,
    targetAddress: pickup.address,
  };
}

export function computeIntercityLiveTelemetry(params: {
  status: IntercityStatus;
  pickup: RideLocation;
  dropoff: RideLocation;
  driverPos: { lat: number; lng: number; speedKmh?: number } | null | undefined;
  routeDistanceKm: number;
}): LiveTripTelemetry {
  const { status, pickup, dropoff, driverPos, routeDistanceKm } = params;

  if (status === 'completed' || status === 'rated') {
    return {
      phase: 'arrived',
      remainingKm: 0,
      etaMinutes: 0,
      progressPct: 100,
      targetAddress: dropoff.address,
    };
  }

  const totalDirectKm = Math.max(1, haversineKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng));
  const totalRoadKm = Math.max(totalDirectKm, routeDistanceKm || totalDirectKm);
  const highwaySpeed = Math.max(40, driverPos?.speedKmh ?? 76);

  if (status === 'booked') {
    return {
      phase: 'at_pickup',
      remainingKm: Number(totalRoadKm.toFixed(1)),
      etaMinutes: Math.max(10, Math.round((totalRoadKm / highwaySpeed) * 60)),
      progressPct: 8,
      targetAddress: pickup.address,
    };
  }

  // in_progress -> heading along intercity corridor to dropoff wilaya
  const remDirectKm = driverPos
    ? haversineKm(driverPos.lat, driverPos.lng, dropoff.lat, dropoff.lng)
    : totalDirectKm;
  const ratioRemaining = Math.min(1.1, Math.max(0, remDirectKm / totalDirectKm));
  const scaledRemainingKm = Number(Math.min(totalRoadKm * 1.1, totalRoadKm * ratioRemaining).toFixed(1));
  const etaMinutes = scaledRemainingKm <= 1 ? 2 : Math.max(2, Math.round((scaledRemainingKm / highwaySpeed) * 60));
  const progressPct = Math.round(Math.min(98, Math.max(8, (1 - Math.min(1, ratioRemaining)) * 100)));

  return {
    phase: 'to_dropoff',
    remainingKm: scaledRemainingKm,
    etaMinutes,
    progressPct,
    targetAddress: dropoff.address,
  };
}

export function computeNextStepTowardsTarget(
  cur: LatLngPoint,
  target: LatLngPoint,
  stepRatio = 0.35
): { lat: number; lng: number; heading: number; speedKmh: number } {
  const distKm = haversineKm(cur.lat, cur.lng, target.lat, target.lng);
  const ratio = distKm < 0.25 ? 0.85 : stepRatio;
  const nextLat = Number((cur.lat + (target.lat - cur.lat) * ratio).toFixed(6));
  const nextLng = Number((cur.lng + (target.lng - cur.lng) * ratio).toFixed(6));
  const heading = computeBearingDeg(cur, target);
  const speedKmh =
    distKm >= 100
      ? 84
      : distKm >= 30
      ? 74
      : distKm < 0.3
      ? 18
      : distKm < 1.5
      ? 30
      : 42;

  return {
    lat: nextLat,
    lng: nextLng,
    heading,
    speedKmh,
  };
}
