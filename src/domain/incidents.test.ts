import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRideHistoryEntries,
  getIncidentCategoryLabel,
  getIncidentsForTrip,
  INCIDENT_CATEGORIES,
  validateIncidentReport,
} from './incidents.ts';
import { SEED_DISPUTES, SEED_INTERCITY, SEED_RIDES } from './seedData.ts';
import type { Dispute } from './types.ts';

test('INCIDENT_CATEGORIES exposes damage and delay first with FR/AR labels and quick reasons', () => {
  assert.equal(INCIDENT_CATEGORIES[0].id, 'damage');
  assert.equal(INCIDENT_CATEGORIES[1].id, 'delay');
  assert.ok(INCIDENT_CATEGORIES[0].quickReasons.length >= 2);
  assert.ok(INCIDENT_CATEGORIES[1].quickReasons.length >= 2);
  assert.equal(getIncidentCategoryLabel('damage', 'fr'), 'Dommage');
  assert.equal(getIncidentCategoryLabel('delay', 'fr'), 'Retard');
  assert.equal(getIncidentCategoryLabel('delay', 'ar'), 'تأخر');
});

test('validateIncidentReport rejects missing parentId, invalid category, or too-short description', () => {
  const noParent = validateIncidentReport({
    parentId: '',
    category: 'damage',
    description: 'Meuble abîmé au déchargement.',
  });
  assert.equal(noParent.valid, false);

  const badCat = validateIncidentReport({
    parentId: 'ride-demo-completed',
    category: 'unknown_cat',
    description: 'Retard important de 45 min.',
  });
  assert.equal(badCat.valid, false);

  const shortDesc = validateIncidentReport({
    parentId: 'ride-demo-completed',
    category: 'delay',
    description: 'Retard',
  });
  assert.equal(shortDesc.valid, false);

  const ok = validateIncidentReport({
    parentId: 'ride-demo-completed',
    parentType: 'ride',
    category: 'delay',
    description: '  Retard de 45 min à la prise en charge à Gambetta.  ',
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.category, 'delay');
  assert.equal(ok.description, 'Retard de 45 min à la prise en charge à Gambetta.');
});

test('buildRideHistoryEntries attaches incidents to matching urban & intercity trips and sorts newest first', () => {
  const customDisputes: Dispute[] = [
    ...SEED_DISPUTES,
    {
      id: 'disp-test-damage',
      parentType: 'ride',
      parentId: 'ride-demo-completed',
      code: 'LM-2026-004495',
      openedByRole: 'client',
      openedByName: 'Amine Boudiaf',
      category: 'damage',
      description: 'Vitre de table rayée pendant la descente.',
      status: 'open',
      createdAt: new Date().toISOString(),
    },
  ];

  const entries = buildRideHistoryEntries(SEED_RIDES, SEED_INTERCITY, customDisputes);
  assert.equal(entries.length, SEED_RIDES.length + SEED_INTERCITY.length);

  const completedEntry = entries.find((e) => e.id === 'ride-demo-completed');
  assert.ok(completedEntry);
  assert.equal(completedEntry.hasOpenIncident, true);
  assert.equal(completedEntry.incidents.length, 1);
  assert.equal(completedEntry.incidents[0].category, 'damage');

  const incidents = getIncidentsForTrip(customDisputes, 'ride', 'ride-demo-completed');
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].id, 'disp-test-damage');
});
