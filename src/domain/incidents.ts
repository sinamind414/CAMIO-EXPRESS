import type {
  Dispute,
  DisputeCategory,
  DisputeStatus,
  IntercityRequest,
  Locale,
  Ride,
  ServiceType,
  VehicleCategory,
} from './types';

export interface IncidentCategoryMeta {
  id: DisputeCategory;
  labelFr: string;
  labelAr: string;
  hintFr: string;
  hintAr: string;
  quickReasons: Array<{ fr: string; ar: string }>;
}

export const INCIDENT_CATEGORIES: IncidentCategoryMeta[] = [
  {
    id: 'damage',
    labelFr: 'Dommage',
    labelAr: 'ضرر مادي',
    hintFr: 'Colis, meuble ou marchandise abîmée',
    hintAr: 'تلف في الطرد أو الأثاث أو البضاعة',
    quickReasons: [
      {
        fr: 'Meuble ou colis rayé / endommagé lors de la manutention',
        ar: 'تضرر أو خدش الأثاث أو الطرد أثناء الحمل والتنزيل',
      },
      {
        fr: 'Appareil électroménager endommagé pendant le transport',
        ar: 'تضرر جهاز كهرومنزلي أثناء النقل',
      },
      {
        fr: 'Chargement mal arrimé ayant causé de la casse',
        ar: 'تثبيت غير سليم للحمولة تسبب في كسر',
      },
    ],
  },
  {
    id: 'delay',
    labelFr: 'Retard',
    labelAr: 'تأخر',
    hintFr: 'Retard important au départ ou à l’arrivée',
    hintAr: 'تأخر كبير عند الانطلاق أو الوصول',
    quickReasons: [
      {
        fr: 'Retard supérieur à 30 min au point de chargement',
        ar: 'تأخر يفوق 30 دقيقة في نقطة التحميل',
      },
      {
        fr: 'Retard important sur l’horaire convenu à la livraison',
        ar: 'تأخر كبير عن الموعد المتفق عليه عند التسليم',
      },
      {
        fr: 'Attente prolongée sans préavis du chauffeur',
        ar: 'انتظار طويل دون إشعار مسبق من السائق',
      },
    ],
  },
  {
    id: 'price',
    labelFr: 'Écart de prix',
    labelAr: 'فرق في السعر',
    hintFr: 'Supplément non convenu ou contestation tarif',
    hintAr: 'مبلغ إضافي غير متفق عليه أو خلاف في التسعيرة',
    quickReasons: [
      {
        fr: 'Montant demandé supérieur au prix validé dans l’offre',
        ar: 'المبلغ المطلوب أعلى من السعر المتفق عليه في العرض',
      },
      {
        fr: 'Frais supplémentaires réclamés sans justification',
        ar: 'المطالبة بمصاريف إضافية دون مبرر',
      },
    ],
  },
  {
    id: 'no_show',
    labelFr: 'Absence',
    labelAr: 'عدم الحضور',
    hintFr: 'Chauffeur absent ou annulation tardive',
    hintAr: 'غياب السائق أو إلغاء متأخر',
    quickReasons: [
      {
        fr: 'Le chauffeur ne s’est pas présenté au rendez-vous',
        ar: 'لم يحضر السائق إلى نقطة الالتقاء',
      },
      {
        fr: 'Annulation de dernière minute sans alternative',
        ar: 'إلغاء في اللحظة الأخيرة دون بديل',
      },
    ],
  },
  {
    id: 'rudeness',
    labelFr: 'Comportement',
    labelAr: 'سلوك غير لائق',
    hintFr: 'Manque de respect ou non-respect des consignes',
    hintAr: 'سوء تعامل أو عدم احترام التعليمات',
    quickReasons: [
      {
        fr: 'Comportement inapproprié ou refus d’aide convenu',
        ar: 'تصرف غير لائق أو رفض المساعدة المتفق عليها',
      },
    ],
  },
  {
    id: 'other',
    labelFr: 'Autre',
    labelAr: 'سبب آخر',
    hintFr: 'Autre incident constaté sur le trajet',
    hintAr: 'حادث آخر تم رصده خلال الرحلة',
    quickReasons: [
      {
        fr: 'Incident logistique ou écart par rapport à la demande initiale',
        ar: 'إشكال لوجستي أو اختلاف عن الطلب الأولي',
      },
    ],
  },
];

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, { fr: string; ar: string }> = {
  open: { fr: 'Signalement ouvert', ar: 'بلاغ مفتوح' },
  in_review: { fr: 'En cours d’analyse', ar: 'قيد المراجعة' },
  resolved: { fr: 'Résolu', ar: 'تمت المعالجة' },
  rejected: { fr: 'Clôturé sans suite', ar: 'مغلق' },
};

const ALL_DISPUTE_CATEGORIES: DisputeCategory[] = [
  'damage',
  'delay',
  'price',
  'no_show',
  'rudeness',
  'app_bug',
  'other',
];

export function isValidDisputeCategory(val: unknown): val is DisputeCategory {
  return typeof val === 'string' && ALL_DISPUTE_CATEGORIES.includes(val as DisputeCategory);
}

export function getIncidentCategoryLabel(category: DisputeCategory, locale: Locale): string {
  if (category === 'app_bug') {
    return locale === 'ar' ? 'خطأ تقني' : 'Incident technique';
  }
  const found = INCIDENT_CATEGORIES.find((c) => c.id === category);
  if (!found) {
    return locale === 'ar' ? 'أخرى' : 'Autre';
  }
  return locale === 'ar' ? found.labelAr : found.labelFr;
}

export interface IncidentValidationResult {
  valid: boolean;
  category: DisputeCategory;
  description: string;
  reasonFr?: string;
  reasonAr?: string;
}

export function validateIncidentReport(input: {
  parentId?: unknown;
  parentType?: unknown;
  category?: unknown;
  description?: unknown;
}): IncidentValidationResult {
  const parentId = typeof input.parentId === 'string' ? input.parentId.trim() : '';
  const parentType = input.parentType === 'intercity_request' ? 'intercity_request' : 'ride';
  const category: DisputeCategory = isValidDisputeCategory(input.category) ? input.category : 'other';
  const description = typeof input.description === 'string' ? input.description.trim() : '';

  if (!parentId) {
    return {
      valid: false,
      category,
      description,
      reasonFr: `Identifiant du trajet (${parentType}) manquant.`,
      reasonAr: 'معرّف الرحلة غير موجود.',
    };
  }

  if (!isValidDisputeCategory(input.category)) {
    return {
      valid: false,
      category,
      description,
      reasonFr: 'Type d’incident invalide (dommage, retard, prix, etc.).',
      reasonAr: 'نوع الحادث غير صالح.',
    };
  }

  if (description.length < 8) {
    return {
      valid: false,
      category,
      description,
      reasonFr: 'Veuillez décrire l’incident en au moins 8 caractères.',
      reasonAr: 'يرجى وصف الحادث بـ 8 أحرف على الأقل.',
    };
  }

  return {
    valid: true,
    category,
    description,
  };
}

export function getIncidentsForTrip(
  disputes: Dispute[],
  parentType: 'ride' | 'intercity_request',
  parentId: string
): Dispute[] {
  return disputes
    .filter((d) => d.parentType === parentType && d.parentId === parentId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export interface RideHistoryEntry {
  parentType: 'ride' | 'intercity_request';
  id: string;
  code: string;
  status: string;
  serviceType: ServiceType;
  vehicleCategory: VehicleCategory;
  pickupLabel: string;
  dropoffLabel: string;
  fromWilaya?: number;
  toWilaya?: number;
  distanceKm: number;
  driverId?: string;
  driverName?: string;
  priceDzd: number;
  timestampIso: string;
  incidents: Dispute[];
  hasOpenIncident: boolean;
}

export function buildRideHistoryEntries(
  rides: Ride[],
  intercityRequests: IntercityRequest[],
  disputes: Dispute[]
): RideHistoryEntry[] {
  const urbanEntries: RideHistoryEntry[] = rides.map((r) => {
    const incidents = getIncidentsForTrip(disputes, 'ride', r.id);
    const hasOpenIncident = incidents.some((i) => i.status === 'open' || i.status === 'in_review');
    return {
      parentType: 'ride',
      id: r.id,
      code: r.rideCode,
      status: r.status,
      serviceType: r.serviceType,
      vehicleCategory: r.vehicleCategory,
      pickupLabel: r.pickup.address,
      dropoffLabel: r.dropoff?.address || 'Décharge agréée',
      fromWilaya: r.wilayaCode,
      distanceKm: r.distanceKm,
      driverId: r.driverId,
      driverName: r.driverName,
      priceDzd: r.finalAgreedPriceDzd ?? r.estimatedPriceDzd,
      timestampIso: r.completedAt ?? r.createdAt,
      incidents,
      hasOpenIncident,
    };
  });

  const intercityEntries: RideHistoryEntry[] = intercityRequests.map((ic) => {
    const incidents = getIncidentsForTrip(disputes, 'intercity_request', ic.id);
    const hasOpenIncident = incidents.some((i) => i.status === 'open' || i.status === 'in_review');
    return {
      parentType: 'intercity_request',
      id: ic.id,
      code: ic.requestCode,
      status: ic.status,
      serviceType: ic.serviceType,
      vehicleCategory: ic.vehicleCategory,
      pickupLabel: ic.pickupAddress,
      dropoffLabel: ic.dropoffAddress,
      fromWilaya: ic.fromWilaya,
      toWilaya: ic.toWilaya,
      distanceKm: ic.distanceKm,
      driverId: ic.driverId,
      driverName: ic.driverName,
      priceDzd: ic.agreedPriceDzd ?? ic.refPriceDzd,
      timestampIso: ic.createdAt,
      incidents,
      hasOpenIncident,
    };
  });

  return [...urbanEntries, ...intercityEntries].sort(
    (a, b) => Date.parse(b.timestampIso) - Date.parse(a.timestampIso)
  );
}
