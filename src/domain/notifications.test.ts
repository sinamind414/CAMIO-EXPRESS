import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dismissToast,
  mapWsEnvelopeToToast,
  pushToast,
  type ToastItem,
} from './notifications';

test('mapWsEnvelopeToToast maps bid.accepted into a success toast', () => {
  const toast = mapWsEnvelopeToToast({
    event: 'bid.accepted',
    payload: {
      rideId: 'ride-demo-1',
      ride: {
        id: 'ride-demo-1',
        rideCode: 'LM-2026-004512',
        driverName: 'Mourad Mansouri',
        finalAgreedPriceDzd: 16000,
        estimatedPriceDzd: 16500,
        pickup: { address: 'Oran Centre', lat: 35.69, lng: -0.63 },
      },
    },
  });

  assert.ok(toast);
  assert.equal(toast.tone, 'success');
  assert.match(toast.titleFr, /Offre acceptée/);
  assert.match(toast.bodyFr, /Mourad Mansouri/);
  assert.equal(toast.actionWorkspace, 'client');
});

test('mapWsEnvelopeToToast maps ride.status.changed for transit, completion, and cancellation', () => {
  const inTransit = mapWsEnvelopeToToast({
    event: 'ride.status.changed',
    payload: {
      rideId: 'r1',
      ride: {
        id: 'r1',
        rideCode: 'LM-2026-001',
        status: 'in_transit',
        driverName: 'Karim Benali',
        pickup: { address: 'Es Senia', lat: 35.65, lng: -0.62 },
      },
    },
  });
  assert.equal(inTransit?.tone, 'info');
  assert.match(inTransit?.titleFr ?? '', /En transit/);

  const completed = mapWsEnvelopeToToast({
    event: 'ride.status.changed',
    payload: {
      rideId: 'r1',
      ride: {
        id: 'r1',
        rideCode: 'LM-2026-001',
        status: 'completed',
        pickup: { address: 'Es Senia', lat: 35.65, lng: -0.62 },
      },
    },
  });
  assert.equal(completed?.tone, 'success');

  const cancelled = mapWsEnvelopeToToast({
    event: 'ride.status.changed',
    payload: {
      rideId: 'r1',
      ride: {
        id: 'r1',
        rideCode: 'LM-2026-001',
        status: 'cancelled_driver',
        pickup: { address: 'Es Senia', lat: 35.65, lng: -0.62 },
      },
    },
  });
  assert.equal(cancelled?.tone, 'warning');
});

test('mapWsEnvelopeToToast suppresses high-frequency driver.position, intercity.position, and connected events', () => {
  assert.equal(mapWsEnvelopeToToast({ event: 'driver.position', payload: { rideId: 'r1' } }), null);
  assert.equal(mapWsEnvelopeToToast({ event: 'intercity.position', payload: { intercityId: 'ic-1' } }), null);
  assert.equal(mapWsEnvelopeToToast({ event: 'connected', payload: {} }), null);
});

test('pushToast deduplicates by dedupeKey, caps stack, and dismissToast removes target', () => {
  let queue: ToastItem[] = [];
  queue = pushToast(
    queue,
    {
      dedupeKey: 'k1',
      tone: 'info',
      titleFr: 'A',
      titleAr: 'أ',
      bodyFr: '1',
      bodyAr: '1',
    },
    { id: 't1', maxVisible: 3 }
  );
  queue = pushToast(
    queue,
    {
      dedupeKey: 'k1',
      tone: 'success',
      titleFr: 'A2',
      titleAr: 'أ2',
      bodyFr: '2',
      bodyAr: '2',
    },
    { id: 't2', maxVisible: 3 }
  );
  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, 't2');

  queue = pushToast(queue, { tone: 'info', titleFr: 'B', titleAr: 'ب', bodyFr: 'b', bodyAr: 'b' }, { id: 't3', maxVisible: 3 });
  queue = pushToast(queue, { tone: 'info', titleFr: 'C', titleAr: 'ج', bodyFr: 'c', bodyAr: 'c' }, { id: 't4', maxVisible: 3 });
  queue = pushToast(queue, { tone: 'info', titleFr: 'D', titleAr: 'د', bodyFr: 'd', bodyAr: 'd' }, { id: 't5', maxVisible: 3 });
  assert.equal(queue.length, 3);
  assert.deepEqual(
    queue.map((t) => t.id),
    ['t5', 't4', 't3']
  );

  queue = dismissToast(queue, 't4');
  assert.deepEqual(
    queue.map((t) => t.id),
    ['t5', 't3']
  );
});
