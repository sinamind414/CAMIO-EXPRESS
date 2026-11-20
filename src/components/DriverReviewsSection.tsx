import { ShieldCheck, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDateDz, SERVICE_LABELS } from '../domain/i18n';
import {
  buildDriverTrustSummary,
  filterDriverReviews,
  translateQualityTag,
} from '../domain/reviews';
import type { DriverProfile, DriverReview, Locale } from '../domain/types';
import { FavoriteToggleButton } from './FavoriteToggleButton';

interface DriverReviewsSectionProps {
  id?: string;
  locale: Locale;
  drivers: DriverProfile[];
  reviews: DriverReview[];
  selectedDriverId?: string;
  onSelectDriverId?: (driverId: string) => void;
  lockDriverFilter?: boolean;
  favoriteDriverIds?: Set<string>;
  onToggleFavorite?: (driverId: string) => void | Promise<void>;
  titleFr?: string;
  titleAr?: string;
}

export function DriverReviewsSection({
  id = 'driver-community-reviews',
  locale,
  drivers,
  reviews,
  selectedDriverId = 'all',
  onSelectDriverId,
  lockDriverFilter = false,
  favoriteDriverIds,
  onToggleFavorite,
  titleFr = 'Confiance & avis clients vérifiés',
  titleAr = 'ثقة المجتمع وتقييمات الزبائن الموثّقة',
}: DriverReviewsSectionProps) {
  const isAr = locale === 'ar';
  const [internalDriverId, setInternalDriverId] = useState<string>(selectedDriverId);
  const [minStars, setMinStars] = useState<number | 'all'>('all');
  const [tripType, setTripType] = useState<'all' | 'urban' | 'intercity'>('all');

  const activeDriverFilter = onSelectDriverId ? selectedDriverId : internalDriverId;
  const setDriverFilter = (val: string) => {
    if (onSelectDriverId) onSelectDriverId(val);
    else setInternalDriverId(val);
  };

  const selectedDriverObj = useMemo(
    () => (activeDriverFilter !== 'all' ? drivers.find((d) => d.id === activeDriverFilter) : undefined),
    [drivers, activeDriverFilter]
  );

  const summary = useMemo(
    () => buildDriverTrustSummary(activeDriverFilter, reviews, selectedDriverObj),
    [activeDriverFilter, reviews, selectedDriverObj]
  );

  const filteredReviews = useMemo(
    () =>
      filterDriverReviews(reviews, {
        driverId: activeDriverFilter,
        minStars,
        tripType,
      }),
    [reviews, activeDriverFilter, minStars, tripType]
  );

  return (
    <section
      id={id}
      data-testid="driver-reviews-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5"
    >
      {/* Header & Driver Selector */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              {isAr ? 'آراء موثّقة بعد إنهاء الرحلات' : 'Avis vérifiés publiés après finalisation de trajet'}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{isAr ? titleAr : titleFr}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'كل تقييم مرتبط برحلة منجزة لتعزيز الشفافية في مجتمع السائقين.'
              : 'Chaque note est rattachée à une course réelle terminée pour garantir la transparence de la communauté.'}
          </p>
        </div>

        {!lockDriverFilter && (
          <div className="min-w-[220px]">
            <label
              htmlFor={`${id}-driver-select`}
              className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              {isAr ? 'تصفية حسب السائق' : 'Filtrer par chauffeur'}
            </label>
            <select
              id={`${id}-driver-select`}
              value={activeDriverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
            >
              <option value="all">{isAr ? 'كل السائقين المعتمدين' : 'Tous les chauffeurs vérifiés'}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Trust KPI & Histogram Strip */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
        {/* Average Score */}
        <div className="md:col-span-4 space-y-1.5">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {selectedDriverObj
              ? selectedDriverObj.fullName
              : isAr
              ? 'متوسط تقييم المجتمع'
              : 'Note moyenne communauté'}
          </div>
          <div className="flex items-baseline gap-2.5">
            <span
              className="text-3xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums"
              data-testid="reviews-avg-score"
            >
              {summary.averageRating > 0 ? summary.averageRating.toFixed(2) : '—'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              / 5 · {summary.reviewCount} {isAr ? 'تقييم موثّق' : summary.reviewCount > 1 ? 'avis vérifiés' : 'avis vérifié'}
            </span>
          </div>
          <div className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-4 h-4 ${
                  s <= Math.round(summary.averageRating)
                    ? 'fill-current text-amber-500 dark:text-amber-400'
                    : 'text-slate-300 dark:text-slate-600'
                }`}
              />
            ))}
          </div>
          {summary.topTags.length > 0 && (
            <div className="text-xs text-slate-700 dark:text-slate-300 pt-1">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {isAr ? 'أبرز الميزات:' : 'Points forts :'}{' '}
              </span>
              <span>
                {summary.topTags
                  .map((item) => `${translateQualityTag(item.tag, locale)} (${item.count})`)
                  .join(' · ')}
              </span>
            </div>
          )}
        </div>

        {/* 5★ -> 1★ Distribution Bars */}
        <div className="md:col-span-8 space-y-1.5">
          {summary.histogram.map((row) => (
            <div key={row.stars} className="flex items-center gap-2.5 text-xs">
              <span className="w-10 font-mono tabular-nums text-slate-700 dark:text-slate-300 shrink-0 text-end">
                {row.stars} ★
              </span>
              <div className="flex-1 h-2 rounded-sm bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${row.pct}%` }}
                />
              </div>
              <span className="w-14 font-mono tabular-nums text-slate-600 dark:text-slate-300 text-end shrink-0">
                {row.count} ({row.pct}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', fr: 'Toutes notes', ar: 'كل النجوم' },
              { id: 5, fr: '5 ★ uniquement', ar: '5 ★ فقط' },
              { id: 4, fr: '4 ★ et +', ar: '4 ★ فأكثر' },
            ] as const
          ).map((opt) => {
            const active = minStars === opt.id;
            return (
              <button
                key={String(opt.id)}
                type="button"
                aria-pressed={active}
                onClick={() => setMinStars(opt.id)}
                className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                  active
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {isAr ? opt.ar : opt.fr}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', fr: 'Tous trajets', ar: 'جميع الرحلات' },
              { id: 'urban', fr: 'En ville', ar: 'داخل المدينة' },
              { id: 'intercity', fr: 'Inter-wilayas', ar: 'بين الولايات' },
            ] as const
          ).map((opt) => {
            const active = tripType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTripType(opt.id)}
                className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                  active
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {isAr ? opt.ar : opt.fr}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reviews Grid */}
      {filteredReviews.length === 0 ? (
        <div className="p-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
          {isAr
            ? 'لا توجد تقييمات مطابقة لهذا الفلتر حالياً.'
            : 'Aucun avis ne correspond à ces critères pour le moment.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredReviews.map((rev) => {
            const serviceLabel = SERVICE_LABELS[rev.serviceType];
            return (
              <article
                key={rev.id}
                data-testid="driver-review-card"
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{rev.driverName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {isAr ? 'الزبون:' : 'Par'}{' '}
                        <strong className="text-slate-700 dark:text-slate-200 font-medium">{rev.clientName}</strong>
                        <span className="mx-1.5">·</span>
                        <span className="font-mono">{rev.tripCode}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.stars
                                ? 'fill-current text-amber-500 dark:text-amber-400'
                                : 'text-slate-200 dark:text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {rev.stars}/5
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {rev.tripType === 'intercity'
                      ? isAr
                        ? 'بين الولايات'
                        : 'Inter-wilaya'
                      : isAr
                      ? 'داخل المدينة'
                      : 'En ville'}
                    <span className="mx-1.5">·</span>
                    <span>{isAr ? serviceLabel.ar : serviceLabel.fr}</span>
                    {rev.routeSummary && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>{rev.routeSummary}</span>
                      </>
                    )}
                  </div>

                  {rev.tags.length > 0 && (
                    <div className="text-xs font-medium text-orange-800 dark:text-orange-300">
                      {rev.tags.map((tg) => translateQualityTag(tg, locale)).join(' · ')}
                    </div>
                  )}

                  {rev.comment && (
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">« {rev.comment} »</p>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      {isAr ? 'رحلة مكتملة وموثّقة' : 'Course vérifiée'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{formatDateDz(rev.createdAt, locale)}</span>
                  </div>
                  {onToggleFavorite && (
                    <FavoriteToggleButton
                      locale={locale}
                      driverName={rev.driverName}
                      isFavorite={favoriteDriverIds?.has(rev.driverId) ?? false}
                      onToggle={() => onToggleFavorite(rev.driverId)}
                      compact
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
