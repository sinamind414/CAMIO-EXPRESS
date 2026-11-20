import type { RouteTemplate, ServiceType, VehicleCategory } from './types';

export interface RouteTemplateInput {
  clientId?: string;
  name: string;
  mode: 'urban' | 'intercity';
  serviceType: ServiceType;
  vehicleCategory: VehicleCategory;
  wilayaCode: number;
  fromWilaya?: number;
  toWilaya?: number;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  portersCount: number;
  volumeNote?: string;
  preferredDriverId?: string;
}

export function validateRouteTemplateInput(input: RouteTemplateInput): {
  valid: boolean;
  reasonFr?: string;
  reasonAr?: string;
} {
  if (!input.name || input.name.trim().length < 2) {
    return {
      valid: false,
      reasonFr: 'Donnez un nom court à ce modèle de trajet (min. 2 caractères).',
      reasonAr: 'أدخل اسماً قصيراً لنموذج المسار (حرفان على الأقل).',
    };
  }
  if (!input.pickupAddress || !input.pickupAddress.trim()) {
    return {
      valid: false,
      reasonFr: 'L’adresse de départ est obligatoire pour enregistrer le modèle.',
      reasonAr: 'عنوان الانطلاق مطلوب لحفظ النموذج.',
    };
  }
  if (input.mode === 'intercity' && input.fromWilaya === input.toWilaya) {
    return {
      valid: false,
      reasonFr: 'Un modèle inter-wilayas doit relier deux wilayas distinctes.',
      reasonAr: 'يجب أن يربط المسار بين ولايتين مختلفتين.',
    };
  }
  return { valid: true };
}

export function createRouteTemplate(input: RouteTemplateInput, nowIso = new Date().toISOString()): RouteTemplate {
  return {
    id: `rtpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    clientId: input.clientId ?? 'client-amine',
    name: input.name.trim(),
    mode: input.mode,
    serviceType: input.serviceType,
    vehicleCategory: input.vehicleCategory,
    wilayaCode: input.wilayaCode,
    fromWilaya: input.fromWilaya,
    toWilaya: input.toWilaya,
    pickupAddress: input.pickupAddress.trim(),
    dropoffAddress: input.dropoffAddress.trim(),
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    dropoffLat: input.dropoffLat,
    dropoffLng: input.dropoffLng,
    portersCount: Math.max(0, Math.min(6, Math.round(input.portersCount))),
    volumeNote: (input.volumeNote ?? '').trim(),
    preferredDriverId: input.preferredDriverId || undefined,
    usageCount: 1,
    createdAt: nowIso,
  };
}

export function incrementTemplateUsage(templates: RouteTemplate[], templateId: string): RouteTemplate[] {
  return templates.map((t) => (t.id === templateId ? { ...t, usageCount: t.usageCount + 1 } : t));
}

export function removeRouteTemplate(templates: RouteTemplate[], templateId: string): RouteTemplate[] {
  return templates.filter((t) => t.id !== templateId);
}
