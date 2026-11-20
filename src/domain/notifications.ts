import {
  formatDzd,
  INTERCITY_STATUS_LABELS,
  RIDE_STATUS_LABELS,
} from './i18n';
import type {
  ChatMessage,
  IntercityQuote,
  IntercityRequest,
  Ride,
  RideOffer,
  WorkspaceRole,
} from './types';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastDraft {
  dedupeKey?: string;
  tone: ToastTone;
  titleFr: string;
  titleAr: string;
  bodyFr: string;
  bodyAr: string;
  actionWorkspace?: WorkspaceRole;
  durationMs?: number;
}

export interface ToastItem extends ToastDraft {
  id: string;
  createdAt: number;
  durationMs: number;
}

export function mapWsEnvelopeToToast(envelope: {
  event: string;
  payload: unknown;
}): ToastDraft | null {
  const { event, payload } = envelope;

  if (!event || event === 'connected' || event === 'driver.position' || event === 'intercity.position') {
    return null;
  }

  if (event === 'ride.created') {
    const ride = payload as Ride | undefined;
    if (!ride?.rideCode) return null;
    return {
      dedupeKey: `ride.created:${ride.id}`,
      tone: 'info',
      titleFr: `Nouvelle demande ${ride.rideCode}`,
      titleAr: `طلب جديد ${ride.rideCode}`,
      bodyFr: `${ride.pickup.address} · ${formatDzd(ride.estimatedPriceDzd, 'fr')}`,
      bodyAr: `${ride.pickup.address} · ${formatDzd(ride.estimatedPriceDzd, 'ar')}`,
      actionWorkspace: 'driver',
      durationMs: 6000,
    };
  }

  if (event === 'bid.created') {
    const data = payload as { rideId?: string; offer?: RideOffer } | undefined;
    const offer = data?.offer;
    if (!offer) return null;
    return {
      dedupeKey: `bid.created:${offer.id}`,
      tone: 'info',
      titleFr: offer.isAutoBid ? 'Offre automatique reçue (Auto-bid)' : 'Nouvelle offre chauffeur reçue',
      titleAr: offer.isAutoBid ? 'عرض تلقائي جديد من سائق' : 'تم استلام عرض جديد من سائق',
      bodyFr: `${offer.driverName} propose ${formatDzd(offer.priceDzd, 'fr')} · ETA ${offer.etaMinutes} min`,
      bodyAr: `${offer.driverName} يقترح ${formatDzd(offer.priceDzd, 'ar')} · الوصول خلال ${offer.etaMinutes} د`,
      actionWorkspace: 'client',
      durationMs: 6000,
    };
  }

  if (event === 'bid.withdrawn') {
    const data = payload as { rideId?: string; offer?: RideOffer } | undefined;
    const offer = data?.offer;
    if (!offer) return null;
    return {
      dedupeKey: `bid.withdrawn:${offer.id}`,
      tone: 'warning',
      titleFr: 'Offre chauffeur rétractée (< 3 min)',
      titleAr: 'تم سحب عرض سائق (خلال 3 دقائق)',
      bodyFr: `${offer.driverName} a retiré son offre de ${formatDzd(offer.priceDzd, 'fr')}`,
      bodyAr: `سحب ${offer.driverName} عرضه البالغ ${formatDzd(offer.priceDzd, 'ar')}`,
      actionWorkspace: 'client',
      durationMs: 5000,
    };
  }

  if (event === 'bid.accepted') {
    const data = payload as { rideId?: string; ride?: Ride } | undefined;
    const ride = data?.ride;
    if (!ride) return null;
    const price = ride.finalAgreedPriceDzd ?? ride.estimatedPriceDzd;
    return {
      dedupeKey: `bid.accepted:${ride.id}`,
      tone: 'success',
      titleFr: `Offre acceptée · ${ride.rideCode}`,
      titleAr: `تم قبول العرض · ${ride.rideCode}`,
      bodyFr: `${ride.driverName ?? 'Chauffeur'} attribué pour ${formatDzd(price, 'fr')}`,
      bodyAr: `تم إسناد ${ride.driverName ?? 'السائق'} بسعر ${formatDzd(price, 'ar')}`,
      actionWorkspace: 'client',
      durationMs: 6500,
    };
  }

  if (event === 'ride.status.changed') {
    const data = payload as { rideId?: string; ride?: Ride } | undefined;
    const ride = data?.ride;
    if (!ride) return null;

    const statusLabel = RIDE_STATUS_LABELS[ride.status];
    const isCancel = ride.status === 'cancelled_client' || ride.status === 'cancelled_driver';
    const isDone = ride.status === 'completed' || ride.status === 'rated';
    const tone: ToastTone = isCancel ? 'warning' : isDone ? 'success' : 'info';

    return {
      dedupeKey: `ride.status:${ride.id}:${ride.status}`,
      tone,
      titleFr: `${ride.rideCode} · ${statusLabel?.fr ?? ride.status}`,
      titleAr: `${ride.rideCode} · ${statusLabel?.ar ?? ride.status}`,
      bodyFr: ride.driverName
        ? `Chauffeur : ${ride.driverName} · ${ride.pickup.address}`
        : ride.pickup.address,
      bodyAr: ride.driverName
        ? `السائق: ${ride.driverName} · ${ride.pickup.address}`
        : ride.pickup.address,
      actionWorkspace: 'client',
      durationMs: 5500,
    };
  }

  if (event === 'ride.rated') {
    const data = payload as { ride?: Ride; review?: { driverName?: string; stars?: number } } | undefined;
    const ride = data?.ride;
    const stars = data?.review?.stars ?? ride?.rating?.stars ?? 5;
    const driverName = data?.review?.driverName ?? ride?.driverName ?? '';
    return {
      dedupeKey: `ride.rated:${ride?.id ?? stars}`,
      tone: 'success',
      titleFr: `Avis publié · ${stars}/5 ★`,
      titleAr: `تم نشر التقييم · ${stars}/5 ★`,
      bodyFr: driverName
        ? `Merci ! Votre avis sur ${driverName} renforce la confiance de la communauté.`
        : 'Merci pour votre avis client !',
      bodyAr: driverName
        ? `شكراً! تقييمك للسائق ${driverName} يعزز ثقة المجتمع.`
        : 'شكراً على تقييمك!',
      actionWorkspace: 'client',
      durationMs: 6000,
    };
  }

  if (event === 'chat.message') {
    const msg = payload as ChatMessage | undefined;
    if (!msg?.body) return null;
    return {
      dedupeKey: `chat:${msg.id}`,
      tone: 'info',
      titleFr: `Message de ${msg.senderName}`,
      titleAr: `رسالة من ${msg.senderName}`,
      bodyFr: msg.body,
      bodyAr: msg.body,
      actionWorkspace: msg.senderRole === 'driver' ? 'client' : 'driver',
      durationMs: 5000,
    };
  }

  if (event === 'intercity.created') {
    const ic = payload as IntercityRequest | undefined;
    if (!ic?.requestCode) return null;
    return {
      dedupeKey: `ic.created:${ic.id}`,
      tone: 'info',
      titleFr: `Nouveau trajet Entre wilayas · ${ic.requestCode}`,
      titleAr: `طلب جديد بين الولايات · ${ic.requestCode}`,
      bodyFr: `${ic.pickupAddress} → ${ic.dropoffAddress}`,
      bodyAr: `${ic.pickupAddress} ← ${ic.dropoffAddress}`,
      actionWorkspace: 'driver',
      durationMs: 6000,
    };
  }

  if (event === 'intercity.quote.created') {
    const data = payload as { requestId?: string; quote?: IntercityQuote } | undefined;
    const quote = data?.quote;
    if (!quote) return null;
    return {
      dedupeKey: `ic.quote:${quote.id}`,
      tone: 'info',
      titleFr: 'Nouveau devis Entre wilayas reçu',
      titleAr: 'تم استلام عرض سعر بين الولايات',
      bodyFr: `${quote.driverName} · ${formatDzd(quote.priceDzd, 'fr')}`,
      bodyAr: `${quote.driverName} · ${formatDzd(quote.priceDzd, 'ar')}`,
      actionWorkspace: 'client',
      durationMs: 6000,
    };
  }

  if (event === 'intercity.updated') {
    const ic = payload as Partial<IntercityRequest> | undefined;
    if (!ic?.requestCode || !ic.status) return null;
    const statusLabel = INTERCITY_STATUS_LABELS[ic.status];
    const isCancel = ic.status === 'cancelled_client' || ic.status === 'cancelled_driver';
    const isGood = ic.status === 'booked' || ic.status === 'completed' || ic.status === 'rated';
    return {
      dedupeKey: `ic.updated:${ic.id}:${ic.status}`,
      tone: isCancel ? 'warning' : isGood ? 'success' : 'info',
      titleFr: `${ic.requestCode} · ${statusLabel?.fr ?? ic.status}`,
      titleAr: `${ic.requestCode} · ${statusLabel?.ar ?? ic.status}`,
      bodyFr: `${ic.pickupAddress ?? ''} → ${ic.dropoffAddress ?? ''}`.trim(),
      bodyAr: `${ic.pickupAddress ?? ''} ← ${ic.dropoffAddress ?? ''}`.trim(),
      actionWorkspace: 'client',
      durationMs: 5500,
    };
  }

  if (event === 'favorite.updated') {
    const data = payload as { added?: boolean; driverName?: string; driverId?: string } | undefined;
    if (data?.added === undefined) return null;
    const name = data.driverName || 'Chauffeur';
    return {
      dedupeKey: `favorite:${data.driverId ?? name}:${data.added}`,
      tone: data.added ? 'success' : 'info',
      titleFr: data.added ? 'Ajouté aux favoris' : 'Retiré des favoris',
      titleAr: data.added ? 'تمت الإضافة إلى المفضلة' : 'تمت الإزالة من المفضلة',
      bodyFr: data.added
        ? `${name} a été enregistré dans vos chauffeurs préférés.`
        : `${name} a été retiré de vos favoris.`,
      bodyAr: data.added
        ? `تم حفظ ${name} في قائمة السائقين المفضلين.`
        : `تمت إزالة ${name} من قائمة المفضلة.`,
      actionWorkspace: 'client',
      durationMs: 4500,
    };
  }

  return null;
}

export function pushToast(
  queue: ToastItem[],
  draft: ToastDraft,
  options?: { id?: string; now?: number; maxVisible?: number }
): ToastItem[] {
  const maxVisible = options?.maxVisible ?? 4;
  const item: ToastItem = {
    ...draft,
    id: options?.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: options?.now ?? Date.now(),
    durationMs: draft.durationMs ?? 5500,
  };

  const filtered = draft.dedupeKey
    ? queue.filter((t) => t.dedupeKey !== draft.dedupeKey)
    : queue;

  const updated = [item, ...filtered];
  return updated.slice(0, maxVisible);
}

export function dismissToast(queue: ToastItem[], id: string): ToastItem[] {
  return queue.filter((t) => t.id !== id);
}
