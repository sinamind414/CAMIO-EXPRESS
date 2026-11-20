import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppSettings, DriverProfile, SubscriptionKind, SubscriptionStatus } from './types';
import { SEED_SETTINGS } from './seedData';
import { canDriverReceiveRides, getDriverTier, isDriverListed, rankDirectory } from './visibility';

const TODAY = '2026-11-20';
const settings = (over: Partial<AppSettings> = {}): AppSettings => ({ ...SEED_SETTINGS, ...over });

function makeDriver(opts: {
  id: string;
  status?: DriverProfile['status'];
  online?: boolean;
  kind?: SubscriptionKind;
  subStatus?: SubscriptionStatus;
  endsOn?: string;
  graceUntil?: string;
  ratingAvg?: number;
  ridesCompleted?: number;
  isDemotedInBroadcast?: boolean;
}): DriverProfile {
  return {
    id: opts.id,
    phone: `+21355${opts.id.padStart(6, '0')}`,
    fullName: opts.id,
    wilayaCode: 31,
    status: opts.status ?? 'approved',
    bio: '',
    isOnline: opts.online ?? true,
    lat: 35.69,
    lng: -0.63,
    ratingAvg: opts.ratingAvg ?? 4.5,
    ratingsCount: 10,
    ratingIntercityAvg: 0,
    intercityRatingsCount: 0,
    intercityCompleted: 0,
    intercityPenaltyCount: 0,
    ridesCompleted: opts.ridesCompleted ?? 20,
    ridesCancelled: 0,
    acceptanceRate: 1,
    requestsReceivedCount: 10,
    requestsRespondedCount: 10,
    ignoredRequestsStreak: 0,
    responseRate: 1,
    isDemotedInBroadcast: opts.isDemotedInBroadcast ?? false,
    vehicle: {
      id: `veh-${opts.id}`, driverId: opts.id, category: 'van', brand: 'Renault', model: 'Master',
      plateNumber: '1234-118-31', year: 2020, maxLoadKg: 800, volumeM3: 4,
      hasTailgate: false, hasRamps: false, isActive: true,
    },
    documents: [],
    subscription: {
      id: `sub-${opts.id}`, driverId: opts.id,
      kind: opts.kind ?? 'trial',
      status: opts.subStatus ?? 'active',
      startsOn: '2026-11-01',
      endsOn: opts.endsOn ?? '2026-12-31',
      graceUntil: opts.graceUntil ?? '2027-01-03',
      amountDzd: 800,
    },
    coverageAxes: [{ fromWilaya: 31, toWilaya: null }],
  };
}

test('1. chauffeur free approuvé et en ligne reste visible et reçoit des courses', () => {
  const d = makeDriver({ id: 'free1', kind: 'trial' });
  assert.equal(getDriverTier(d, settings(), TODAY), 'free');
  assert.equal(isDriverListed(d, settings(), TODAY), true);
  assert.equal(canDriverReceiveRides(d, settings(), TODAY), true);
});

test('2. Pro actif classé avant un Free de mérite égal dans l’annuaire', () => {
  const free = makeDriver({ id: 'free2', kind: 'trial', ratingAvg: 4.8, ridesCompleted: 50 });
  const pro = makeDriver({ id: 'pro2', kind: 'paid', ratingAvg: 4.8, ridesCompleted: 50 });
  const ranked = rankDirectory([free, pro], settings(), TODAY);
  assert.equal(ranked[0].id, 'pro2');
  assert.equal(getDriverTier(pro, settings(), TODAY), 'pro');
});

test('3. un trial actif reste dans le tier free', () => {
  assert.equal(getDriverTier(makeDriver({ id: 't3', kind: 'trial' }), settings(), TODAY), 'free');
});

test('4. hideUnpaidProfiles=false (défaut) : un expired reste listé', () => {
  const expired = makeDriver({ id: 'exp4', kind: 'paid', endsOn: '2026-10-01', graceUntil: '2026-10-04' });
  assert.equal(settings().hideUnpaidProfiles, false);
  assert.equal(isDriverListed(expired, settings(), TODAY), true);
});

test('5. hideUnpaidProfiles=true : expired masqué, grace conservé', () => {
  const s = settings({ hideUnpaidProfiles: true });
  const expired = makeDriver({ id: 'exp5', kind: 'paid', endsOn: '2026-10-01', graceUntil: '2026-10-04' });
  const grace = makeDriver({ id: 'gr5', kind: 'paid', endsOn: '2026-11-01', graceUntil: '2026-11-30' });
  assert.equal(isDriverListed(expired, s, TODAY), false);
  assert.equal(isDriverListed(grace, s, TODAY), true);
});

test('6. C10 figé : le tri du broadcast reste byte-for-byte identique', () => {
  // Protection du tri mérite (demoted en dernier, puis distance, puis note).
  // Le moindre classement payant ajouté ici fait échouer ce test.
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const serverPath = path.resolve(__dirname, '../../server.ts');
  const source = fs.readFileSync(serverPath, 'utf8').replace(/\r\n/g, '\n');
  const EXPECTED = `      .sort((a, bDrv) => {
        // CDC v2.1 C12 / T37: demoted drivers are pushed to the back of broadcast ordering; zero paid ranking (C10)
        if (a.isDemotedInBroadcast !== bDrv.isDemotedInBroadcast) {
          return a.isDemotedInBroadcast ? 1 : -1;
        }
        const distA = haversineKm(b.pickup.lat, b.pickup.lng, a.lat, a.lng);
        const distB = haversineKm(b.pickup.lat, b.pickup.lng, bDrv.lat, bDrv.lng);
        return distA - distB || bDrv.ratingAvg - a.ratingAvg;
      });`;
  assert.ok(source.includes(EXPECTED), 'Le tri broadcast C10 a été modifié — interdit');
});

test('7. leannuaire n’influence pas le broadcast : aucun tri payant dans rankDirectory', () => {
  const a = makeDriver({ id: 'freeA', kind: 'trial', ratingAvg: 5, ridesCompleted: 100 });
  const b = makeDriver({ id: 'proB', kind: 'paid', ratingAvg: 3, ridesCompleted: 1 });
  assert.equal(rankDirectory([a, b], settings(), TODAY)[0].id, 'proB');
  // ...mais les deux restent recevables : le Pro n’exclut pas le Free.
  assert.equal(canDriverReceiveRides(a, settings(), TODAY), true);
  assert.equal(canDriverReceiveRides(b, settings(), TODAY), true);
});
