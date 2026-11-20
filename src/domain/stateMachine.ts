import { distanceMeters } from './pricing';
import type {
  DateFlexibility,
  IntercityQuote,
  IntercityStatus,
  RideStatus,
  Subscription,
  SubscriptionStatus,
} from './types';

export const URBAN_TRANSITIONS: Record<
  RideStatus,
  Array<{ to: RideStatus; actors: Array<'client' | 'driver' | 'admin' | 'system'> }>
> = {
  draft: [{ to: 'searching', actors: ['client'] }],
  searching: [
    { to: 'assigned', actors: ['client'] },
    { to: 'cancelled_client', actors: ['client', 'admin'] },
    { to: 'expired', actors: ['system'] },
  ],
  assigned: [
    { to: 'driver_arriving', actors: ['driver', 'admin'] },
    { to: 'cancelled_client', actors: ['client', 'admin'] },
    { to: 'cancelled_driver', actors: ['driver', 'admin'] },
  ],
  driver_arriving: [
    { to: 'arrived_pickup', actors: ['driver', 'admin'] },
    { to: 'cancelled_client', actors: ['client', 'admin'] },
    { to: 'cancelled_driver', actors: ['driver', 'admin'] },
  ],
  arrived_pickup: [
    { to: 'loading', actors: ['driver', 'admin'] },
    { to: 'cancelled_client', actors: ['client', 'admin'] },
    { to: 'cancelled_driver', actors: ['driver', 'admin'] },
  ],
  loading: [
    { to: 'in_transit', actors: ['driver', 'admin'] },
    { to: 'disputed', actors: ['client', 'admin'] },
  ],
  in_transit: [
    { to: 'arrived_dropoff', actors: ['driver', 'admin'] },
    { to: 'completed', actors: ['driver', 'admin'] },
    { to: 'disputed', actors: ['client', 'admin'] },
  ],
  arrived_dropoff: [
    { to: 'completed', actors: ['driver', 'admin'] },
    { to: 'disputed', actors: ['client', 'admin'] },
  ],
  completed: [
    { to: 'rated', actors: ['client'] },
    { to: 'disputed', actors: ['client', 'admin'] },
  ],
  rated: [{ to: 'disputed', actors: ['client', 'admin'] }],
  cancelled_client: [],
  cancelled_driver: [],
  expired: [],
  disputed: [{ to: 'completed', actors: ['admin'] }],
};

export function canTransitionUrbanRide(params: {
  from: RideStatus;
  to: RideStatus;
  actor: 'client' | 'driver' | 'admin' | 'system';
  driverPos?: { lat: number; lng: number };
  pickupPos?: { lat: number; lng: number };
  dropoffPos?: { lat: number; lng: number } | null;
  hasDropoff?: boolean;
}): { ok: boolean; code?: string; message?: string } {
  const { from, to, actor, driverPos, pickupPos, dropoffPos, hasDropoff } = params;

  if (actor === 'admin') {
    return { ok: true };
  }

  const allowed = URBAN_TRANSITIONS[from]?.find((t) => t.to === to);
  if (!allowed || !allowed.actors.includes(actor)) {
    if (to === 'cancelled_client' && (from === 'loading' || from === 'in_transit' || from === 'arrived_dropoff')) {
      return {
        ok: false,
        code: 'CANCELLATION_LOCKED',
        message: 'Annulation impossible après le début du chargement. Ouvrez un litige si nécessaire.',
      };
    }
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `Transition non autorisée (${from} → ${to})`,
    };
  }

  // Geofence rules (§5.7 & §7.2): arrived_pickup & arrived_dropoff require <= 300 m
  if (to === 'arrived_pickup' && driverPos && pickupPos) {
    const dist = distanceMeters(driverPos.lat, driverPos.lng, pickupPos.lat, pickupPos.lng);
    if (dist > 300) {
      return {
        ok: false,
        code: 'TOO_FAR_FROM_POINT',
        message: `Vous êtes à ${dist} m du point de départ (maximum 300 m requis).`,
      };
    }
  }

  if (to === 'arrived_dropoff' && hasDropoff && driverPos && dropoffPos) {
    const dist = distanceMeters(driverPos.lat, driverPos.lng, dropoffPos.lat, dropoffPos.lng);
    if (dist > 300) {
      return {
        ok: false,
        code: 'TOO_FAR_FROM_POINT',
        message: `Vous êtes à ${dist} m du point d'arrivée (maximum 300 m requis).`,
      };
    }
  }

  return { ok: true };
}

export const INTERCITY_TRANSITIONS: Record<
  IntercityStatus,
  Array<{ to: IntercityStatus; actors: Array<'client' | 'driver' | 'admin' | 'system'> }>
> = {
  draft: [{ to: 'collecting', actors: ['client'] }],
  collecting: [
    { to: 'quoted', actors: ['system'] },
    { to: 'cancelled_client', actors: ['client', 'admin'] },
    { to: 'expired', actors: ['system'] },
  ],
  quoted: [
    { to: 'booked', actors: ['client'] },
    { to: 'cancelled_client', actors: ['client', 'admin'] },
    { to: 'expired', actors: ['system'] },
  ],
  booked: [
    { to: 'in_progress', actors: ['driver', 'admin'] },
    { to: 'cancelled_client', actors: ['client', 'admin'] },
    { to: 'cancelled_driver', actors: ['driver', 'admin'] },
  ],
  in_progress: [
    { to: 'completed', actors: ['driver', 'admin'] },
    { to: 'disputed', actors: ['client', 'admin'] },
  ],
  completed: [
    { to: 'rated', actors: ['client'] },
    { to: 'disputed', actors: ['client', 'admin'] },
  ],
  rated: [{ to: 'disputed', actors: ['client', 'admin'] }],
  cancelled_client: [],
  cancelled_driver: [],
  expired: [],
  disputed: [{ to: 'completed', actors: ['admin'] }],
};

export function validateIntercityDate(
  preferredDateStr: string,
  todayStr: string,
  minLeadDays = 1,
  maxLeadDays = 60
): { ok: boolean; code?: string; message?: string } {
  const preferred = new Date(`${preferredDateStr}T00:00:00Z`);
  const today = new Date(`${todayStr}T00:00:00Z`);
  if (Number.isNaN(preferred.getTime())) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Date invalide' };
  }
  const diffDays = Math.round((preferred.getTime() - today.getTime()) / (24 * 3600 * 1000));
  if (diffDays < minLeadDays) {
    return {
      ok: false,
      code: 'MIN_LEAD_TIME',
      message: `La date doit être au minimum à J+${minLeadDays}.`,
    };
  }
  if (diffDays > maxLeadDays) {
    return {
      ok: false,
      code: 'MAX_LEAD_TIME',
      message: `La date ne peut pas dépasser J+${maxLeadDays}.`,
    };
  }
  return { ok: true };
}

export function isQuoteDateCompatible(
  preferredDateStr: string,
  availableDateStr: string,
  flexibility: DateFlexibility
): boolean {
  const pref = new Date(`${preferredDateStr}T00:00:00Z`).getTime();
  const avail = new Date(`${availableDateStr}T00:00:00Z`).getTime();
  const diffDays = Math.abs(Math.round((avail - pref) / (24 * 3600 * 1000)));

  switch (flexibility) {
    case 'fixed':
      return diffDays === 0;
    case 'plus_minus_1':
      return diffDays <= 1;
    case 'plus_minus_3':
      return diffDays <= 3;
    case 'flexible':
      return diffDays <= 14;
  }
}

/**
 * Ranks intercity quotes by the CDC §9.4 "Meilleure offre" formula:
 * 40% price + 30% intercity rating + 20% axis experience + 10% reactivity.
 */
export function rankIntercityQuotes(
  quotes: IntercityQuote[],
  refPriceDzd: number
): Array<IntercityQuote & { bestOfferScore: number; isLowPriceWarning: boolean }> {
  if (quotes.length === 0) return [];
  const floorRef = refPriceDzd * 0.7;
  const capRef = refPriceDzd * 1.8;
  const refSpan = Math.max(1, capRef - floorRef);

  return quotes
    .map((q) => {
      const clampedPrice = Math.max(floorRef, Math.min(capRef, q.priceDzd));
      const priceScore = 1 - (clampedPrice - floorRef) / refSpan;
      const ratingScore = q.driverIntercityCount > 0 ? q.driverIntercityRating / 5 : 0.6;
      const expScore = Math.min(1, q.axisExperienceCount / 10);
      const reactScore = Math.max(0, 1 - q.responseMinutes / 720);
      const bestOfferScore = Number(
        (0.4 * priceScore + 0.3 * ratingScore + 0.2 * expScore + 0.1 * reactScore).toFixed(4)
      );
      const isLowPriceWarning = q.priceDzd < refPriceDzd * 0.7;
      return { ...q, bestOfferScore, isLowPriceWarning };
    })
    .sort((a, b) => b.bestOfferScore - a.bestOfferScore);
}

export function addDaysIsoDate(isoDate: string, days: number): string {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function computeSubscriptionExtension(
  currentEndsOn: string,
  periodDays: number,
  todayStr: string,
  graceDays = 3
): { startsOn: string; endsOn: string; graceUntil: string } {
  const baseDate = currentEndsOn > todayStr ? currentEndsOn : todayStr;
  const startsOn = currentEndsOn > todayStr ? addDaysIsoDate(currentEndsOn, 1) : todayStr;
  const endsOn = addDaysIsoDate(baseDate, periodDays);
  const graceUntil = addDaysIsoDate(endsOn, graceDays);
  return { startsOn, endsOn, graceUntil };
}

export function computeSubscriptionStatus(
  sub: Pick<Subscription, 'endsOn' | 'graceUntil' | 'status'>,
  todayStr: string
): { status: SubscriptionStatus; daysLeft: number; canReceiveRides: boolean } {
  if (sub.status === 'cancelled') {
    return { status: 'cancelled', daysLeft: 0, canReceiveRides: false };
  }
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  const endsMs = new Date(`${sub.endsOn}T00:00:00Z`).getTime();
  const graceMs = new Date(`${sub.graceUntil}T00:00:00Z`).getTime();

  const daysLeft = Math.ceil((endsMs - todayMs) / (24 * 3600 * 1000));
  if (todayMs <= endsMs) {
    return { status: 'active', daysLeft, canReceiveRides: true };
  }
  if (todayMs <= graceMs) {
    return { status: 'grace', daysLeft: 0, canReceiveRides: true };
  }
  return { status: 'expired', daysLeft: 0, canReceiveRides: false };
}
