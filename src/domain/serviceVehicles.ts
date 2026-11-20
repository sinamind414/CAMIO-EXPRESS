import type { ServiceType, VehicleCategory } from './types';

/**
 * Véhicules compatibles avec chaque prestation — ordre = recommandation
 * (du plus adapté au plus capacitaire). Guide le client sans le laisser
 * choisir n'importe quoi (ex. pas de moto pour un déménagement).
 */
export const SERVICE_VEHICLES: Record<ServiceType, VehicleCategory[]> = {
  moving: ['van', 'pickup_box', 'engkel_box', 'cdd_box'],
  freight: ['motorcycle', 'van', 'pickup_box', 'engkel_box', 'cdd_box'],
  waste_removal: ['pickup_bak', 'engkel_bak', 'cdd_bak', 'tipper'],
  refrigerated: ['van', 'pickup_box', 'engkel_box', 'cdd_box'],
  // Remorquage : une dépanneuse (plateau), jamais un camion benne à gravats.
  towing: ['tow_truck'],
};

/** Retourne les véhicules à proposer pour une prestation, dans l'ordre recommandé. */
export function vehiclesForService(service: ServiceType): VehicleCategory[] {
  return SERVICE_VEHICLES[service] ?? [];
}

/** Vérifie qu'un véhicule est compatible avec la prestation choisie. */
export function isVehicleCompatibleWithService(service: ServiceType, vehicle: VehicleCategory): boolean {
  return vehiclesForService(service).includes(vehicle);
}

/** Meilleur véhicule par défaut quand on change de prestation. */
export function defaultVehicleForService(service: ServiceType): VehicleCategory {
  return vehiclesForService(service)[0] ?? 'van';
}
