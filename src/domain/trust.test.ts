import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReliability, VEHICLE_BRANDS } from './trust';

test('score fiabilité : nouveau chauffeur', () => {
  const r = computeReliability({ ratingAvg: 0, ratingsCount: 0, responseRate: 1, ridesCompleted: 0 });
  assert.equal(r.level, 'new');
  assert.equal(r.labelFr, 'Nouveau');
});

test('score fiabilité excellent (note 4.8 + réactivité 95%)', () => {
  const r = computeReliability({ ratingAvg: 4.8, ratingsCount: 50, responseRate: 0.95, ridesCompleted: 100 });
  assert.equal(r.level, 'excellent');
  assert.equal(r.score, 96);
});

test('score fiabilité faible (note 2.5 + réactivité 40%)', () => {
  const r = computeReliability({ ratingAvg: 2.5, ratingsCount: 10, responseRate: 0.4, ridesCompleted: 30 });
  assert.equal(r.level, 'low');
});

test('liste des marques contient les marques algériennes', () => {
  assert.ok(VEHICLE_BRANDS.includes('Hyundai'));
  assert.ok(VEHICLE_BRANDS.includes('Sonacome'));
});
