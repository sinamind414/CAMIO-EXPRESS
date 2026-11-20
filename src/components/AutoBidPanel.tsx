import { AlertTriangle, Clock, RotateCcw, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { getOfferRetractStatus, previewAutoBidMatches } from '../domain/autoBid';
import { formatDzd, SERVICE_LABELS } from '../domain/i18n';
import type { AutoBidConfig, DriverProfile, Locale, Ride, ServiceType } from '../domain/types';

interface AutoBidPanelProps {
  locale: Locale;
  driver: DriverProfile;
  searchingRides: Ride[];
  draft: AutoBidConfig;
  onChangeDraft: (updater: (prev: AutoBidConfig) => AutoBidConfig) => void;
  onSave: (e: React.FormEvent) => Promise<void> | void;
  onRetractOffer: (rideId: string, offerId: string) => Promise<void> | void;
  saving: boolean;
  nowMs: number;
}

export function AutoBidPanel({
  locale,
  driver,
  searchingRides,
  draft,
  onChangeDraft,
  onSave,
  onRetractOffer,
  saving,
  nowMs,
}: AutoBidPanelProps) {
  const isAr = locale === 'ar';

  const compatibleMatches = useMemo(
    () => previewAutoBidMatches(searchingRides, driver, draft),
    [searchingRides, driver, draft]
  );

  const pendingDriverOffers = useMemo(() => {
    const items: Array<{ ride: Ride; offer: Ride['offers'][number] }> = [];
    for (const ride of searchingRides) {
      for (const offer of ride.offers) {
        if (offer.driverId === driver.id && offer.status === 'pending') {
          items.push({ ride, offer });
        }
      }
    }
    return items;
  }, [searchingRides, driver.id]);

  const sample10KmPrice = Math.max(draft.minFloorPriceDzd, Math.round((10 * draft.ratePerKmDzd) / 500) * 500);
  const canAutoTrigger = driver.status === 'approved' && driver.isOnline;

  return (
    <section
      data-testid="driver-autobid-panel"
      aria-labelledby="autobid-heading"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="autobid-heading"
            className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-orange-600 shrink-0" />
            <span>{isAr ? 'المزايدة التلقائية' : 'Enchère Automatique'}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'حدّد سعرك الأدنى لكل كيلومتر وفعّل القاعدة لإرسال العروض فورياً على الرحلات المتوافقة، مع مهلة سحب 3 دقائق.'
              : 'Définissez votre prix plancher au km et activez la règle pour répondre instantanément aux trajets compatibles (rétractation possible sous 3 min).'}
          </p>
        </div>

        <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200 select-none">
          <input
            type="checkbox"
            data-testid="driver-autobid-toggle"
            checked={draft.enabled}
            onChange={(e) => onChangeDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="w-4 h-4 accent-orange-600 rounded"
          />
          <span className={draft.enabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
            {draft.enabled
              ? isAr
                ? 'القاعدة مفعّلة'
                : 'Règle active'
              : isAr
              ? 'القاعدة متوقفة'
              : 'Règle désactivée'}
          </span>
        </label>
      </div>

      {/* Availability Guard Notice */}
      {!canAutoTrigger && (
        <div className="p-2.5 rounded-md border border-amber-200 dark:border-amber-900/80 bg-amber-50/70 dark:bg-amber-950/35 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <span>
            {driver.status !== 'approved'
              ? isAr
                ? 'سيتم تفعيل الإرسال التلقائي فور اعتماد ملفك من الإدارة.'
                : 'L’envoi automatique démarrera dès la validation de votre dossier KYC.'
              : isAr
              ? 'حسابك غير متصل حالياً — مرّر الحالة إلى « متاح » ليتم إرسال العروض تلقائياً.'
              : 'Vous êtes hors ligne : passez en ligne pour que cette règle envoie automatiquement vos offres.'}
          </span>
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={onSave} className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label
              htmlFor="autobid-rate-km"
              className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {isAr ? 'السعر الأدنى / كم (دج)' : 'Prix plancher / km (DA)'}
            </label>
            <input
              id="autobid-rate-km"
              data-testid="autobid-rate-input"
              type="number"
              min={100}
              step={50}
              value={draft.ratePerKmDzd}
              onChange={(e) =>
                onChangeDraft((prev) => ({
                  ...prev,
                  ratePerKmDzd: Number(e.target.value || 0),
                }))
              }
              className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label
              htmlFor="autobid-floor"
              className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {isAr ? 'الحد الأدنى الإجمالي (دج)' : 'Plancher minimum (DA)'}
            </label>
            <input
              id="autobid-floor"
              data-testid="autobid-floor-input"
              type="number"
              min={1000}
              step={500}
              value={draft.minFloorPriceDzd}
              onChange={(e) =>
                onChangeDraft((prev) => ({
                  ...prev,
                  minFloorPriceDzd: Number(e.target.value || 0),
                }))
              }
              className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label
              htmlFor="autobid-max-dist"
              className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {isAr ? 'المسافة القصوى (كم)' : 'Rayon max (km)'}
            </label>
            <input
              id="autobid-max-dist"
              data-testid="autobid-distance-input"
              type="number"
              min={5}
              max={200}
              value={draft.maxDistanceKm}
              onChange={(e) =>
                onChangeDraft((prev) => ({
                  ...prev,
                  maxDistanceKm: Number(e.target.value || 0),
                }))
              }
              className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-mono tabular-nums"
            />
          </div>
        </div>

        {/* Service Filters */}
        <div>
          <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {isAr ? 'أنواع الخدمات المشمولة بالقاعدة' : 'Services couverts par la règle'}
          </span>
          <div className="flex flex-wrap gap-2">
            {(['moving', 'freight', 'refrigerated', 'towing', 'waste_removal'] as ServiceType[]).map((st) => {
              const checked = draft.serviceTypes.includes(st);
              return (
                <label
                  key={st}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs cursor-pointer transition-colors ${
                    checked
                      ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/35 text-orange-900 dark:text-orange-200 font-medium'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      onChangeDraft((prev) => {
                        const next = e.target.checked
                          ? [...prev.serviceTypes, st]
                          : prev.serviceTypes.filter((x) => x !== st);
                        return {
                          ...prev,
                          serviceTypes: next.length > 0 ? next : prev.serviceTypes,
                        };
                      });
                    }}
                    className="accent-orange-600"
                  />
                  <span>{isAr ? SERVICE_LABELS[st].ar : SERVICE_LABELS[st].fr}</span>
                </label>
              );
            })}
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.acceptSmallerLoads ?? true}
            onChange={(e) =>
              onChangeDraft((prev) => ({ ...prev, acceptSmallerLoads: e.target.checked }))
            }
            className="accent-orange-600 rounded"
          />
          <span>
            {isAr
              ? 'قبول الأحجام الأصغر المتوافقة مع شاحنتي تلقائياً'
              : 'Accepter aussi les gabarits inférieurs compatibles avec mon véhicule'}
          </span>
        </label>

        {/* Message & Submit */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          <div className="sm:col-span-7">
            <input
              type="text"
              aria-label={isAr ? 'رسالة العرض التلقائي' : 'Message joint aux offres automatiques'}
              value={draft.message}
              onChange={(e) => onChangeDraft((prev) => ({ ...prev, message: e.target.value }))}
              placeholder={isAr ? 'رسالة مرفقة بالعرض الآلي...' : 'Message joint aux offres automatiques...'}
              className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
            />
          </div>
          <div className="sm:col-span-5">
            <button
              type="submit"
              data-testid="driver-autobid-save"
              disabled={saving}
              className="w-full h-9 px-3 rounded-md bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
            >
              {saving
                ? isAr
                  ? 'جاري الحفظ...'
                  : 'Application...'
                : draft.enabled
                ? isAr
                  ? 'تفعيل وتطبيق القاعدة'
                  : 'Activer & appliquer la règle'
                : isAr
                ? 'حفظ التفضيلات'
                : 'Enregistrer la règle'}
            </button>
          </div>
        </div>
      </form>

      {/* Rule Preview & Compatible Rides Readout */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600 dark:text-slate-300 tabular-nums">
          <span>
            {isAr ? 'محاكاة 10 كم (بدون عمال):' : 'Simulation 10 km (sans bras) :'}{' '}
            <strong className="text-slate-900 dark:text-slate-100 font-mono">
              {formatDzd(sample10KmPrice, locale)}
            </strong>
          </span>
          <span data-testid="autobid-compatible-count" className="font-semibold text-slate-800 dark:text-slate-200">
            {compatibleMatches.length}{' '}
            {isAr ? 'رحلة متوافقة حالياً' : 'trajet(s) compatible(s) détecté(s)'}
          </span>
        </div>

        {compatibleMatches.length > 0 && (
          <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
            {compatibleMatches.slice(0, 3).map((m) => (
              <div key={m.rideId} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/70 last:border-0 tabular-nums">
                <span className="font-mono">
                  {m.rideCode} · {m.distanceKm} km
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  {m.alreadyOffered
                    ? isAr
                      ? `عرض مرسل (${formatDzd(m.estimatedOfferDzd, locale)})`
                      : `Offre active · ${formatDzd(m.estimatedOfferDzd, locale)}`
                    : isAr
                    ? `عرض متوقع : ${formatDzd(m.estimatedOfferDzd, locale)}`
                    : `Enchère auto estimée : ${formatDzd(m.estimatedOfferDzd, locale)}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Offers Within 3-Min Retraction Window */}
      {pendingDriverOffers.length > 0 && (
        <div
          data-testid="autobid-active-retract-list"
          className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <Clock className="w-3.5 h-3.5 text-orange-600" />
            <span>
              {isAr
                ? 'العروض النشطة · نافذة التراجع 3 دقائق'
                : 'Offres envoyées · Délai de rétractation (3 min)'}
            </span>
          </div>
          <div className="space-y-2">
            {pendingDriverOffers.map(({ ride, offer }) => {
              const retract = getOfferRetractStatus(offer, nowMs);
              return (
                <div
                  key={offer.id}
                  className="p-2.5 rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/35 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="tabular-nums">
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {ride.rideCode}
                    </span>
                    <span className="mx-1.5 text-slate-400">·</span>
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">
                      {formatDzd(offer.priceDzd, locale)}
                    </span>
                    {offer.isAutoBid && (
                      <span className="ms-1.5 text-[11px] font-semibold text-orange-700 dark:text-orange-400">
                        · {isAr ? 'آلي' : 'Auto-bid'}
                      </span>
                    )}
                  </div>
                  {retract.canRetract ? (
                    <button
                      type="button"
                      data-testid="autobid-panel-retract-btn"
                      onClick={() => onRetractOffer(ride.id, offer.id)}
                      className="h-7 px-2.5 rounded border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 font-semibold inline-flex items-center gap-1 tabular-nums"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>
                        {isAr
                          ? `سحب (${retract.remainingLabel})`
                          : `Rétracter (${retract.remainingLabel})`}
                      </span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isAr ? 'انتهت مهلة الـ 3 دقائق' : 'Délai 3 min expiré'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
