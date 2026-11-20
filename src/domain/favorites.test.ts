import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDriverFavorited,
  prioritizeFavoriteItems,
  resolveFavoriteDrivers,
  toggleFavoriteDriver,
  updateFavoriteNote,
} from './favorites';
import { SEED_DRIVERS, SEED_FAVORITES, SEED_REVIEWS } from './seedData';

test('toggleFavoriteDriver adds a new driver and removes when toggled again', () => {
  const initial = [...SEED_FAVORITES];
  assert.equal(isDriverFavorited(initial, 'drv-karim'), true);
  assert.equal(isDriverFavorited(initial, 'drv-mourad'), false);

  const addedRes = toggleFavoriteDriver(initial, {
    driverId: 'drv-mourad',
    note: 'Très fiable pour gravats',
    nowIso: '2026-11-18T12:00:00Z',
  });
  assert.equal(addedRes.added, true);
  assert.equal(isDriverFavorited(addedRes.next, 'drv-mourad'), true);
  assert.equal(addedRes.entry?.note, 'Très fiable pour gravats');

  const removedRes = toggleFavoriteDriver(addedRes.next, {
    driverId: 'drv-mourad',
  });
  assert.equal(removedRes.added, false);
  assert.equal(isDriverFavorited(removedRes.next, 'drv-mourad'), false);
});

test('updateFavoriteNote updates and trims note cleanly without duplicating entries', () => {
  const updated = updateFavoriteNote(SEED_FAVORITES, {
    driverId: 'drv-karim',
    note: '  Disponible le matin pour déménagements F3  ',
  });
  assert.equal(updated.length, SEED_FAVORITES.length);
  assert.equal(updated[0].note, 'Disponible le matin pour déménagements F3');
});

test('resolveFavoriteDrivers joins drivers and counts verified reviews newest-first', () => {
  const res = resolveFavoriteDrivers(SEED_FAVORITES, SEED_DRIVERS, SEED_REVIEWS);
  assert.equal(res.length, 1);
  assert.equal(res[0].driver.fullName, 'Karim Benali');
  assert.equal(res[0].verifiedReviewsCount, 2);
});

test('prioritizeFavoriteItems places favorite drivers first while preserving relative order', () => {
  const offers = [
    { id: 'o1', driverId: 'drv-mourad', priceDzd: 14000 },
    { id: 'o2', driverId: 'drv-yassine', priceDzd: 15000 },
    { id: 'o3', driverId: 'drv-karim', priceDzd: 15500 },
  ];
  const favSet = new Set(['drv-karim']);
  const sorted = prioritizeFavoriteItems(offers, favSet);
  assert.deepEqual(
    sorted.map((o) => o.id),
    ['o3', 'o1', 'o2']
  );
});
