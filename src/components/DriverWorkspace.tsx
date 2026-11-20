import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  FileCheck2,
  Lock,
  MapPin,
  Moon,
  Navigation,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  Ticket,
  Truck,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, ApiError } from '../api/client';
import { wsClient } from '../api/wsClient';
import { useBackgroundGps } from '../hooks/useBackgroundGps';
import { computeReliability } from '../domain/trust';
import { DriverSignup } from './DriverSignup';
import { ProofOfDeliveryCapture } from './ProofOfDeliveryCapture';
import { DEFAULT_AUTO_BID_CONFIG, getOfferRetractStatus } from '../domain/autoBid';
import {
  canRevealIntercityContact,
  canRevealUrbanContact,
  canSendUrbanChat,
  isDriverBlockedByIntercity,
  isDriverEligibleForIntercity,
} from '../domain/compliance';
import {
  DRIVER_STATUS_LABELS,
  formatDateDz,
  formatDzd,
  RIDE_STATUS_LABELS,
  SERVICE_LABELS,
  SUB_STATUS_LABELS,
  TEXTS,
  VEHICLE_LABELS,
} from '../domain/i18n';
import { computeSubscriptionStatus } from '../domain/stateMachine';
import { getDriverTier } from '../domain/visibility';
import {
  computeNextStepTowardsTarget,
  isOngoingTrackableIntercity,
  isOngoingTrackableRide,
  resolveIntercityEndpoints,
} from '../domain/tracking';
import type { ThemeMode } from '../domain/theme';
import type {
  AppSettings,
  AutoBidConfig,
  ChatMessage,
  DriverProfile,
  DriverReview,
  EmptyReturnDeclaration,
  IntercityRequest,
  Locale,
  Ride,
  SubscriptionPayment,
  Voucher,
  Wilaya,
} from '../domain/types';
import { AutoBidPanel } from './AutoBidPanel';
import { ChatPanel } from './ChatPanel';
import { DriverReviewsSection } from './DriverReviewsSection';
import { LiveTrackingMap } from './LiveTrackingMap';

interface DriverWorkspaceProps {
  locale: Locale;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
  wilayas: Wilaya[];
  settings: AppSettings;
  drivers: DriverProfile[];
  rides: Ride[];
  intercityRequests: IntercityRequest[];
  emptyReturns: EmptyReturnDeclaration[];
  payments: SubscriptionPayment[];
  vouchers?: Voucher[];
  chats: ChatMessage[];
  reviews?: DriverReview[];
  onRefresh: () => Promise<void>;
}

export function DriverWorkspace({
  locale,
  theme = 'light',
  onToggleTheme,
  wilayas,
  settings,
  drivers,
  rides,
  intercityRequests,
  emptyReturns,
  payments,
  vouchers = [],
  chats,
  reviews = [],
  onRefresh,
}: DriverWorkspaceProps) {
  const isAr = locale === 'ar';
  const [selectedDriverId, setSelectedDriverId] = useState(drivers[0]?.id ?? 'drv-karim');
  const [signupOpen, setSignupOpen] = useState(false);
  const [tab, setTab] = useState<'urban' | 'intercity' | 'subscription' | 'kyc'>('urban');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Urban bidding & auto-bid state
  const [bidPrices, setBidPrices] = useState<Record<string, string>>({});
  const [bidMessages, setBidMessages] = useState<Record<string, string>>({});
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [simulateNearPickup, setSimulateNearPickup] = useState(true);
  const [autoStreamGps, setAutoStreamGps] = useState(false);
  const [autoStreamIntercityId, setAutoStreamIntercityId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [savingAutoBid, setSavingAutoBid] = useState(false);

  // Intercity quote & coverage state
  const [covFrom, setCovFrom] = useState(31);
  const [covTo, setCovTo] = useState<string>('16');
  const [erFrom, setErFrom] = useState(16);
  const [erTo, setErTo] = useState(31);
  const [erDate, setErDate] = useState(() => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [icQuoteDrafts, setIcQuoteDrafts] = useState<
    Record<string, { price: string; date: string; isEmptyReturn: boolean; isGroupage: boolean; message: string }>
  >({});
  const [revisionPrice, setRevisionPrice] = useState('');
  const [revisionReason, setRevisionReason] = useState('Volume supplémentaire constaté au chargement');

  // Subscription payment & voucher state
  const [payMethod, setPayMethod] = useState<'baridimob' | 'ccp'>('baridimob');
  const [payRef, setPayRef] = useState('BM-882310');
  const [payProof, setPayProof] = useState('recu_baridimob_01.jpg');
  const [voucherCode, setVoucherCode] = useState('LM-2026-ORAN-0001');
  const [copiedCcp, setCopiedCcp] = useState(false);

  const driver = useMemo(
    () => drivers.find((d) => d.id === selectedDriverId) ?? drivers[0],
    [drivers, selectedDriverId]
  );

  const [autoBidDraft, setAutoBidDraft] = useState<AutoBidConfig>(
    () => driver.autoBidConfig ?? DEFAULT_AUTO_BID_CONFIG
  );

  useEffect(() => {
    setAutoBidDraft(driver.autoBidConfig ?? DEFAULT_AUTO_BID_CONFIG);
  }, [driver.id, driver.autoBidConfig]);

  const todayStr = useMemo(() => new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 10), []);
  const subComputed = useMemo(
    () => computeSubscriptionStatus(driver.subscription, todayStr),
    [driver.subscription, todayStr]
  );

  // Modèle « visibilité » : le tier Pro est un boost d'annuaire, pas une condition
  // pour recevoir des courses. Le gratuit reste toujours actif (règle n°1).
  const tier = useMemo(
    () => getDriverTier(driver, settings, todayStr),
    [driver, settings, todayStr]
  );

  const planLabel = useMemo(() => {
    const paidPlan = driver.subscription.kind !== 'trial';
    if (!paidPlan) return isAr ? 'مجاني' : 'Gratuit';
    if (subComputed.status === 'grace') return isAr ? 'برو (فترة سماح)' : 'Pro (en grâce)';
    if (subComputed.status === 'active') {
      const shortEnd = `${driver.subscription.endsOn.slice(8, 10)}/${driver.subscription.endsOn.slice(5, 7)}`;
      return isAr ? `برو (نشط — ينتهي في ${shortEnd})` : `Pro (actif — expire le ${shortEnd})`;
    }
    return isAr ? 'برو (منتهي)' : 'Pro (expiré)';
  }, [driver.subscription.kind, driver.subscription.endsOn, subComputed.status, isAr]);

  const intercityUrbanBlock = useMemo(
    () => isDriverBlockedByIntercity(driver.id, intercityRequests, todayStr, settings),
    [driver.id, intercityRequests, todayStr, settings]
  );

  const intercityEligibility = useMemo(
    () => isDriverEligibleForIntercity(driver, todayStr),
    [driver, todayStr]
  );

  const activeDriverRide = useMemo(
    () =>
      rides.find(
        (r) =>
          r.driverId === driver.id &&
          !['completed', 'rated', 'cancelled_client', 'cancelled_driver', 'expired'].includes(r.status)
      ) ?? null,
    [rides, driver.id]
  );

  const nearbySearchingRides = useMemo(
    () => rides.filter((r) => r.status === 'searching'),
    [rides]
  );

  const driverIntercityActive = useMemo(
    () =>
      intercityRequests.filter(
        (ic) => ic.driverId === driver.id && ['booked', 'in_progress', 'completed'].includes(ic.status)
      ),
    [intercityRequests, driver.id]
  );

  const intercityOpportunities = useMemo(
    () =>
      intercityRequests.filter((ic) => {
        if (ic.status !== 'collecting' && ic.status !== 'quoted') return false;
        return driver.coverageAxes.some(
          (ax) => ax.fromWilaya === ic.fromWilaya && (ax.toWilaya === null || ax.toWilaya === ic.toWilaya)
        );
      }),
    [intercityRequests, driver.coverageAxes]
  );

  const hasPendingDriverOffer = useMemo(
    () =>
      nearbySearchingRides.some((r) =>
        r.offers.some((o) => o.driverId === driver.id && o.status === 'pending')
      ),
    [nearbySearchingRides, driver.id]
  );

  useEffect(() => {
    if (tab !== 'urban' || !hasPendingDriverOffer) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tab, hasPendingDriverOffer]);

  useEffect(() => {
    if (activeDriverRide?.status !== 'loading') {
      setLoadingSeconds(0);
      return;
    }
    const timer = setInterval(() => setLoadingSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [activeDriverRide?.status]);

  useEffect(() => {
    if (!autoStreamGps || !activeDriverRide) return;
    const timer = setInterval(() => {
      const dest = activeDriverRide.dropoff ?? activeDriverRide.pickup;
      const curLat = activeDriverRide.driverLivePos?.lat ?? driver.lat;
      const curLng = activeDriverRide.driverLivePos?.lng ?? driver.lng;
      const target =
        activeDriverRide.status === 'in_transit' ? dest : activeDriverRide.pickup;
      const step = computeNextStepTowardsTarget({ lat: curLat, lng: curLng }, target, 0.28);
      const sent = wsClient.send('driver.position.push', {
        rideId: activeDriverRide.id,
        ...step,
      });
      if (!sent) {
        apiRequest(`/api/v1/rides/${activeDriverRide.id}/position`, {
          method: 'POST',
          body: JSON.stringify(step),
        }).catch(() => {});
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [autoStreamGps, activeDriverRide, driver.lat, driver.lng]);

  useEffect(() => {
    if (!autoStreamIntercityId) return;
    const activeIc = driverIntercityActive.find(
      (ic) => ic.id === autoStreamIntercityId && isOngoingTrackableIntercity(ic.status)
    );
    if (!activeIc) return;

    const timer = setInterval(() => {
      const endpoints = resolveIntercityEndpoints(activeIc, wilayas);
      const curLat = activeIc.driverLivePos?.lat ?? endpoints.pickup.lat;
      const curLng = activeIc.driverLivePos?.lng ?? endpoints.pickup.lng;
      const step = computeNextStepTowardsTarget(
        { lat: curLat, lng: curLng },
        endpoints.dropoff,
        0.12
      );
      const sent = wsClient.send('intercity.position.push', {
        intercityId: activeIc.id,
        ...step,
      });
      if (!sent) {
        apiRequest(`/api/v1/intercity/requests/${activeIc.id}/position`, {
          method: 'POST',
          body: JSON.stringify(step),
        }).catch(() => {});
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [autoStreamIntercityId, driverIntercityActive, wilayas]);

  const notifyError = (err: unknown) => {
    if (err instanceof ApiError) {
      setErrorBanner(isAr ? err.messageAr : err.message);
    } else if (err instanceof Error) {
      setErrorBanner(err.message);
    } else {
      setErrorBanner('Erreur');
    }
  };

  const toggleOnline = async () => {
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      await apiRequest(`/api/v1/driver/${driver.id}/availability`, {
        method: 'POST',
        body: JSON.stringify({ isOnline: !driver.isOnline }),
      });
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const sendUrbanBid = async (ride: Ride, customPrice?: number) => {
    setErrorBanner(null);
    const priceDzd = customPrice ?? Number(bidPrices[ride.id] || ride.estimatedPriceDzd);
    try {
      await apiRequest(`/api/v1/rides/${ride.id}/offers`, {
        method: 'POST',
        body: JSON.stringify({
          driverId: driver.id,
          priceDzd,
          etaMinutes: 12,
          portersOffered: ride.portersCount,
          message: bidMessages[ride.id] || 'Disponible immédiatement.',
        }),
      });
      setSuccessBanner(
        isAr
          ? `تم إرسال العرض (${formatDzd(priceDzd, locale)}) للطلب ${ride.rideCode}`
          : `Offre de ${formatDzd(priceDzd, locale)} envoyée sur ${ride.rideCode}.`
      );
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleIgnoreRide = async (ride: Ride) => {
    setErrorBanner(null);
    try {
      const res = await apiRequest<{ driver: DriverProfile }>(`/api/v1/driver/${driver.id}/ignore-ride`, {
        method: 'POST',
        body: JSON.stringify({ rideId: ride.id }),
      });
      setSuccessBanner(
        res.driver.isDemotedInBroadcast
          ? isAr
            ? 'تحذير: تم خفض أولويتك في البث بسبب كثرة الطلبات المتجاهلة.'
            : `Alerte réactivité : priorité de diffusion réduite (${res.driver.ignoredRequestsStreak} ignorées, taux ${Math.round(res.driver.responseRate * 100)} %).`
          : isAr
          ? `تم تجاهل الطلب ${ride.rideCode} (معدل الاستجابة ${Math.round(res.driver.responseRate * 100)}%).`
          : `Demande ${ride.rideCode} ignorée · Taux de réponse : ${Math.round(res.driver.responseRate * 100)} %.`
      );
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleSaveAutoBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setSuccessBanner(null);
    setSavingAutoBid(true);
    try {
      const res = await apiRequest<{ driver: DriverProfile; autoBidsCreatedCount: number }>(
        `/api/v1/driver/${driver.id}/auto-bid`,
        {
          method: 'PUT',
          body: JSON.stringify(autoBidDraft),
        }
      );
      if (autoBidDraft.enabled) {
        setSuccessBanner(
          isAr
            ? `تم تفعيل المزايدة التلقائية (${res.autoBidsCreatedCount} عروض مرسلة فوراً).`
            : res.autoBidsCreatedCount > 0
            ? `Enchère automatique activée : ${res.autoBidsCreatedCount} offre(s) compatible(s) envoyée(s).`
            : 'Enchère automatique enregistrée et active pour les prochaines courses.'
        );
      } else {
        setSuccessBanner(
          isAr ? 'تم إيقاف المزايدة التلقائية وحفظ الإعدادات.' : 'Enchère automatique désactivée et préférences enregistrées.'
        );
      }
      await onRefresh();
    } catch (err) {
      notifyError(err);
    } finally {
      setSavingAutoBid(false);
    }
  };

  const handleRetractOffer = async (rideId: string, offerId: string) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      await apiRequest(`/api/v1/rides/${rideId}/offers/${offerId}/retract`, {
        method: 'POST',
        body: JSON.stringify({ driverId: driver.id }),
      });
      setSuccessBanner(
        isAr ? 'تم سحب العرض بنجاح قبل انقضاء 3 دقائق.' : 'Offre rétractée dans le délai de 3 minutes.'
      );
      await onRefresh();
    } catch (err) {
      notifyError(err);
    }
  };

  // File GPS locale + reprise automatique (CDC C3 — réseau dégradé).
  const gpsTarget = activeDriverRide
    ? ({ kind: 'ride' as const, id: activeDriverRide.id })
    : autoStreamIntercityId
    ? ({ kind: 'intercity' as const, id: autoStreamIntercityId })
    : null;
  const sendGpsBatch = async (batch: Array<{ lat: number; lng: number; heading?: number; speedKmh?: number; ts?: string; target: { kind: string; id: string } }>) => {
    const rideBatch = batch.filter((p) => p.target.kind === 'ride');
    const icBatch = batch.filter((p) => p.target.kind === 'intercity');
    let ok = true;
    for (const [id, positions] of [[rideBatch[0]?.target.id, rideBatch], [icBatch[0]?.target.id, icBatch]] as const) {
      if (!id || positions.length === 0) continue;
      const url = positions[0].target.kind === 'ride'
        ? `/api/v1/rides/${id}/position/batch`
        : `/api/v1/intercity/requests/${id}/position/batch`;
      try {
        await apiRequest(url, { method: 'POST', body: JSON.stringify({ positions: positions.map(({ target: _t, ...p }) => p) }) });
      } catch { ok = false; }
    }
    return ok;
  };
  const gps = useBackgroundGps({
    enabled: autoStreamGps || Boolean(autoStreamIntercityId),
    target: gpsTarget,
    sendBatch: sendGpsBatch,
  });

  const [proofPhoto, setProofPhoto] = useState<string>('');
  const [proofRequired, setProofRequired] = useState(false);

  const advanceUrbanStatus = async (ride: Ride, toStatus: string) => {
    setErrorBanner(null);
    const targetPos =
      toStatus === 'arrived_pickup'
        ? simulateNearPickup
          ? { lat: ride.pickup.lat + 0.0004, lng: ride.pickup.lng + 0.0003 }
          : { lat: ride.pickup.lat + 0.025, lng: ride.pickup.lng + 0.025 }
        : toStatus === 'arrived_dropoff' && ride.dropoff
        ? { lat: ride.dropoff.lat + 0.0003, lng: ride.dropoff.lng + 0.0003 }
        : undefined;

    try {
      await apiRequest(`/api/v1/rides/${ride.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          toStatus,
          actor: 'driver',
          lat: targetPos?.lat,
          lng: targetPos?.lng,
          ...(toStatus === 'completed' && proofPhoto
            ? {
                proofOfDelivery: {
                  photoDataUrl: proofPhoto,
                  lat: ride.dropoff?.lat ?? targetPos?.lat,
                  lng: ride.dropoff?.lng ?? targetPos?.lng,
                },
              }
            : {}),
        }),
      });
      if (toStatus === 'completed') { setProofPhoto(''); setProofRequired(false); }
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const pushSimulatedPosition = async (ride: Ride) => {
    const dest = ride.dropoff ?? ride.pickup;
    const curLat = ride.driverLivePos?.lat ?? driver.lat;
    const curLng = ride.driverLivePos?.lng ?? driver.lng;
    const target = ride.status === 'in_transit' ? dest : ride.pickup;
    const step = computeNextStepTowardsTarget({ lat: curLat, lng: curLng }, target, 0.4);

    const sentOverWs = wsClient.send('driver.position.push', {
      rideId: ride.id,
      ...step,
    });
    if (!sentOverWs) {
      await apiRequest(`/api/v1/rides/${ride.id}/position`, {
        method: 'POST',
        body: JSON.stringify(step),
      });
      await onRefresh();
    }
  };

  const pushSimulatedIntercityPosition = async (ic: IntercityRequest) => {
    const endpoints = resolveIntercityEndpoints(ic, wilayas);
    const curLat = ic.driverLivePos?.lat ?? endpoints.pickup.lat;
    const curLng = ic.driverLivePos?.lng ?? endpoints.pickup.lng;
    const step = computeNextStepTowardsTarget(
      { lat: curLat, lng: curLng },
      endpoints.dropoff,
      0.14
    );

    const sentOverWs = wsClient.send('intercity.position.push', {
      intercityId: ic.id,
      ...step,
    });
    if (!sentOverWs) {
      await apiRequest(`/api/v1/intercity/requests/${ic.id}/position`, {
        method: 'POST',
        body: JSON.stringify(step),
      });
      await onRefresh();
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/driver/${driver.id}/subscription/payments`, {
        method: 'POST',
        body: JSON.stringify({
          method: payMethod,
          amountDzd: settings.proPriceDzd,
          reference: payRef,
          proofLabel: payProof,
        }),
      });
      setSuccessBanner(
        isAr
          ? 'تم إرسال الإيصال. المراجعة خلال 24 ساعة عمل.'
          : 'Reçu envoyé. Validation par l’administration sous 24 h ouvrées.'
      );
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleRedeemVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/driver/${driver.id}/subscription/redeem`, {
        method: 'POST',
        body: JSON.stringify({ code: voucherCode }),
      });
      setSuccessBanner(
        isAr ? 'تم تفعيل الرمز وتمديد الاشتراك 30 يوماً.' : 'Code voucher activé ! Abonnement prolongé de 30 jours.'
      );
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleAddCoverage = async () => {
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/driver/${driver.id}/coverage`, {
        method: 'POST',
        body: JSON.stringify({ fromWilaya: covFrom, toWilaya: covTo === 'all' ? null : Number(covTo) }),
      });
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleDeclareEmptyReturn = async () => {
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/driver/${driver.id}/empty-returns`, {
        method: 'POST',
        body: JSON.stringify({
          fromWilaya: erFrom,
          toWilaya: erTo,
          departDate: erDate,
          availableM3: driver.vehicle.volumeM3,
          maxWeightKg: driver.vehicle.maxLoadKg,
        }),
      });
      setSuccessBanner(isAr ? 'تم تسجيل العودة الفارغة.' : 'Retour à vide déclaré.');
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleSendIntercityQuote = async (ic: IntercityRequest) => {
    setErrorBanner(null);
    const draft = icQuoteDrafts[ic.id] ?? {
      price: String(ic.refPriceDzd),
      date: ic.preferredDate,
      isEmptyReturn: false,
      isGroupage: false,
      message: 'Disponible avec équipe et matériel de protection.',
    };
    try {
      await apiRequest(`/api/v1/intercity/requests/${ic.id}/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          driverId: driver.id,
          priceDzd: Number(draft.price),
          availableDate: draft.date,
          timeSlot: ic.timeSlot,
          portersIncluded: ic.portersCount,
          includesDisassembly: ic.needsDisassembly,
          includesPacking: ic.needsPacking,
          isEmptyReturn: draft.isEmptyReturn,
          isGroupage: draft.isGroupage,
          message: draft.message,
        }),
      });
      setSuccessBanner(
        isAr ? `تم إرسال عرض السعر للطلب ${ic.requestCode}.` : `Devis envoyé sur ${ic.requestCode}.`
      );
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const wilayaName = (code: number) => {
    const w = wilayas.find((x) => x.code === code);
    return w ? (isAr ? w.nameAr : w.nameFr) : String(code);
  };

  const driverPayments = payments.filter((p) => p.driverId === driver.id);
  const driverEmptyReturns = emptyReturns.filter((er) => er.driverId === driver.id);

  return (
    <div className="space-y-6">
      {signupOpen ? (
        <DriverSignup
          locale={locale}
          wilayas={wilayas}
          onCancel={() => setSignupOpen(false)}
          onDone={async (driverId) => {
            setSignupOpen(false);
            setSelectedDriverId(driverId);
            await onRefresh();
            setSuccessBanner(
              isAr
                ? 'تم إنشاء حسابك. أرسل وثائقك للمراجعة ثم انتظر تفعيل الإدارة.'
                : 'Compte créé. Soumettez vos documents pour revue, puis attendez la validation admin.'
            );
            setTab('kyc');
          }}
        />
      ) : (
      <>
      {/* Driver Identity & Gate Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label htmlFor="driver-profile-select" className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              {isAr ? 'حساب السائق التجريبي' : 'Profil chauffeur actif'}
            </label>
            <select
              id="driver-profile-select"
              value={driver.id}
              onChange={(e) => {
                setSelectedDriverId(e.target.value);
                setErrorBanner(null);
              }}
              className="h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} — {VEHICLE_LABELS[d.vehicle.category].fr} ({DRIVER_STATUS_LABELS[d.status].fr})
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={() => setSignupOpen(true)}
            className="h-9 px-3 rounded-md bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 whitespace-nowrap">
            {isAr ? '+ انضم كسائق' : '+ Devenir chauffeur'}
          </button>

          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {isAr ? DRIVER_STATUS_LABELS[driver.status].ar : DRIVER_STATUS_LABELS[driver.status].fr}
              </span>
              <span className="mx-1.5">·</span>
              <span>
                {isAr ? 'مؤشر الموثوقية:' : 'Fiabilité :'}{' '}
                <strong className="text-emerald-700 dark:text-emerald-400">
                  {computeReliability({
                    ratingAvg: driver.ratingAvg,
                    ratingsCount: driver.ratingsCount,
                    responseRate: driver.responseRate ?? 1,
                    ridesCompleted: driver.ridesCompleted,
                  }).score}%
                </strong>
              </span>
              <span className="mx-1.5">·</span>
              <span>
                {isAr ? 'الخطة:' : 'Plan :'}{' '}
                <strong
                  className={
                    subComputed.status === 'expired'
                      ? 'text-red-700 dark:text-red-400'
                      : subComputed.status === 'grace'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }
                >
                  {planLabel}
                </strong>
                {tier === 'pro' && (
                  <span className="ms-1.5 px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 font-black text-[9px]">
                    PRO
                  </span>
                )}
              </span>
            </div>
            <div className="tabular-nums">
              {isAr ? 'حضري:' : 'Note urbaine :'} ★ {driver.ratingAvg > 0 ? driver.ratingAvg.toFixed(2) : '—'} ({driver.ridesCompleted})
              <span className="mx-1.5">·</span>
              {isAr ? 'بين الولايات:' : 'Longue distance :'}{' '}
              {driver.intercityRatingsCount > 0
                ? `★ ${driver.ratingIntercityAvg.toFixed(2)} (${driver.intercityCompleted})`
                : isAr
                ? 'جديد'
                : 'Nouveau'}
              <span className="mx-1.5">·</span>
              <span
                data-testid="driver-reactivity-metric"
                className={
                  driver.isDemotedInBroadcast
                    ? 'text-red-700 dark:text-red-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300'
                }
              >
                {isAr ? 'الاستجابة:' : 'Réactivité :'} {Math.round((driver.responseRate ?? 1) * 100)}%
                {(driver.ignoredRequestsStreak ?? 0) > 0
                  ? ` (${driver.ignoredRequestsStreak} ${isAr ? 'متجاهلة' : 'ignorée(s)'})`
                  : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onToggleTheme && (
            <button
              type="button"
              data-testid="driver-night-mode-toggle"
              aria-pressed={theme === 'dark'}
              onClick={onToggleTheme}
              className={`h-11 px-4 rounded-md border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2 ${
                theme === 'dark'
                  ? 'border-orange-500/60 bg-slate-800 text-amber-300 hover:bg-slate-700'
                  : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
              }`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>{isAr ? 'الوضع النهاري' : 'Mode jour'}</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-600" />
                  <span>{isAr ? 'الوضع الليلي' : 'Mode nuit'}</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={toggleOnline}
            className={`h-11 px-5 rounded-md text-sm font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
              driver.isOnline
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>
              {driver.isOnline
                ? isAr
                  ? 'متاح — استقبال الطلبات'
                  : 'En ligne · Vous recevez des courses'
                : isAr
                ? 'غير متاح — اضغط للتشغيل'
                : 'Hors ligne · Passer disponible'}
            </span>
          </button>
        </div>
      </div>

      {/* Subscription Grace or Expiry Warning */}
      {subComputed.status === 'grace' && (
        <div className="p-3.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/45 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
          <span>
            {isAr
              ? 'اشتراكك في فترة السماح (3 أيام). قم بالتجديد لتجنب توقف استقبال الطلبات.'
              : `Votre plan Pro est en période de grâce jusqu’au ${formatDateDz(driver.subscription.graceUntil, locale)}. Vous recevez toujours des courses ; seul votre rang dans l’annuaire est concerné.`}
          </span>
          <button
            type="button"
            onClick={() => setTab('subscription')}
            className="px-3 py-1.5 rounded bg-amber-700 hover:bg-amber-600 text-white font-semibold whitespace-nowrap"
          >
            {isAr
              ? `التجديد (${formatDzd(settings.proPriceDzd, locale)})`
              : `Renouveler (${formatDzd(settings.proPriceDzd, locale)})`}
          </button>
        </div>
      )}

      {/* CDC v2.1 C12 / T37: Broadcast Demotion Warning */}
      {driver.isDemotedInBroadcast && (
        <div
          data-testid="driver-demoted-warning"
          className="p-3.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/45 text-red-900 dark:text-red-200 text-xs flex items-center gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {isAr
              ? `تم خفض أولويتك في بث الطلبات (معدل الاستجابة ${Math.round(driver.responseRate * 100)}% · ${driver.ignoredRequestsStreak} طلبات متجاهلة). استجب للطلبات القادمة لتحسين ترتيبك.`
              : `Priorité réduite en diffusion automatique : taux de réponse ${Math.round(driver.responseRate * 100)} % (< ${Math.round(settings.driverResponseRateMin * 100)} %) ou ${driver.ignoredRequestsStreak} demandes ignorées consécutives (seuil ${settings.driverIgnoredRequestsMax}).`}
          </span>
        </div>
      )}

      {/* CDC v2.1 §6.5 / T25: Intercity Urban Block Notice */}
      {intercityUrbanBlock.blocked && (
        <div
          data-testid="driver-intercity-block-banner"
          className="p-3.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/45 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5"
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            {isAr
              ? `محجوز لرحلة بين الولايات (${intercityUrbanBlock.blockingTrip?.requestCode}) — العروض الحضرية معلّقة خلال ±${settings.intercityDriverBlockHours} ساعة.`
              : `Mode urbain suspendu (±${settings.intercityDriverBlockHours} h) : trajet inter-wilaya ${intercityUrbanBlock.blockingTrip?.requestCode ?? ''} planifié le ${formatDateDz(intercityUrbanBlock.blockingTrip?.preferredDate ?? '', locale)}.`}
          </span>
        </div>
      )}

      {errorBanner && (
        <div role="alert" className="p-3.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/45 text-red-800 dark:text-red-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button type="button" onClick={() => setErrorBanner(null)} className="text-xs underline">
            {isAr ? 'إغلاق' : 'Fermer'}
          </button>
        </div>
      )}

      {successBanner && (
        <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-900 dark:text-emerald-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button type="button" onClick={() => setSuccessBanner(null)} className="text-xs underline">
            {isAr ? 'إغلاق' : 'Fermer'}
          </button>
        </div>
      )}

      {/* Driver Sub-navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto">
        {(
          [
            { id: 'urban', fr: 'Urbain (En ville)', ar: 'داخل المدينة' },
            { id: 'intercity', fr: 'Longue distance (Inter-wilaya)', ar: 'بين الولايات' },
            { id: 'subscription', fr: 'Abonnement & Voucher', ar: 'الاشتراك والتعبئة' },
            { id: 'kyc', fr: 'Mon dossier KYC', ar: 'ملف الوثائق' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === item.id
                ? 'bg-brand-700 dark:bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-200'
            }`}
          >
            {isAr ? item.ar : item.fr}
          </button>
        ))}
      </div>

      {/* ==================== TAB 1 : URBAIN ==================== */}
      {tab === 'urban' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Active Ride Execution + Auto-bid Settings */}
          <div className="lg:col-span-6 space-y-5">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isAr ? 'الرحلة الجارية' : 'Course active en cours'}
              </h3>

            {!activeDriverRide ? (
              <div className="p-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'لا توجد رحلة مسندة حالياً. قدّم عرضاً على الطلبات القريبة.'
                  : 'Aucune course attribuée. Répondez aux demandes proches à droite.'}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{activeDriverRide.rideCode}</span>
                    <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatDzd(activeDriverRide.finalAgreedPriceDzd ?? activeDriverRide.estimatedPriceDzd, locale)}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeDriverRide.clientName}
                    {canRevealUrbanContact(activeDriverRide.status) && activeDriverRide.clientPhone ? (
                      <> · <span className="font-mono text-xs">{activeDriverRide.clientPhone}</span></>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {activeDriverRide.pickup.address}
                    {activeDriverRide.dropoff ? ` → ${activeDriverRide.dropoff.address}` : ' → Décharge'}
                  </div>
                  <div className="text-xs font-semibold text-orange-700 dark:text-orange-400 pt-1">
                    {isAr
                      ? RIDE_STATUS_LABELS[activeDriverRide.status].ar
                      : RIDE_STATUS_LABELS[activeDriverRide.status].fr}
                    {activeDriverRide.status === 'loading' && (
                      <span className="ms-2 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        ({Math.floor(loadingSeconds / 60)}:{String(loadingSeconds % 60).padStart(2, '0')})
                      </span>
                    )}
                  </div>
                </div>

                {isOngoingTrackableRide(activeDriverRide.status) && (
                  <LiveTrackingMap ride={activeDriverRide} locale={locale} theme={theme} compact />
                )}

                {/* Geofence test toggle & GPS step simulator */}
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={simulateNearPickup}
                      onChange={(e) => setSimulateNearPickup(e.target.checked)}
                    />
                    <span>{isAr ? 'موقع GPS قريب (≤ 300 م)' : 'Position GPS dans le rayon ≤ 300 m'}</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAutoStreamGps((v) => !v)}
                      className={`px-2.5 py-1 rounded border font-medium transition-colors ${
                        autoStreamGps
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {autoStreamGps
                        ? isAr
                          ? 'إيقاف البث التلقائي'
                          : 'Stop flux GPS WS'
                        : isAr
                        ? 'بث GPS تلقائي'
                        : 'Flux GPS auto'}
                    </button>
                    <button
                      type="button"
                      onClick={() => pushSimulatedPosition(activeDriverRide)}
                      className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium inline-flex items-center gap-1"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>{isAr ? 'تحديث الموقع' : 'Avancer GPS'}</span>
                    </button>
                    <div className="w-full flex flex-wrap items-center gap-2 text-[11px]">
                      <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full ${
                        gps.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : gps.status === 'queued' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                        : gps.status === 'offline' ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {gps.status === 'active' ? (isAr ? 'GPS مباشر' : 'GPS en direct')
                          : gps.status === 'queued' ? (isAr ? 'قيد الانتظار' : 'En file d’attente')
                          : gps.status === 'offline' ? (isAr ? 'بدون اتصال' : 'Hors ligne')
                          : gps.status === 'denied' ? (isAr ? 'موقع مرفوض' : 'Position refusée')
                          : (isAr ? 'غير مفعّل' : 'Inactif')}
                      </span>
                      {gps.queued > 0 && (
                        <button type="button" onClick={() => void gps.flush()}
                          className="font-semibold text-orange-700 dark:text-orange-400 hover:underline">
                          {gps.queued} {isAr ? 'موقع محفوظ → إرسال' : 'position(s) en attente → envoyer'}
                        </button>
                      )}
                      {gps.lastAt && <span className="text-slate-400 tabular-nums">{new Date(gps.lastAt).toLocaleTimeString(locale === 'ar' ? 'ar-DZ' : 'fr-DZ')}</span>}
                    </div>
                  </div>
                </div>

                {/* One-Hand Primary Execution Action Buttons (§10.4) */}
                <div className="space-y-2">
                  {activeDriverRide.status === 'assigned' && (
                    <button
                      type="button"
                      onClick={() => advanceUrbanStatus(activeDriverRide, 'driver_arriving')}
                      className="w-full h-12 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                    >
                      {isAr ? 'انطلاق نحو الزبون' : 'Aller au point de départ'}
                    </button>
                  )}
                  {activeDriverRide.status === 'driver_arriving' && (
                    <button
                      type="button"
                      onClick={() => advanceUrbanStatus(activeDriverRide, 'arrived_pickup')}
                      className="w-full h-12 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                    >
                      {isAr ? 'وصلت إلى نقطة الانطلاق' : 'Je suis sur place (départ)'}
                    </button>
                  )}
                  {activeDriverRide.status === 'arrived_pickup' && (
                    <button
                      type="button"
                      onClick={() => advanceUrbanStatus(activeDriverRide, 'loading')}
                      className="w-full h-12 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                    >
                      {isAr ? 'بدء الشحن' : 'Démarrer le chargement'}
                    </button>
                  )}
                  {activeDriverRide.status === 'loading' && (
                    <button
                      type="button"
                      onClick={() => advanceUrbanStatus(activeDriverRide, 'in_transit')}
                      className="w-full h-12 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                    >
                      {isAr ? 'انتهى الشحن — في الطريق' : 'Chargement terminé · En transit'}
                    </button>
                  )}
                  {activeDriverRide.status === 'in_transit' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeDriverRide.dropoff && (
                        <button
                          type="button"
                          onClick={() => advanceUrbanStatus(activeDriverRide, 'arrived_dropoff')}
                          className="h-12 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-bold hover:bg-slate-800 dark:hover:bg-white"
                        >
                          {isAr ? 'وصلت إلى الوجهة' : 'Je suis arrivé'}
                        </button>
                      )}
                      <div className="sm:col-span-2">
                        <ProofOfDeliveryCapture locale={locale} value={proofPhoto} onCapture={(v) => { setProofPhoto(v); if (v) setProofRequired(false); }} />
                        {proofRequired && (
                          <div className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                            {isAr ? 'صورة إثبات التسليم إلزامية قبل الإنهاء.' : 'La photo de livraison est obligatoire avant de terminer.'}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!proofPhoto) { setProofRequired(true); return; }
                          advanceUrbanStatus(activeDriverRide, 'completed');
                        }}
                        className="h-12 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
                      >
                        {isAr ? 'تحصيل نقدي وإنهاء' : 'Encaisser cash & Terminer'}
                      </button>
                    </div>
                  )}
                  {activeDriverRide.status === 'arrived_dropoff' && (
                    <div className="space-y-2">
                      <ProofOfDeliveryCapture locale={locale} value={proofPhoto} onCapture={(v) => { setProofPhoto(v); if (v) setProofRequired(false); }} />
                      {proofRequired && (
                        <div className="text-[11px] text-red-600 dark:text-red-400">
                          {isAr ? 'صورة إثبات التسليم إلزامية قبل الإنهاء.' : 'La photo de livraison est obligatoire avant de terminer.'}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (!proofPhoto) { setProofRequired(true); return; }
                          advanceUrbanStatus(activeDriverRide, 'completed');
                        }}
                        className="w-full h-12 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
                      >
                        {isAr
                          ? `تحصيل ${formatDzd(activeDriverRide.finalAgreedPriceDzd ?? activeDriverRide.estimatedPriceDzd, locale)} وإنهاء`
                          : `Encaissement cash : ${formatDzd(activeDriverRide.finalAgreedPriceDzd ?? activeDriverRide.estimatedPriceDzd, locale)} · Confirmer fin`}
                      </button>
                    </div>
                  )}
                </div>

                {canSendUrbanChat(activeDriverRide.status, settings) ? (
                  <ChatPanel
                    messages={chats.filter((c) => c.parentType === 'ride' && c.parentId === activeDriverRide.id)}
                    senderRole="driver"
                    senderName={driver.fullName}
                    locale={locale}
                    onSend={async (body, kind) => {
                      await apiRequest('/api/v1/chats', {
                        method: 'POST',
                        body: JSON.stringify({
                          parentType: 'ride',
                          parentId: activeDriverRide.id,
                          senderRole: 'driver',
                          senderName: driver.fullName,
                          kind,
                          body,
                        }),
                      });
                      await onRefresh();
                    }}
                  />
                ) : (
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>{TEXTS[locale].contactLockedNotice}</span>
                  </div>
                )}
              </div>
            )}
            </section>

            {/* Dedicated Enchère Automatique Component */}
            <AutoBidPanel
              locale={locale}
              driver={driver}
              searchingRides={nearbySearchingRides}
              draft={autoBidDraft}
              onChangeDraft={setAutoBidDraft}
              onSave={handleSaveAutoBid}
              onRetractOffer={handleRetractOffer}
              saving={savingAutoBid}
              nowMs={nowMs}
            />
          </div>

          {/* Nearby Searching Rides */}
          <section className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isAr ? 'الطلبات القريبة (≤ 15 كم)' : 'Demandes proches en attente d’offres'}
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {nearbySearchingRides.length} {isAr ? 'طلبات' : 'active(s)'}
              </span>
            </div>

            {nearbySearchingRides.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'لا توجد طلبات قريبة في الوقت الحالي.' : 'Aucune demande ouverte dans votre rayon.'}
              </div>
            ) : (
              nearbySearchingRides.map((r) => {
                const alreadyOffered = r.offers.find((o) => o.driverId === driver.id && o.status === 'pending');
                return (
                  <div key={r.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {r.rideCode} · {isAr ? SERVICE_LABELS[r.serviceType].ar : SERVICE_LABELS[r.serviceType].fr} · {r.distanceKm} km
                        </div>
                        {r.preferredDriverId === driver.id && (
                          <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 mt-0.5">
                            {isAr
                              ? 'طلب مباشر من زبون وضعك في المفضلة'
                              : 'Demande prioritaire · Vous êtes dans les favoris de ce client'}
                          </div>
                        )}
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                          {r.pickup.address} {r.dropoff ? `→ ${r.dropoff.address}` : '→ Décharge'}
                        </h4>
                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {isAr ? VEHICLE_LABELS[r.vehicleCategory].ar : VEHICLE_LABELS[r.vehicleCategory].fr} · Étage {r.floorFrom} · {r.portersCount} bras · {r.photos.length} photo(s)
                        </div>
                        {r.volumeNote && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{r.volumeNote}</p>}
                      </div>
                      <div className="text-end shrink-0">
                        <div className="text-xs text-slate-500 dark:text-slate-400">{isAr ? 'المقترح' : 'Conseillé'}</div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                          {formatDzd(r.estimatedPriceDzd, locale)}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {isAr ? 'النطاق المسموح:' : 'Fourchette autorisée :'} {formatDzd(r.priceFloorDzd, locale)} – {formatDzd(r.priceCapDzd, locale)}
                      {r.clientBudgetDzd ? ` · Budget client : ${formatDzd(r.clientBudgetDzd, locale)}` : ''}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span>{TEXTS[locale].contactLockedNotice}</span>
                    </div>

                    {alreadyOffered && (() => {
                      const retract = getOfferRetractStatus(alreadyOffered, nowMs);
                      return (
                        <div className="p-2.5 rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/35 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="font-semibold text-emerald-800 dark:text-emerald-300 tabular-nums">
                            {isAr
                              ? `تم إرسال عرضك (${formatDzd(alreadyOffered.priceDzd, locale)})`
                              : `Votre offre active : ${formatDzd(alreadyOffered.priceDzd, locale)}`}
                            {alreadyOffered.isAutoBid && (
                              <span className="ms-1.5 text-[11px] font-bold text-orange-700 dark:text-orange-400">
                                · {isAr ? 'مزايدة تلقائية' : 'Auto-bid'}
                              </span>
                            )}
                          </div>
                          {retract.canRetract ? (
                            <button
                              type="button"
                              data-testid="retract-offer-button"
                              onClick={() => handleRetractOffer(r.id, alreadyOffered.id)}
                              className="h-7 px-2.5 rounded border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 font-semibold inline-flex items-center gap-1 tabular-nums"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>
                                {isAr
                                  ? `سحب العرض (${retract.remainingLabel})`
                                  : `Rétracter (${retract.remainingLabel})`}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {isAr ? 'انتهت مهلة السحب (3 دقائق)' : 'Fenêtre de rétractation (3 min) expirée'}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={intercityUrbanBlock.blocked}
                        onClick={() => sendUrbanBid(r, r.estimatedPriceDzd)}
                        className="h-9 px-3.5 rounded-md bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 disabled:opacity-40 whitespace-nowrap"
                      >
                        {isAr
                          ? `قبول (${formatDzd(r.estimatedPriceDzd, locale)})`
                          : `Accepter le prix (${formatDzd(r.estimatedPriceDzd, locale)})`}
                      </button>

                      <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                        <input
                          type="number"
                          aria-label={isAr ? 'سعر مقترح بالدينار' : 'Proposer un autre prix en DA'}
                          placeholder={isAr ? 'سعر آخر (دج)' : 'Autre prix DA'}
                          value={bidPrices[r.id] ?? ''}
                          onChange={(e) => setBidPrices((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          className="h-9 w-28 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs tabular-nums"
                        />
                        <input
                          type="text"
                          placeholder={isAr ? 'رسالة قصيرة...' : 'Message optionnel'}
                          value={bidMessages[r.id] ?? ''}
                          onChange={(e) => setBidMessages((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          className="h-9 flex-1 min-w-0 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs"
                        />
                        <button
                          type="button"
                          disabled={intercityUrbanBlock.blocked}
                          onClick={() => sendUrbanBid(r)}
                          className="h-9 px-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
                        >
                          {isAr ? 'تقديم سعر' : 'Proposer'}
                        </button>
                      </div>

                      <button
                        type="button"
                        data-testid="ignore-ride-button"
                        onClick={() => handleIgnoreRide(r)}
                        className="h-9 px-2.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تجاهل' : 'Ignorer'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      )}

      {/* ==================== TAB 2 : LONGUE DISTANCE ==================== */}
      {tab === 'intercity' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Coverage & Empty Returns */}
          <section className="lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {isAr ? 'خطوط التغطية المصرح بها' : 'Ma couverture longue distance'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isAr ? 'مستقلة عن التوفر داخل المدينة.' : 'Indépendante de votre disponibilité en ville.'}
                </p>
              </div>

              <div className="space-y-1.5">
                {driver.coverageAxes.map((ax, idx) => (
                  <div key={idx} className="text-xs px-3 py-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex justify-between">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {wilayaName(ax.fromWilaya)} → {ax.toWilaya ? wilayaName(ax.toWilaya) : isAr ? 'جميع الولايات' : 'Toutes destinations'}
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">{isAr ? 'مفعل' : 'Actif'}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <select
                  value={covFrom}
                  onChange={(e) => setCovFrom(Number(e.target.value))}
                  aria-label="Wilaya départ couverture"
                  className="h-9 px-2 rounded border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {wilayas.map((w) => (
                    <option key={w.code} value={w.code}>
                      {isAr ? w.nameAr : w.nameFr}
                    </option>
                  ))}
                </select>
                <select
                  value={covTo}
                  onChange={(e) => setCovTo(e.target.value)}
                  aria-label="Wilaya destination couverture"
                  className="h-9 px-2 rounded border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="all">{isAr ? 'جميع الولايات' : 'Toutes'}</option>
                  {wilayas.map((w) => (
                    <option key={w.code} value={w.code}>
                      {isAr ? w.nameAr : w.nameFr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCoverage}
                  className="h-9 px-3 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-medium"
                >
                  {isAr ? 'إضافة محور' : 'Ajouter axe'}
                </button>
              </div>
            </div>

            {/* Empty Return Declarations */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {isAr ? 'التصريح بعودة فارغة' : 'Déclarer un retour à vide'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isAr
                    ? 'يسمح بخصم حتى 25% وتلقي تنبيهات فورية.'
                    : 'Permet de proposer jusqu’à −25 % sous le prix de référence avec badge dédié.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={erFrom}
                  onChange={(e) => setErFrom(Number(e.target.value))}
                  aria-label="Retour à vide départ"
                  className="h-9 px-2 rounded border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {wilayas.map((w) => (
                    <option key={w.code} value={w.code}>
                      {isAr ? w.nameAr : w.nameFr}
                    </option>
                  ))}
                </select>
                <select
                  value={erTo}
                  onChange={(e) => setErTo(Number(e.target.value))}
                  aria-label="Retour à vide arrivée"
                  className="h-9 px-2 rounded border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {wilayas.map((w) => (
                    <option key={w.code} value={w.code}>
                      {isAr ? w.nameAr : w.nameFr}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={erDate}
                  onChange={(e) => setErDate(e.target.value)}
                  className="h-9 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs tabular-nums"
                />
              </div>
              <button
                type="button"
                onClick={handleDeclareEmptyReturn}
                className="w-full h-9 rounded-md bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700"
              >
                {isAr ? 'نشر العودة الفارغة' : 'Publier ce retour à vide'}
              </button>

              {driverEmptyReturns.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {driverEmptyReturns.map((er) => (
                    <div key={er.id} className="text-xs text-slate-700 dark:text-slate-300 flex justify-between">
                      <span>
                        {wilayaName(er.fromWilaya)} → {wilayaName(er.toWilaya)}
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">{formatDateDz(er.departDate, locale)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Right: Opportunities & Booked Intercity Trips */}
          <section className="lg:col-span-7 space-y-5">
            {driverIntercityActive.map((ic) => (
              <div key={ic.id} className="bg-white dark:bg-slate-900 border border-orange-300 dark:border-orange-800 rounded-lg p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-orange-700 dark:text-orange-400 font-semibold">
                      {ic.requestCode} · {isAr ? 'رحلة مؤكدة' : 'Trajet retenu'}
                    </div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {wilayaName(ic.fromWilaya)} → {wilayaName(ic.toWilaya)} ({formatDateDz(ic.preferredDate, locale)})
                    </h4>
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      {ic.clientName}
                      {canRevealIntercityContact(ic.status) && ic.clientPhone ? ` · ${ic.clientPhone}` : ''} · {ic.pickupAddress} → {ic.dropoffAddress}
                    </div>
                  </div>
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {formatDzd(ic.agreedPriceDzd ?? ic.refPriceDzd, locale)}
                  </span>
                </div>

                {/* Pre-trip checklist (§10.8) */}
                <div className="p-3 rounded bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 text-xs">
                  {(
                    [
                      { key: 'truckChecked', fr: 'Camion vérifié', ar: 'تم فحص الشاحنة' },
                      { key: 'portersConfirmed', fr: 'Bras confirmés', ar: 'تم تأكيد العمال' },
                      { key: 'clientCalled', fr: 'Client appelé (J-1)', ar: 'تم الاتصال بالزبون' },
                    ] as const
                  ).map((chk) => (
                    <label key={chk.key} className="inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={ic.checklist[chk.key]}
                        onChange={async (e) => {
                          await apiRequest(`/api/v1/intercity/requests/${ic.id}/checklist`, {
                            method: 'POST',
                            body: JSON.stringify({ [chk.key]: e.target.checked }),
                          });
                          await onRefresh();
                        }}
                      />
                      <span>{isAr ? chk.ar : chk.fr}</span>
                    </label>
                  ))}
                </div>

                {isOngoingTrackableIntercity(ic.status) && (
                  <div className="space-y-2">
                    <LiveTrackingMap
                      intercity={ic}
                      wilayas={wilayas}
                      locale={locale}
                      theme={theme}
                      compact
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        data-testid="driver-ic-auto-gps"
                        onClick={() =>
                          setAutoStreamIntercityId((prev) => (prev === ic.id ? null : ic.id))
                        }
                        className={`h-9 px-3 rounded border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                          autoStreamIntercityId === ic.id
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>
                          {autoStreamIntercityId === ic.id
                            ? isAr
                              ? 'البث المباشر نشط'
                              : 'Flux GPS auto actif'
                            : isAr
                            ? 'بث GPS تلقائي'
                            : 'Flux GPS auto'}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-testid="driver-ic-advance-gps"
                        onClick={() => pushSimulatedIntercityPosition(ic)}
                        className="h-9 px-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تحديث موقع GPS' : 'Avancer GPS'}</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {ic.status === 'booked' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/v1/intercity/requests/${ic.id}/status`, {
                          method: 'PATCH',
                          body: JSON.stringify({ toStatus: 'in_progress', actor: 'driver', note: 'Chargement effectué' }),
                        });
                        await onRefresh();
                      }}
                      className="h-10 px-4 rounded bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
                    >
                      {isAr ? 'تم الشحن (البدء)' : 'Chargement effectué'}
                    </button>
                  )}
                  {ic.status === 'in_progress' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/v1/intercity/requests/${ic.id}/status`, {
                          method: 'PATCH',
                          body: JSON.stringify({ toStatus: 'completed', actor: 'driver', note: 'Livraison confirmée' }),
                        });
                        await onRefresh();
                      }}
                      className="h-10 px-4 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      {isAr ? 'تم التسليم' : 'Livré'}
                    </button>
                  )}
                </div>

                {/* Price revision (capped at +30%) */}
                {(ic.status === 'booked' || ic.status === 'in_progress') && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      placeholder="Révision DA (+30% max)"
                      value={revisionPrice}
                      onChange={(e) => setRevisionPrice(e.target.value)}
                      className="h-9 w-40 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs tabular-nums"
                    />
                    <input
                      type="text"
                      value={revisionReason}
                      onChange={(e) => setRevisionReason(e.target.value)}
                      className="h-9 flex-1 min-w-0 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setErrorBanner(null);
                        try {
                          await apiRequest(`/api/v1/intercity/requests/${ic.id}/price-revision`, {
                            method: 'POST',
                            body: JSON.stringify({ proposedPriceDzd: Number(revisionPrice), reason: revisionReason }),
                          });
                          setSuccessBanner('Demande de révision envoyée au client.');
                          await onRefresh();
                        } catch (e) {
                          notifyError(e);
                        }
                      }}
                      className="h-9 px-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      {isAr ? 'طلب مراجعة السعر' : 'Réviser le prix'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {isAr ? 'فرص بين الولايات المتاحة' : 'Opportunités inter-wilaya (devis scellés)'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isAr
                    ? 'العروض سرية: لا يرى السائق أسعار المنافسين وأرقام الهاتف مقفلة حتى تأكيد الحجز.'
                    : 'Les devis sont scellés : vous ne voyez jamais les prix concurrents et les coordonnées restent masquées avant réservation.'}
                </p>
              </div>

              {!intercityEligibility.eligible && (
                <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/45 text-red-900 dark:text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {intercityEligibility.code === 'INTERCITY_QUALITY_SUSPENDED'
                      ? isAr
                        ? 'تم تعليق وصولك لفرص بين الولايات لانخفاض متوسط تقييمك عن 3.5/5.'
                        : 'Accès inter-wilaya suspendu (§7.5) : note moyenne longue distance inférieure à 3,5/5 (≥ 3 avis).'
                      : isAr
                      ? 'يجب أن يكون حسابك معتمداً واشتراكك نشطاً لتقديم عروض بين الولايات.'
                      : 'Votre compte doit être validé (KYC) avec abonnement actif pour soumettre des devis longue distance.'}
                  </span>
                </div>
              )}

              {intercityOpportunities.length === 0 ? (
                <div className="p-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                  {isAr ? 'لا توجد طلبات تطابق مساراتك حالياً.' : 'Aucune demande ne correspond à votre couverture.'}
                </div>
              ) : (
                intercityOpportunities.map((ic) => {
                  const myQuote = ic.quotes.find((q) => q.driverId === driver.id && q.status !== 'withdrawn');
                  const draft = icQuoteDrafts[ic.id] ?? {
                    price: String(ic.refPriceDzd),
                    date: ic.preferredDate,
                    isEmptyReturn: false,
                    isGroupage: false,
                    message: 'Disponible avec matériel de protection.',
                  };
                  return (
                    <div key={ic.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            {ic.requestCode} · {ic.distanceKm} km · {formatDateDz(ic.preferredDate, locale)} ({ic.dateFlexibility})
                          </div>
                          {ic.preferredDriverId === driver.id && (
                            <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 mt-0.5">
                              {isAr
                                ? 'طلب مباشر من زبون وضعك في المفضلة'
                                : 'Demande prioritaire · Vous êtes dans les favoris de ce client'}
                            </div>
                          )}
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {wilayaName(ic.fromWilaya)} → {wilayaName(ic.toWilaya)}
                          </h4>
                          <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                            {ic.volumeNote} · {ic.portersCount} bras · {ic.photos.length} photos
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="text-xs text-slate-500 dark:text-slate-400">{isAr ? 'المرجعي' : 'Référence'}</div>
                          <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                            {formatDzd(ic.refPriceDzd, locale)}
                          </div>
                        </div>
                      </div>

                      {myQuote?.status === 'countered' && myQuote.clientCounterPriceDzd && (
                        <div className="p-3 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/45 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-amber-900 dark:text-amber-200">
                            {isAr ? 'عرض مضاد من الزبون:' : 'Contre-proposition client :'}{' '}
                            {formatDzd(myQuote.clientCounterPriceDzd, locale)}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiRequest(`/api/v1/intercity/quotes/${myQuote.id}/respond-counter`, {
                                  method: 'POST',
                                  body: JSON.stringify({ accept: true }),
                                });
                                await onRefresh();
                              }}
                              className="px-3 py-1 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium"
                            >
                              {isAr ? 'قبول' : 'Accepter'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiRequest(`/api/v1/intercity/quotes/${myQuote.id}/respond-counter`, {
                                  method: 'POST',
                                  body: JSON.stringify({ accept: false }),
                                });
                                await onRefresh();
                              }}
                              className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium"
                            >
                              {isAr ? 'رفض' : 'Refuser'}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <input
                          type="number"
                          value={draft.price}
                          onChange={(e) =>
                            setIcQuoteDrafts((prev) => ({
                              ...prev,
                              [ic.id]: { ...draft, price: e.target.value },
                            }))
                          }
                          aria-label="Prix du devis DA"
                          className="h-9 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs tabular-nums"
                        />
                        <input
                          type="date"
                          value={draft.date}
                          onChange={(e) =>
                            setIcQuoteDrafts((prev) => ({
                              ...prev,
                              [ic.id]: { ...draft, date: e.target.value },
                            }))
                          }
                          aria-label="Date disponible"
                          className="h-9 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs tabular-nums"
                        />
                        <button
                          type="button"
                          disabled={!intercityEligibility.eligible}
                          onClick={() => handleSendIntercityQuote(ic)}
                          className="h-9 px-3 rounded bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 disabled:opacity-40 col-span-2 sm:col-span-1"
                        >
                          {myQuote ? (isAr ? 'تحديث العرض' : 'Mettre à jour devis') : isAr ? 'إرسال عرض سعر' : 'Envoyer devis'}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-slate-700 dark:text-slate-300">
                        <label className="inline-flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={draft.isEmptyReturn}
                            onChange={(e) =>
                              setIcQuoteDrafts((prev) => ({
                                ...prev,
                                [ic.id]: { ...draft, isEmptyReturn: e.target.checked },
                              }))
                            }
                          />
                          <span>{isAr ? 'عودة فارغة (حتى -25%)' : 'Retour à vide (jusqu’à −25 %)'}</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={draft.isGroupage}
                            onChange={(e) =>
                              setIcQuoteDrafts((prev) => ({
                                ...prev,
                                [ic.id]: { ...draft, isGroupage: e.target.checked },
                              }))
                            }
                          />
                          <span>{isAr ? 'شحن مشترك (حتى -35%)' : 'Groupage (jusqu’à −35 %)'}</span>
                        </label>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {/* ==================== TAB 3 : ABONNEMENT & VOUCHER ==================== */}
      {tab === 'subscription' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {isAr ? 'خطة الظهور (0% عمولة)' : 'Visibilité Pro · 0 % commission'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatDzd(settings.proPriceDzd, locale)} / 30 {isAr ? 'يوم' : 'jours'}
                  {' · '}
                  {isAr ? 'تظهر أولاً في الدليل فقط' : 'Apparaissez en premier dans l’annuaire'}
                </p>
              </div>
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {subComputed.daysLeft} j
              </span>
            </div>

            {/* Statut du plan + preuve de valeur (conversion) */}
            <div className="p-3.5 rounded-lg border border-purple-200 dark:border-purple-900/60 bg-purple-50/60 dark:bg-purple-950/20 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-700 dark:text-purple-400 shrink-0" />
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-200">{planLabel}</span>
                </div>
                {tier === 'pro' ? (
                  <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-black text-[10px]">PRO</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => document.getElementById('pro-payment-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-orange-600 text-white text-[11px] font-bold hover:bg-orange-700"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isAr ? 'كن برو' : 'Passer Pro'}
                    <span className="opacity-90">· {formatDzd(settings.proPriceDzd, locale)}</span>
                  </button>
                )}
              </div>

              {/* Panneau de preuve — compteurs existants, aucun nouveau tracking */}
              <div data-testid="driver-proof-panel" className="grid grid-cols-3 gap-2 border-t border-purple-200/70 dark:border-purple-800/60 pt-3">
                <div className="text-center">
                  <div className="text-base font-black text-purple-900 dark:text-purple-200 tabular-nums">
                    {driver.requestsReceivedCount ?? 0}
                  </div>
                  <div className="text-[10px] text-purple-800/80 dark:text-purple-300/80 leading-tight">
                    {isAr ? 'طلبات مستلمة' : 'demandes reçues'}
                  </div>
                </div>
                <div className="text-center border-x border-purple-200/70 dark:border-purple-800/60">
                  <div className="text-base font-black text-purple-900 dark:text-purple-200 tabular-nums">
                    {driver.ridesCompleted ?? 0}
                  </div>
                  <div className="text-[10px] text-purple-800/80 dark:text-purple-300/80 leading-tight">
                    {isAr ? 'رحلات منجزة' : 'courses'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-base font-black text-purple-900 dark:text-purple-200 tabular-nums">
                    {(driver.ratingAvg ?? 0) > 0 ? driver.ratingAvg.toFixed(1) : '—'}<span className="text-[11px]">/5</span>
                  </div>
                  <div className="text-[10px] text-purple-800/80 dark:text-purple-300/80 leading-tight">
                    {isAr ? 'التقييم' : 'note'}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-purple-800/70 dark:text-purple-300/70">
                {isAr
                  ? 'هذه أرقام ملفك الحقيقية. الخطة لا تغير استقبال الطلبات، بل ترتيبك في الدليل.'
                  : 'Ce sont les chiffres réels de votre profil. Le plan ne change pas la réception des courses, seulement votre rang dans l’annuaire.'}
              </p>
            </div>

            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${
                  subComputed.status === 'expired'
                    ? 'bg-red-600'
                    : subComputed.status === 'grace'
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.min(100, Math.max(4, (subComputed.daysLeft / 30) * 100))}%` }}
              />
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div>
                {isAr ? 'الحالة:' : 'Statut :'}{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {isAr ? SUB_STATUS_LABELS[subComputed.status].ar : SUB_STATUS_LABELS[subComputed.status].fr}
                </strong>{' '}
                ({driver.subscription.kind})
              </div>
              <div>
                {isAr ? 'صالح إلى غاية:' : 'Actif jusqu’au :'}{' '}
                <strong className="font-mono text-slate-900 dark:text-slate-100">{formatDateDz(driver.subscription.endsOn, locale)}</strong>
              </div>
              <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800">
                {isAr ? 'محفظتك:' : 'Votre portefeuille :'}{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {driverPayments.length} {isAr ? 'عملية' : 'opération(s)'} · {driverPayments.filter((p) => p.status === 'approved').length}{' '}
                  {isAr ? 'مدفوعة' : 'validée(s)'} · {vouchers.filter((v) => v.uses > 0).length} {isAr ? 'قسيمة مستخدمة' : 'voucher(s) utilisé(s)'}
                </strong>
              </div>
            </div>

            {/* CCP / BaridiMob Instructions */}
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {isAr ? 'معلومات الدفع عبر البريد / بريدي موب' : 'Coordonnées CCP / BaridiMob'}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{settings.ccpAccount}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(settings.ccpAccount);
                    setCopiedCcp(true);
                    setTimeout(() => setCopiedCcp(false), 1500);
                  }}
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-medium inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedCcp ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {settings.ccpHolder} · Indiquez votre numéro {driver.phone} en référence.
              </div>
            </div>

            {/* Redeem Voucher */}
            <form onSubmit={handleRedeemVoucher} className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <label htmlFor="voucher-code" className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                {isAr ? 'تفعيل بطاقة تعبئة (Voucher)' : 'J’ai un code de recharge (Voucher)'}
              </label>
              <div className="flex gap-2">
                <input
                  id="voucher-code"
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-mono uppercase"
                />
                <button
                  type="submit"
                  className="h-10 px-4 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Ticket className="w-4 h-4" />
                  <span>{isAr ? 'تفعيل' : 'Activer'}</span>
                </button>
              </div>
            </form>
          </section>

          <section className="lg:col-span-7 space-y-5">
            <form id="pro-payment-form" onSubmit={handleSubmitPayment} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isAr ? 'إرسال وصل الدفع' : 'Envoyer un justificatif BaridiMob / CCP'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="pay-method" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'الوسيلة' : 'Méthode'}
                  </label>
                  <select
                    id="pay-method"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as 'baridimob' | 'ccp')}
                    className="w-full h-10 px-2.5 rounded border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="baridimob">BaridiMob</option>
                    <option value="ccp">Virement CCP</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pay-ref" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'رقم المرجع' : 'N° Référence'}
                  </label>
                  <input
                    id="pay-ref"
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="w-full h-10 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="pay-proof" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'صورة الوصل' : 'Fichier reçu'}
                  </label>
                  <input
                    id="pay-proof"
                    type="text"
                    value={payProof}
                    onChange={(e) => setPayProof(e.target.value)}
                    className="w-full h-10 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="h-10 px-5 rounded-md bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 inline-flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {isAr
                    ? `إرسال للمراجعة (${formatDzd(settings.proPriceDzd, locale)})`
                    : `Soumettre le justificatif (${formatDzd(settings.proPriceDzd, locale)})`}
                </span>
              </button>
            </form>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isAr ? 'سجل المدفوعات' : 'Historique des paiements'}
              </h4>
              {driverPayments.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Aucun paiement soumis.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {driverPayments.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 uppercase">{p.method}</span>
                        <span className="mx-1.5 text-slate-400 dark:text-slate-500">·</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">{p.reference}</span>
                        {p.rejectionReason && (
                          <span className="ms-2 text-red-700 dark:text-red-400">({p.rejectionReason})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">{formatDzd(p.amountDzd, locale)}</span>
                        <span
                          className={`font-semibold ${
                            p.status === 'approved'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : p.status === 'rejected'
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ==================== TAB 4 : DOSSIER KYC ==================== */}
      {tab === 'kyc' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isAr ? 'ملف التحقق والمركبة (KYC)' : 'Dossier d’onboarding & pièces KYC'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {driver.vehicle.brand} {driver.vehicle.model} · {driver.vehicle.plateNumber} · {driver.vehicle.maxLoadKg} kg / {driver.vehicle.volumeM3} m³
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
              <ShieldCheck className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span>{isAr ? DRIVER_STATUS_LABELS[driver.status].ar : DRIVER_STATUS_LABELS[driver.status].fr}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {driver.documents.map((doc) => (
              <div key={doc.id} className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/50 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100">
                  <span className="inline-flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>{doc.docType}</span>
                  </span>
                  <span
                    className={
                      doc.status === 'approved'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : doc.status === 'rejected'
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }
                  >
                    {doc.status}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">{doc.fileName}</div>
                {doc.expiresOn && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Expire : {formatDateDz(doc.expiresOn, locale)}</div>
                )}
                {doc.reviewNote && <div className="text-xs text-red-700 dark:text-red-400">{doc.reviewNote}</div>}
              </div>
            ))}
          </div>

          {driver.status === 'pending_documents' && (
            <button
              type="button"
              onClick={async () => {
                await apiRequest(`/api/v1/driver/${driver.id}/documents/submit`, { method: 'POST' });
                await onRefresh();
              }}
              className="h-10 px-5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
            >
              {isAr ? 'إرسال الملف للمراجعة' : 'Soumettre le dossier pour revue'}
            </button>
          )}
        </div>
      )}

      {/* Driver Verified Client Feedback */}
      <DriverReviewsSection
        id="driver-own-reviews"
        locale={locale}
        drivers={drivers}
        reviews={reviews}
        selectedDriverId={driver.id}
        lockDriverFilter
        titleFr={`Avis clients reçus (${driver.fullName})`}
        titleAr={`تقييمات الزبائن المستلمة (${driver.fullName})`}
      />
      </>
      )}
    </div>
  );
}
