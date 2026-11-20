import type { DriverProfile, DriverReview, Locale } from './types';

export interface QualityTagOption {
  id: string;
  fr: string;
  ar: string;
}

export const QUALITY_TAGS: QualityTagOption[] = [
  { id: 'Ponctuel', fr: 'Ponctuel', ar: 'دقيق في الموعد' },
  { id: 'Soigneux', fr: 'Soigneux', ar: 'حريص على الأثاث' },
  { id: 'Sympa', fr: 'Sympa', ar: 'تعامل محترم' },
  { id: 'Prix juste', fr: 'Prix juste', ar: 'سعر عادل' },
  { id: 'Véhicule propre', fr: 'Véhicule propre', ar: 'شاحنة نظيفة' },
  { id: 'Équipe efficace', fr: 'Équipe efficace', ar: 'فريق محترف' },
];

export const STAR_LABELS: Record<number, { fr: string; ar: string }> = {
  1: { fr: 'Très insuffisant', ar: 'سيئ جداً' },
  2: { fr: 'Moyen', ar: 'متوسط' },
  3: { fr: 'Correct', ar: 'مقبول' },
  4: { fr: 'Très bien', ar: 'جيد جداً' },
  5: { fr: 'Excellent', ar: 'ممتاز' },
};

export function translateQualityTag(tagId: string, locale: Locale): string {
  const found = QUALITY_TAGS.find((t) => t.id === tagId || t.fr === tagId || t.ar === tagId);
  if (!found) return tagId;
  return locale === 'ar' ? found.ar : found.fr;
}

export function validateReviewSubmission(input: {
  stars: number;
  tags?: string[];
  comment?: string;
}): {
  valid: boolean;
  stars: number;
  tags: string[];
  comment: string;
  reasonFr?: string;
  reasonAr?: string;
} {
  const stars = Math.round(Number(input.stars));
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return {
      valid: false,
      stars: 5,
      tags: [],
      comment: '',
      reasonFr: 'Veuillez sélectionner une note entre 1 et 5 étoiles.',
      reasonAr: 'يرجى اختيار تقييم من 1 إلى 5 نجوم.',
    };
  }

  const tags = Array.isArray(input.tags)
    ? Array.from(new Set(input.tags.map((t) => String(t).trim()).filter(Boolean))).slice(0, 6)
    : [];

  const comment = String(input.comment ?? '').trim().slice(0, 500);

  return { valid: true, stars, tags, comment };
}

export interface StarHistogramRow {
  stars: 5 | 4 | 3 | 2 | 1;
  count: number;
  pct: number;
}

export interface DriverTrustSummary {
  driverId: string;
  reviewCount: number;
  averageRating: number;
  histogram: StarHistogramRow[];
  topTags: Array<{ tag: string; count: number }>;
  recentReviews: DriverReview[];
}

export function buildDriverTrustSummary(
  driverId: string | 'all',
  reviews: DriverReview[],
  fallbackDriver?: Pick<DriverProfile, 'ratingAvg' | 'ratingsCount'>
): DriverTrustSummary {
  const matching = (driverId === 'all' ? reviews : reviews.filter((r) => r.driverId === driverId))
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const tagMap = new Map<string, number>();

  let starSum = 0;
  for (const rev of matching) {
    const s = Math.min(5, Math.max(1, Math.round(rev.stars))) as 1 | 2 | 3 | 4 | 5;
    counts[s] += 1;
    starSum += s;
    for (const tag of rev.tags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
  }

  const reviewCount = matching.length;
  const averageRating =
    reviewCount > 0
      ? Number((starSum / reviewCount).toFixed(2))
      : fallbackDriver?.ratingAvg ?? 0;

  const histogram: StarHistogramRow[] = ([5, 4, 3, 2, 1] as const).map((stars) => ({
    stars,
    count: counts[stars],
    pct: reviewCount > 0 ? Math.round((counts[stars] / reviewCount) * 100) : 0,
  }));

  const topTags = Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return {
    driverId,
    reviewCount,
    averageRating,
    histogram,
    topTags,
    recentReviews: matching,
  };
}

export function filterDriverReviews(
  reviews: DriverReview[],
  options: {
    driverId?: string;
    minStars?: number | 'all';
    tripType?: 'all' | 'urban' | 'intercity';
  }
): DriverReview[] {
  return reviews
    .filter((rev) => {
      if (options.driverId && options.driverId !== 'all' && rev.driverId !== options.driverId) {
        return false;
      }
      if (options.minStars && options.minStars !== 'all' && rev.stars < options.minStars) {
        return false;
      }
      if (options.tripType && options.tripType !== 'all' && rev.tripType !== options.tripType) {
        return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
