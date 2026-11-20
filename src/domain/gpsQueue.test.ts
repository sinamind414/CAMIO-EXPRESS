import test from 'node:test';
import assert from 'node:assert/strict';
import { dequeueGps, enqueueGps, groupByTarget, GPS_QUEUE_MAX, type GpsSample } from './gpsQueue';

const sample = (lat: number, id = 'r1', kind: 'ride' | 'intercity' = 'ride'): GpsSample => ({
  lat, lng: 0, ts: new Date().toISOString(), target: { kind, id },
});

test('la file déduplique les positions identiques', () => {
  let q = enqueueGps([], sample(35.69));
  q = enqueueGps(q, sample(35.69));
  assert.equal(q.length, 1);
  q = enqueueGps(q, sample(35.70));
  assert.equal(q.length, 2);
});

test('la file est plafonnée (FIFO)', () => {
  let q: GpsSample[] = [];
  for (let i = 0; i < GPS_QUEUE_MAX + 20; i++) q = enqueueGps(q, sample(35 + i / 1000));
  assert.equal(q.length, GPS_QUEUE_MAX);
  assert.equal(q[0].lat, 35 + 20 / 1000);
});

test('dequeue respecte FIFO et laisse le reste', () => {
  const q = [sample(1), sample(2), sample(3)];
  const { sent, remaining } = dequeueGps(q, 2);
  assert.deepEqual(sent.map((s) => s.lat), [1, 2]);
  assert.deepEqual(remaining.map((s) => s.lat), [3]);
});

test('groupByTarget sépare course et trajet inter-wilaya', () => {
  const groups = groupByTarget([sample(1, 'r1'), sample(2, 'ic1', 'intercity'), sample(3, 'r1')]);
  assert.equal(groups.length, 2);
  assert.equal(groups.find((g) => g.target.kind === 'ride')?.positions.length, 2);
  assert.equal(groups.find((g) => g.target.kind === 'intercity')?.positions.length, 1);
});
