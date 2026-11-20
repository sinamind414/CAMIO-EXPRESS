import type {
  AppSettings,
  DriverProfile,
  IntercityQuote,
  IntercityRequest,
  IntercityStatus,
  Ride,
  RideOffer,
  RideStatus,
} from './types';
import { computeSubscriptionStatus } from './stateMachine';

const URBAN_CONTACT_ALLOWED_STATUSES = new Set<RideStatus>([
  'assigned',
  'driver_arriving',
  'arrived_pickup',
  'loading',
  'in_transit',
  'arrived_dropoff',
  'completed',
  'rated',
  'disputed',
]);

const INTERCITY_CONTACT_ALLOWED_STATUSES = new Set<IntercityStatus>([
  'booked',
  'in_progress',
  'completed',
  'rated',
  'disputed',
]);

const TERMINAL_CLOSED_STATUSES = new Set<string>([
  'cancelled_client',
  'cancelled_driver',
  'expired',
]);

/**
 * CDC v2.1 C11 (§6.0.1, T34-T35):
 * Coordonnées strictement masquées avant acceptation d'une offre (`assigned` en urbain, `booked` en inter-wilaya).
 */
export function canRevealUrbanContact(status: RideStatus): boolean {
  return URBAN_CONTACT_ALLOWED_STATUSES.has(status);
}

export function canRevealIntercityContact(status: IntercityStatus): boolean {
  return INTERCITY_CONTACT_ALLOWED_STATUSES.has(status);
}

/**
 * CDC v2.1 C11 (§6.0.1, §12.4, T36):
 * Messagerie fermée avant acceptation tant que `chatEnabledBeforeAssignment` vaut `false`.
 */
export function canSendUrbanChat(
  status: RideStatus,
  settings: Pick<AppSettings, 'chatEnabledBeforeAssignment'>
): boolean {
  if (TERMINAL_CLOSED_STATUSES.has(status)) return false;
  if (canRevealUrbanContact(status)) return true;
  return Boolean(settings.chatEnabledBeforeAssignment) && status === 'searching';
}

export function canSendIntercityChat(
  status: IntercityStatus,
  settings: Pick<AppSettings, 'chatEnabledBeforeAssignment'>
): boolean {
  if (TERMINAL_CLOSED_STATUSES.has(status)) return false;
  if (canRevealIntercityContact(status)) return true;
  return Boolean(settings.chatEnabledBeforeAssignment) && (status === 'collecting' || status === 'quoted');
}

/**
 * CDC v2.1 T33:
 * Garantit qu'aucun numéro de téléphone ne fuite dans la réponse d'une offre.
 */
export function sanitizeRideOfferForApi(offer: RideOffer): RideOffer {
  const clone = { ...offer } as RideOffer & Record<string, unknown>;
  delete clone.driverPhone;
  delete clone.driver_phone;
  delete clone.phone;
  delete clone.clientPhone;
  delete clone.client_phone;
  return clone;
}

export function sanitizeIntercityQuoteForApi(quote: IntercityQuote): IntercityQuote {
  const clone = { ...quote } as IntercityQuote & Record<string, unknown>;
  delete clone.driverPhone;
  delete clone.driver_phone;
  delete clone.phone;
  delete clone.clientPhone;
  delete clone.client_phone;
  return clone;
}

/**
 * CDC v2.1 C11 (§6.0.1, T33-T35):
 * Masque `clientPhone` et supprime `driverPhone` sur les courses non encore attribuées.
 */
/** Retire les contacts sur place tant que la course n'est pas assignée (CDC C11). */
function stripLocationContacts<T extends { contact?: { name: string; phone: string }; note?: string }>(loc: T | null): T | null {
  if (!loc) return loc;
  const { contact: _contact, note: _note, ...rest } = loc;
  return rest as T;
}

export function sanitizeRideForApi(ride: Ride): Ride {
  const revealed = canRevealUrbanContact(ride.status);
  const sanitizedOffers = ride.offers.map(sanitizeRideOfferForApi);
  if (revealed) {
    return {
      ...ride,
      offers: sanitizedOffers,
    };
  }
  const { driverPhone: _dropDriverPhone, ...rest } = ride;
  return {
    ...rest,
    clientPhone: '',
    pickup: stripLocationContacts(rest.pickup) ?? rest.pickup,
    dropoff: stripLocationContacts(rest.dropoff) ?? rest.dropoff,
    offers: sanitizedOffers,
  };
}

export function sanitizeIntercityForApi(ic: IntercityRequest): IntercityRequest {
  const revealed = canRevealIntercityContact(ic.status);
  const sanitizedQuotes = ic.quotes.map(sanitizeIntercityQuoteForApi);
  if (revealed) {
    return {
      ...ic,
      quotes: sanitizedQuotes,
    };
  }
  const { driverPhone: _dropDriverPhone, ...rest } = ic;
  return {
    ...rest,
    clientPhone: '',
    quotes: sanitizedQuotes,
  };
}

/**
 * CDC v2.1 C12 (§6.0, §6.1, T37):
 * Calcul du taux de réponse chauffeur et rétrogradation automatique dans la diffusion.
 */
export function computeDriverReactivity(
  driver: Pick<
    DriverProfile,
    'requestsReceivedCount' | 'requestsRespondedCount' | 'ignoredRequestsStreak'
  >,
  settings: Pick<AppSettings, 'driverResponseRateMin' | 'driverIgnoredRequestsMax'>
): {
  responseRate: number;
  isDemotedInBroadcast: boolean;
  reason?: 'IGNORED_STREAK' | 'LOW_RESPONSE_RATE';
} {
  const received = Math.max(0, Number(driver.requestsReceivedCount ?? 0));
  const responded = Math.max(0, Math.min(received, Number(driver.requestsRespondedCount ?? 0)));
  const ignoredStreak = Math.max(0, Number(driver.ignoredRequestsStreak ?? 0));
  const responseRate = received === 0 ? 1 : Number((responded / received).toFixed(2));
  const maxIgnored = Math.max(1, Number(settings.driverIgnoredRequestsMax ?? 20));
  const minRate = Math.max(0, Math.min(1, Number(settings.driverResponseRateMin ?? 0.3)));

  if (ignoredStreak >= maxIgnored) {
    return {
      responseRate,
      isDemotedInBroadcast: true,
      reason: 'IGNORED_STREAK',
    };
  }
  if (received >= maxIgnored && responseRate < minRate) {
    return {
      responseRate,
      isDemotedInBroadcast: true,
      reason: 'LOW_RESPONSE_RATE',
    };
  }
  return {
    responseRate,
    isDemotedInBroadcast: false,
  };
}

export function recordDriverIgnoredRequest(
  driver: DriverProfile,
  settings: Pick<AppSettings, 'driverResponseRateMin' | 'driverIgnoredRequestsMax'>
): DriverProfile {
  const requestsReceivedCount = (driver.requestsReceivedCount ?? 0) + 1;
  const requestsRespondedCount = driver.requestsRespondedCount ?? 0;
  const ignoredRequestsStreak = (driver.ignoredRequestsStreak ?? 0) + 1;
  const reactivity = computeDriverReactivity(
    { requestsReceivedCount, requestsRespondedCount, ignoredRequestsStreak },
    settings
  );
  return {
    ...driver,
    requestsReceivedCount,
    requestsRespondedCount,
    ignoredRequestsStreak,
    responseRate: reactivity.responseRate,
    isDemotedInBroadcast: reactivity.isDemotedInBroadcast,
  };
}

export function recordDriverOfferResponse(
  driver: DriverProfile,
  settings: Pick<AppSettings, 'driverResponseRateMin' | 'driverIgnoredRequestsMax'>
): DriverProfile {
  const requestsReceivedCount = (driver.requestsReceivedCount ?? 0) + 1;
  const requestsRespondedCount = (driver.requestsRespondedCount ?? 0) + 1;
  const ignoredRequestsStreak = 0;
  const reactivity = computeDriverReactivity(
    { requestsReceivedCount, requestsRespondedCount, ignoredRequestsStreak },
    settings
  );
  return {
    ...driver,
    requestsReceivedCount,
    requestsRespondedCount,
    ignoredRequestsStreak,
    responseRate: reactivity.responseRate,
    isDemotedInBroadcast: reactivity.isDemotedInBroadcast,
  };
}

/**
 * CDC v2.1 §6.5 & T25 (`DRIVER_BLOCKED_INTERCITY`):
 * Un chauffeur engagé sur un trajet inter-wilaya `booked` ou `in_progress` dans la plage
 * `±intercityDriverBlockHours` (défaut 24 h) ne reçoit plus d'offres urbaines.
 */
export function isDriverBlockedByIntercity(
  driverId: string,
  intercityRequests: IntercityRequest[],
  referenceDateIso: string,
  settings: Pick<AppSettings, 'intercityDriverBlockHours'>
): { blocked: boolean; blockingTrip?: IntercityRequest } {
  const blockHours = Math.max(0, Number(settings.intercityDriverBlockHours ?? 24));
  const refMs = Date.parse(`${referenceDateIso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(refMs)) return { blocked: false };
  const windowMs = blockHours * 3600 * 1000;

  for (const ic of intercityRequests) {
    if (ic.driverId !== driverId) continue;
    if (ic.status !== 'booked' && ic.status !== 'in_progress') continue;
    const tripMs = Date.parse(`${ic.preferredDate.slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(tripMs)) continue;
    if (Math.abs(tripMs - refMs) <= windowMs) {
      return { blocked: true, blockingTrip: ic };
    }
  }
  return { blocked: false };
}

/**
 * CDC v2.1 §7.5:
 * Retrait automatique du mode inter-wilaya si `intercityRatingsCount >= 3` et `ratingIntercityAvg < 3.5`.
 */
export function isDriverEligibleForIntercity(
  driver: DriverProfile,
  todayIso: string
): { eligible: boolean; code?: 'DRIVER_NOT_APPROVED' | 'SUBSCRIPTION_EXPIRED' | 'INTERCITY_QUALITY_SUSPENDED' } {
  if (driver.status !== 'approved') {
    return { eligible: false, code: 'DRIVER_NOT_APPROVED' };
  }
  const sub = computeSubscriptionStatus(driver.subscription, todayIso);
  if (!sub.canReceiveRides) {
    return { eligible: false, code: 'SUBSCRIPTION_EXPIRED' };
  }
  if (driver.intercityRatingsCount >= 3 && driver.ratingIntercityAvg < 3.5) {
    return { eligible: false, code: 'INTERCITY_QUALITY_SUSPENDED' };
  }
  return { eligible: true };
}

/**
 * CDC v2.1 §5.14 & T27:
 * Détecte un désistement client tardif (< 48 h avant la date de départ inter-wilaya).
 */
export function isLateIntercityCancellation(preferredDateIso: string, nowIso: string): boolean {
  const tripStartMs = Date.parse(`${preferredDateIso.slice(0, 10)}T08:00:00Z`);
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(tripStartMs) || Number.isNaN(nowMs)) return false;
  return tripStartMs - nowMs < 48 * 3600 * 1000;
}

export interface SuspiciousCancellationAlert {
  id: string;
  kind: 'repeated_pair' | 'high_client_cancellations' | 'late_intercity_cancellation';
  clientName: string;
  driverName?: string;
  count: number;
  detailFr: string;
  detailAr: string;
}

/**
 * CDC v2.1 C12 (§6.0.2):
 * Détection anti-contournement des annulations répétées après attribution (suspicion de collusion hors app)
 * et des désistements tardifs inter-wilaya (< 48 h).
 */
export function detectSuspiciousCancellations(
  rides: Ride[],
  intercityRequests: IntercityRequest[]
): SuspiciousCancellationAlert[] {
  const alerts: SuspiciousCancellationAlert[] = [];

  const pairCounts = new Map<string, { clientName: string; driverName: string; count: number }>();
  const clientCancelCounts = new Map<string, { clientName: string; count: number }>();

  for (const r of rides) {
    if (r.status !== 'cancelled_client' && r.status !== 'cancelled_driver') continue;
    const cEntry = clientCancelCounts.get(r.clientId) ?? { clientName: r.clientName, count: 0 };
    cEntry.count += 1;
    clientCancelCounts.set(r.clientId, cEntry);

    if (r.driverId && r.driverName) {
      const key = `${r.clientId}::${r.driverId}`;
      const pEntry = pairCounts.get(key) ?? {
        clientName: r.clientName,
        driverName: r.driverName,
        count: 0,
      };
      pEntry.count += 1;
      pairCounts.set(key, pEntry);
    }
  }

  for (const [key, entry] of pairCounts.entries()) {
    if (entry.count >= 2) {
      alerts.push({
        id: `pair-${key}`,
        kind: 'repeated_pair',
        clientName: entry.clientName,
        driverName: entry.driverName,
        count: entry.count,
        detailFr: `${entry.count} annulations après attribution entre ${entry.clientName} et ${entry.driverName} (suspicion hors app).`,
        detailAr: `${entry.count} إلغاءات متكررة بعد الإسناد بين ${entry.clientName} و ${entry.driverName} (اشتباه تواصل خارج التطبيق).`,
      });
    }
  }

  for (const [clientId, entry] of clientCancelCounts.entries()) {
    if (entry.count >= 3) {
      alerts.push({
        id: `client-${clientId}`,
        kind: 'high_client_cancellations',
        clientName: entry.clientName,
        count: entry.count,
        detailFr: `${entry.clientName} cumule ${entry.count} annulations de courses.`,
        detailAr: `الزبون ${entry.clientName} سجل ${entry.count} إلغاءات للرحلات.`,
      });
    }
  }

  for (const ic of intercityRequests) {
    if (ic.status === 'cancelled_client' && ic.lateClientCancellationFlag) {
      alerts.push({
        id: `ic-late-${ic.id}`,
        kind: 'late_intercity_cancellation',
        clientName: ic.clientName,
        driverName: ic.driverName,
        count: 1,
        detailFr: `Désistement inter-wilaya < 48 h sur ${ic.requestCode} (${ic.clientName}).`,
        detailAr: `إلغاء متأخر (< 48 ساعة) للرحلة ${ic.requestCode} (${ic.clientName}).`,
      });
    }
  }

  return alerts;
}
