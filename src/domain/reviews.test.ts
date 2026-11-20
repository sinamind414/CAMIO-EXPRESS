import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDriverTrustSummary,
  filterDriverReviews,
  translateQualityTag,
  validateReviewSubmission,
} from './reviews';
import type { DriverReview } from './types';

const SAMPLE_REVIEWS: DriverReview[] = [
  {
    id: 'rev-1',
    driverId: 'drv-karim',
    driverName: 'Karim Benali',
    clientName: 'Salim K.',
    tripType: 'urban',
    tripCode: 'LM-2026-004410',
    serviceType: 'moving',
    routeSummary: 'Oran Centre → Bir El Djir',
    stars: 5,
    tags: ['Ponctuel', 'Soigneux'],
    comment: 'Déménagement rapide et meubles bien protégés.',
    createdAt: '2026-11-15T14:00:00Z',
  },
  {
    id: 'rev-2',
    driverId: 'drv-karim',
    driverName: 'Karim Benali',
    clientName: 'Nadia C.',
    tripType: 'intercity',
    tripCode: 'LMX-2026-001102',
    serviceType: 'moving',
    routeSummary: 'Oran → Alger',
    stars: 4,
    tags: ['Ponctuel', 'Prix juste'],
    comment: 'Arrivé à l’heure prévue à Bab Ezzouar.',
    createdAt: '2026-11-17T10:30:00Z',
  },
  {
    id: 'rev-3',
    driverId: 'drv-mourad',
    driverName: 'Mourad Mansouri',
    clientName: 'Yacine M.',
    tripType: 'urban',
    tripCode: 'LM-2026-004480',
    serviceType: 'freight',
    routeSummary: 'Es Senia → Arzew',
    stars: 5,
    tags: ['Sympa', 'Équipe efficace'],
    comment: 'Très pro pour nos palettes commerciales.',
    createdAt: '2026-11-18T08:15:00Z',
  },
];

test('validateReviewSubmission enforces star range 1-5 and deduplicates tags', () => {
  const invalid = validateReviewSubmission({ stars: 0, tags: ['Ponctuel'], comment: 'Test' });
  assert.equal(invalid.valid, false);

  const valid = validateReviewSubmission({
    stars: 5,
    tags: ['Ponctuel', 'Ponctuel', 'Soigneux'],
    comment: '  Excellent service  ',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.stars, 5);
  assert.deepEqual(valid.tags, ['Ponctuel', 'Soigneux']);
  assert.equal(valid.comment, 'Excellent service');
});

test('buildDriverTrustSummary computes average rating, star histogram, and top tags', () => {
  const karim = buildDriverTrustSummary('drv-karim', SAMPLE_REVIEWS);
  assert.equal(karim.reviewCount, 2);
  assert.equal(karim.averageRating, 4.5);
  assert.equal(karim.histogram[0].stars, 5);
  assert.equal(karim.histogram[0].count, 1);
  assert.equal(karim.histogram[0].pct, 50);
  assert.equal(karim.histogram[1].stars, 4);
  assert.equal(karim.histogram[1].count, 1);
  assert.equal(karim.topTags[0].tag, 'Ponctuel');
  assert.equal(karim.topTags[0].count, 2);
  assert.equal(karim.recentReviews[0].id, 'rev-2');
});

test('filterDriverReviews filters by driver, minimum stars, and trip type', () => {
  assert.equal(filterDriverReviews(SAMPLE_REVIEWS, { driverId: 'drv-karim' }).length, 2);
  assert.equal(filterDriverReviews(SAMPLE_REVIEWS, { minStars: 5 }).length, 2);
  assert.equal(filterDriverReviews(SAMPLE_REVIEWS, { tripType: 'intercity' }).length, 1);
  assert.equal(translateQualityTag('Ponctuel', 'ar'), 'دقيق في الموعد');
});
