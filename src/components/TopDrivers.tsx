import { Crown, Heart, MapPin, Star, Truck } from 'lucide-react';
import { useMemo } from 'react';
import { VEHICLE_LABELS } from '../domain/i18n';
import { getDriverTier, isDriverListed } from '../domain/visibility';
import type { AppSettings, DriverProfile, DriverReview, Locale } from '../domain/types';
import { VehicleIcon } from './VehicleIcon';

interface Props {
  locale: Locale;
  mode: 'urban' | 'intercity';
  drivers: DriverProfile[];
  reviews: DriverReview[];
  settings: AppSettings;
  favoriteDriverIds: Set<string>;
  onToggleFavorite: (driverId: string) => void | Promise<void>;
  onRequestDriver: (driver: DriverProfile) => void;
  wilayaName?: (code: number) => string;
}

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Annuaire « Top chauffeurs » — découverte, JAMAIS ordre d'attribution (C10 intact).
 * Deux classements séparés conformes au CDC §7.5 :
 *  - urbain   -> ratingAvg / ratingsCount
 *  - interville -> ratingIntercityAvg / intercityRatingsCount
 */
export function TopDrivers({
  locale, mode, drivers, reviews, settings,
  favoriteDriverIds, onToggleFavorite, onRequestDriver, wilayaName,
}: Props) {
  const isAr = locale === 'ar';

  const top = useMemo(() => {
    const listed = drivers.filter(
      (d) => d.status === 'approved' && isDriverListed(d, settings)
    );
    const score = (d: DriverProfile) =>
      mode === 'intercity' ? (d.ratingIntercityAvg ?? 0) : (d.ratingAvg ?? 0);
    const count = (d: DriverProfile) =>
      mode === 'intercity' ? (d.intercityRatingsCount ?? 0) : (d.ratingsCount ?? 0);
    const completed = (d: DriverProfile) =>
      mode === 'intercity' ? (d.intercityCompleted ?? 0) : (d.ridesCompleted ?? 0);

    return listed
      .slice()
      .sort((a, b) => {
        const onlineDiff = Number(b.isOnline) - Number(a.isOnline);
        if (onlineDiff !== 0) return onlineDiff;
        const ratingDiff = score(b) - score(a);
        if (ratingDiff !== 0) return ratingDiff;
        const countDiff = count(b) - count(a);
        if (countDiff !== 0) return countDiff;
        return completed(b) - completed(a);
      })
      .slice(0, 3);
  }, [drivers, reviews, settings, mode]);

  const lastReview = (driverId: string): DriverReview | undefined =>
    reviews
      .filter((r) => r.driverId === driverId && r.tripType === mode)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (top.length === 0) return null;

  return (
    <section
      id="top-drivers-panel"
      data-testid="top-drivers-panel"
      className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-slate-100">
            <Crown className="w-5 h-5 text-amber-500 shrink-0" />
            {mode === 'intercity'
              ? (isAr ? 'أفضل سائقي بين الولايات' : 'Top chauffeurs inter-wilaya')
              : (isAr ? 'أفضل السائقين في ولايتك' : 'Top chauffeurs en ville')}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {mode === 'intercity'
              ? (isAr ? 'مرتبون حسب تقييم الرحلات الطويلة وآراء الزبائن' : 'Classés selon la note longue distance et les avis clients')
              : (isAr ? 'مرتبون حسب التقييم والخبرة في مدينتك' : 'Classés selon la note et l’expérience dans votre ville')}
          </p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 whitespace-nowrap">
          {isAr ? 'الأعلى تقييماً' : 'Mieux notés'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {top.map((d, i) => {
          const note = mode === 'intercity' ? (d.ratingIntercityAvg ?? 0) : (d.ratingAvg ?? 0);
          const nb = mode === 'intercity' ? (d.intercityRatingsCount ?? 0) : (d.ratingsCount ?? 0);
          const review = lastReview(d.id);
          const isPro = getDriverTier(d, settings) === 'pro';
          const fav = favoriteDriverIds.has(d.id);
          return (
            <article
              key={d.id}
              data-testid={`top-driver-${d.id}`}
              className={`relative rounded-xl border p-3 space-y-2 ${
                i === 0
                  ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <span className="absolute -top-2 -left-1 text-xl" aria-hidden="true">{MEDALS[i]}</span>
              <div className="flex items-start gap-2">
                <VehicleIcon category={d.vehicle.category} className="w-16 h-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {d.fullName}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-0.5 font-bold text-amber-700 dark:text-amber-400">
                      <Star className="w-3 h-3 fill-current" />
                      {note > 0 ? note.toFixed(1) : '—'}/5
                      <span className="font-normal text-slate-500">({nb})</span>
                    </span>
                    {isPro && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 font-black text-[9px]">
                        PRO
                      </span>
                    )}
                    {d.isOnline && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={isAr ? 'متصل' : 'En ligne'} />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                    <Truck className="w-3 h-3 shrink-0" />
                    {isAr ? VEHICLE_LABELS[d.vehicle.category].ar : VEHICLE_LABELS[d.vehicle.category].fr}
                    {' · '}
                    <MapPin className="w-3 h-3 shrink-0" />
                    {wilayaName ? wilayaName(d.wilayaCode) : d.wilayaCode}
                  </div>
                </div>
              </div>

              {review ? (
                <p className="text-[11px] text-slate-700 dark:text-slate-300 italic leading-snug line-clamp-2">
                  « {review.comment || (isAr ? 'خدمة ممتازة' : 'Excellent service')} »
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  {isAr ? 'لا توجد آراء بعد' : 'Pas encore d’avis'}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleFavorite(d.id)}
                  aria-label={isAr ? 'إضافة للمفضلة' : 'Ajouter aux favoris'}
                  className={`p-1.5 rounded-md border transition-colors ${
                    fav ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-rose-600 text-rose-600' : 'text-slate-500'}`} />
                </button>
                <button
                  type="button"
                  onClick={() => onRequestDriver(d)}
                  className="flex-1 h-8 rounded-md bg-orange-600 text-white text-[11px] font-bold hover:bg-orange-700"
                >
                  {isAr ? 'اطلبه' : 'Demander ce chauffeur'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
