import { CheckCircle2, Star } from 'lucide-react';
import { useState } from 'react';
import { formatDateDz } from '../domain/i18n';
import {
  QUALITY_TAGS,
  STAR_LABELS,
  translateQualityTag,
  validateReviewSubmission,
} from '../domain/reviews';
import type { IntercityStatus, Locale, RideStatus } from '../domain/types';

export interface RatingPayload {
  stars: number;
  tags: string[];
  comment: string;
  pricePaidDzd?: number;
  distanceKm?: number;
}

interface TripRatingFormProps {
  locale: Locale;
  status: RideStatus | IntercityStatus;
  driverName?: string;
  tripLabel?: 'urban' | 'intercity';
  existingRating?: {
    stars: number;
    tags: string[];
    comment: string;
    ratedAt?: string;
  };
  onSubmit: (payload: RatingPayload) => Promise<void>;
}

export function TripRatingForm({
  locale,
  status,
  driverName,
  tripLabel = 'urban',
  existingRating,
  onSubmit,
}: TripRatingFormProps) {
  const isAr = locale === 'ar';
  const [stars, setStars] = useState<number>(5);
  const [tags, setTags] = useState<string[]>(['Ponctuel', 'Soigneux']);
  const [comment, setComment] = useState<string>('');
  const [pricePaid, setPricePaid] = useState<string>('');
  const [distance, setDistance] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (status === 'rated' && existingRating) {
    const label = STAR_LABELS[existingRating.stars];
    return (
      <div
        data-testid="submitted-review-receipt"
        className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40 space-y-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-950 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>{isAr ? 'تم نشر تقييمك' : 'Votre avis publié'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400" aria-label={`${existingRating.stars}/5`}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${
                    s <= existingRating.stars
                      ? 'fill-current text-amber-500 dark:text-amber-400'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
              {existingRating.stars}/5 {label ? `· ${isAr ? label.ar : label.fr}` : ''}
            </span>
          </div>
        </div>

        {existingRating.tags.length > 0 && (
          <div className="text-xs font-medium text-emerald-900 dark:text-emerald-300">
            {existingRating.tags.map((tg) => translateQualityTag(tg, locale)).join(' · ')}
          </div>
        )}

        {existingRating.comment && (
          <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">« {existingRating.comment} »</p>
        )}

        <div className="text-[11px] text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-200/70 dark:border-emerald-800/60">
          <span>
            {driverName
              ? isAr
                ? `السائق: ${driverName}`
                : `Chauffeur évalué : ${driverName}`
              : isAr
              ? 'تقييم موثّق'
              : 'Avis client vérifié'}
          </span>
          {existingRating.ratedAt && (
            <span className="font-mono tabular-nums">{formatDateDz(existingRating.ratedAt, locale)}</span>
          )}
        </div>
      </div>
    );
  }

  if (status !== 'completed') {
    return null;
  }

  const starLabel = STAR_LABELS[stars];

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const check = validateReviewSubmission({ stars, tags, comment });
    if (!check.valid) {
      setLocalError(isAr ? (check.reasonAr ?? 'بيانات التقييم غير صالحة') : (check.reasonFr ?? 'Note invalide.'));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        stars: check.stars,
        tags: check.tags,
        comment: check.comment,
        pricePaidDzd: pricePaid ? Number(pricePaid) : undefined,
        distanceKm: distance ? Number(distance) : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      data-testid="trip-rating-form"
      className="p-4 rounded-lg border border-orange-200 dark:border-orange-900/70 bg-orange-50/40 dark:bg-orange-950/25 space-y-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {tripLabel === 'intercity'
              ? isAr
                ? 'تقييم الرحلة بين الولايات'
                : 'Évaluer votre trajet inter-wilaya'
              : isAr
              ? 'قيّم السائق (نهاية الرحلة)'
              : 'Évaluez la prestation (paiement cash effectué)'}
          </h4>
          {driverName && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {isAr
                ? `شارك رأيك الموثق حول ${driverName} لمساعدة مجتمع كاميو إكسبرس.`
                : `Votre avis vérifié sur ${driverName} renforce la confiance de la communauté.`}
            </p>
          )}
        </div>
      </div>

      {/* Star Picker */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1" role="group" aria-label={isAr ? 'اختر التقييم بالنجوم' : 'Note en étoiles'}>
          {[1, 2, 3, 4, 5].map((s) => {
            const active = s <= stars;
            return (
              <button
                key={s}
                type="button"
                aria-label={
                  isAr
                    ? `${s} نجوم`
                    : `${s} ${s === 1 ? 'étoile' : 'étoiles'}`
                }
                aria-pressed={stars === s}
                onClick={() => setStars(s)}
                className={`p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                  active
                    ? 'text-amber-500 dark:text-amber-400 hover:text-amber-600'
                    : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                }`}
              >
                <Star className="w-6 h-6 fill-current" />
              </button>
            );
          })}
        </div>
        {starLabel && (
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
            {stars}/5 · {isAr ? starLabel.ar : starLabel.fr}
          </span>
        )}
      </div>

      {/* Quality Tags (interactive toggle buttons) */}
      <div>
        <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          {isAr ? 'نقاط القوة الملاحظة' : 'Points forts constatés'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUALITY_TAGS.map((opt) => {
            const active = tags.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setTags((prev) => (active ? prev.filter((x) => x !== opt.id) : [...prev, opt.id]))
                }
                className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
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
      </div>

      {/* Prix réel payé + distance — transparence (modèle Bricoram) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`rating-price-${tripLabel}`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            {isAr ? 'المبلغ المدفوع (DA)' : 'Prix payé (DA)'}
          </label>
          <input id={`rating-price-${tripLabel}`} type="number" min={0} value={pricePaid}
            onChange={(e) => setPricePaid(e.target.value)} placeholder="ex. 16000"
            className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm" />
        </div>
        <div>
          <label htmlFor={`rating-distance-${tripLabel}`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            {isAr ? 'المسافة (كم)' : 'Distance (km)'}
          </label>
          <input id={`rating-distance-${tripLabel}`} type="number" min={0} value={distance}
            onChange={(e) => setDistance(e.target.value)} placeholder="ex. 8.4"
            className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm" />
        </div>
      </div>

      {/* Comment textarea with character counter */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={`rating-comment-${tripLabel}`} className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {isAr ? 'تعليق مفصل (اختياري)' : 'Commentaire client (facultatif)'}
          </label>
          <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">{comment.length}/500</span>
        </div>
        <textarea
          id={`rating-comment-${tripLabel}`}
          rows={2}
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            isAr
              ? 'اكتب ملاحظاتك حول الالتزام بالموعد والعناية بالأثاث...'
              : 'Décrivez la ponctualité, le soin apporté aux meubles ou la propreté du camion...'
          }
          className="w-full p-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {localError && <p className="text-xs font-medium text-red-700 dark:text-red-400">{localError}</p>}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {isAr ? 'تقييم مرتبط برحلة مكتملة ومؤكدة.' : 'Avis rattaché à une course finalisée.'}
        </span>
        <button
          type="submit"
          disabled={submitting}
          className="h-9 px-4 rounded-md bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {submitting
            ? isAr
              ? 'جاري النشر...'
              : 'Publication...'
            : isAr
            ? 'نشر التقييم'
            : 'Publier mon avis'}
        </button>
      </div>
    </form>
  );
}
