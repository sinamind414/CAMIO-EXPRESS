import type { ServiceType, VehicleCategory } from './types';
import { defaultVehicleForService } from './serviceVehicles';

/**
 * Assistant de demande rapide : 3 questions seulement.
 * Le but est que le client en demande pas plus pour publier sa course.
 */

export interface QuickAnswer {
  service: ServiceType;
  vehicle: VehicleCategory;
  porters: number;
  labelFr: string;
  labelAr: string;
}

/** Réponses typiques : « je déménage un F2 » -> tout est pré-rempli. */
export const QUICK_PRESETS: QuickAnswer[] = [
  { service: 'moving', vehicle: 'van', porters: 2, labelFr: 'Petit déménagement (studio / F1)', labelAr: 'نقل صغير (استوديو / F1)' },
  { service: 'moving', vehicle: 'pickup_box', porters: 2, labelFr: 'Déménagement F2 / F3', labelAr: 'نقل شقة F2 / F3' },
  { service: 'moving', vehicle: 'engkel_box', porters: 3, labelFr: 'Gros déménagement (villa)', labelAr: 'نقل كبير (فيلا)' },
  { service: 'freight', vehicle: 'motorcycle', porters: 0, labelFr: 'Petit colis / documents (moto)', labelAr: 'طرود صغيرة / وثائق (دراجة)' },
  { service: 'freight', vehicle: 'pickup_box', porters: 0, labelFr: 'Marchandises / palettes', labelAr: 'بضائع / منصات' },
  { service: 'waste_removal', vehicle: 'pickup_bak', porters: 0, labelFr: 'Gravats / déchets', labelAr: 'ردوم / نفايات' },
  { service: 'refrigerated', vehicle: 'van', porters: 0, labelFr: 'Transport réfrigéré', labelAr: 'نقل مبرد' },
  { service: 'towing', vehicle: 'tow_truck', porters: 0, labelFr: 'Remorquage / dépannage', labelAr: 'سحب وإنقاذ' },
];

export function presetFor(service: ServiceType, vehicle?: VehicleCategory): QuickAnswer {
  return (
    QUICK_PRESETS.find((p) => p.service === service && (!vehicle || p.vehicle === vehicle)) ??
    QUICK_PRESETS.find((p) => p.service === service) ?? {
      service,
      vehicle: vehicle ?? defaultVehicleForService(service),
      porters: 0,
      labelFr: 'Sur mesure',
      labelAr: 'حسب الطلب',
    }
  );
}
