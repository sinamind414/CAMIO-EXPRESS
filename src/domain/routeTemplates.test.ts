import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRouteTemplate,
  incrementTemplateUsage,
  removeRouteTemplate,
  validateRouteTemplateInput,
} from './routeTemplates';

test('validateRouteTemplateInput enforces name and non-identical intercity wilayas', () => {
  const noName = validateRouteTemplateInput({
    name: ' ',
    mode: 'urban',
    serviceType: 'freight',
    vehicleCategory: 'utility_van',
    wilayaCode: 31,
    pickupAddress: 'Oran Centre',
    dropoffAddress: 'Es Senia',
    portersCount: 1,
  });
  assert.equal(noName.valid, false);

  const sameWilaya = validateRouteTemplateInput({
    name: 'Ligne Hebdo',
    mode: 'intercity',
    serviceType: 'freight',
    vehicleCategory: 'medium_truck',
    wilayaCode: 31,
    fromWilaya: 31,
    toWilaya: 31,
    pickupAddress: 'Oran',
    dropoffAddress: 'Oran',
    portersCount: 2,
  });
  assert.equal(sameWilaya.valid, false);
});

test('createRouteTemplate, incrementTemplateUsage, and removeRouteTemplate manage state cleanly', () => {
  const tpl = createRouteTemplate(
    {
      name: 'Dépôt Oran → Boutique Es Senia',
      mode: 'urban',
      serviceType: 'freight',
      vehicleCategory: 'utility_van',
      wilayaCode: 31,
      pickupAddress: 'Zone Industrielle Es Senia',
      dropoffAddress: 'Rue Larbi Ben M’hidi',
      portersCount: 1,
      volumeNote: '6 palettes marchandises',
    },
    '2026-11-18T10:00:00Z'
  );
  assert.equal(tpl.usageCount, 1);
  assert.equal(tpl.vehicleCategory, 'utility_van');

  const incremented = incrementTemplateUsage([tpl], tpl.id);
  assert.equal(incremented[0].usageCount, 2);

  const removed = removeRouteTemplate(incremented, tpl.id);
  assert.equal(removed.length, 0);
});
