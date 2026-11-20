import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultVehicleForService, isVehicleCompatibleWithService, vehiclesForService } from './serviceVehicles';

test('le déménagement propose des véhicules fermés, jamais de moto', () => {
  const list = vehiclesForService('moving');
  assert.deepEqual(list, ['van', 'pickup_box', 'engkel_box', 'cdd_box']);
  assert.equal(isVehicleCompatibleWithService('moving', 'motorcycle'), false);
  assert.equal(defaultVehicleForService('moving'), 'van');
});

test('les déchets proposent des bennes', () => {
  const list = vehiclesForService('waste_removal');
  assert.ok(list.includes('pickup_bak'));
  assert.ok(list.includes('cdd_bak'));
  assert.equal(isVehicleCompatibleWithService('waste_removal', 'cdd_box'), false);
});

test('le fret accepte la moto pour les petits colis', () => {
  assert.equal(isVehicleCompatibleWithService('freight', 'motorcycle'), true);
  assert.equal(defaultVehicleForService('freight'), 'motorcycle');
});

test('le remorquage propose uniquement la dépanneuse, jamais un camion benne', () => {
  assert.deepEqual(vehiclesForService('towing'), ['tow_truck']);
  assert.equal(isVehicleCompatibleWithService('towing', 'pickup_bak'), false);
  assert.equal(isVehicleCompatibleWithService('towing', 'cdd_bak'), false);
  assert.equal(defaultVehicleForService('towing'), 'tow_truck');
});
