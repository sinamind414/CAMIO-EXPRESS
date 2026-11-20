import type {
  DriverAccountStatus,
  IntercityStatus,
  Locale,
  RideStatus,
  ServiceType,
  SubscriptionStatus,
  VehicleCategory,
} from './types';

export function formatDzd(amount: number, locale: Locale = 'fr'): string {
  const formatted = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return locale === 'ar' ? `${formatted}\u00A0دج` : `${formatted} DA`;
}

export function formatDateDz(iso: string, locale: Locale = 'fr'): string {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Africa/Algiers',
  });
}

export function formatTimeDz(iso: string, locale: Locale = 'fr'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Algiers',
  });
}

export const SERVICE_LABELS: Record<ServiceType, { fr: string; ar: string; descFr: string; descAr: string; fromPrice: number }> = {
  moving: {
    fr: 'Déménagement',
    ar: 'نقل الأثاث',
    descFr: 'Appartements, bureaux, démontage & manutentionnaires',
    descAr: 'شقق، مكاتب، فك وتركيب وعمال شحن',
    fromPrice: 4000,
  },
  waste_removal: {
    fr: 'Évacuation déchets & gravats',
    ar: 'إخلاء الردوم والنفايات',
    descFr: 'Chantiers, encombrants, décharge agréée',
    descAr: 'ورشات بناء، مخلفات، تفريغ في المفرغة',
    fromPrice: 7000,
  },
  freight: {
    fr: 'Transport de marchandises',
    ar: 'نقل البضائع والسلع',
    descFr: 'Colis volumineux, palettes, matériel commercial',
    descAr: 'طرود كبيرة، بضائع تجارية ومعدات',
    fromPrice: 4000,
  },
  refrigerated: {
    fr: 'Transport Réfrigéré',
    ar: 'النقل المبرد',
    descFr: 'Chaîne du froid (+4°C / −18°C), agroalimentaire & pharma',
    descAr: 'سلسلة التبريد (+4° / −18°)، مواد غذائية وأدوية',
    fromPrice: 5500,
  },
  towing: {
    fr: 'Remorquage',
    ar: 'سحب وقطر المركبات',
    descFr: 'Plateau porte-véhicule, treuil, assistance panne',
    descAr: 'شاحنة مسطحة بالرافعة لسحب السيارات المعطلة',
    fromPrice: 5000,
  },
};

export const VEHICLE_LABELS: Record<
  VehicleCategory,
  { fr: string; ar: string; specFr: string; specAr: string; maxKg: number; volM3: number; towCapacityT?: number }
> = {
  tow_truck: {
    fr: 'Dépanneuse (3,5 T)',
    ar: 'شاحنة سحب (3.5 طن)',
    specFr: 'Plateau porte-véhicule · capacité de remorquage 3,5 t',
    specAr: 'منصة سحب المركبات · قدرة سحب 3.5 طن',
    maxKg: 3500,
    volM3: 0,
    towCapacityT: 3.5,
  },
  motorcycle: { fr: 'Moto', ar: 'دراجة نارية', specFr: 'Colis légers · 20 kg', specAr: 'طرود خفيفة · 20 كغ', maxKg: 20, volM3: 0.2 },
  sedan: { fr: 'Berline', ar: 'سيارة سيدان', specFr: 'Petits colis · 50 kg / 0,5 m³', specAr: 'طرود صغيرة · 50 كغ / 0,5 م³', maxKg: 50, volM3: 0.5 },
  mpv: { fr: 'Monospace', ar: 'مينيفان', specFr: 'Famille · 150 kg / 1,5 m³', specAr: 'عائلي · 150 كغ / 1,5 م³', maxKg: 150, volM3: 1.5 },
  van: { fr: 'Van', ar: 'فان', specFr: 'Studio · 800 kg / 4 m³', specAr: 'ستوديو · 800 كغ / 4 م³', maxKg: 800, volM3: 4 },
  pickup_bak: { fr: 'Pickup benne', ar: 'بيك أب قلاب', specFr: ' gravats · 1 t / 3 m³', specAr: 'ردوم · 1 طن / 3 م³', maxKg: 1000, volM3: 3 },
  pickup_box: { fr: 'Pickup box (1 T)', ar: 'بيك أب مغلق (1 طن)', specFr: 'Colis · 1,2 t / 6 m³', specAr: 'طرود · 1,2 طن / 6 م³', maxKg: 1200, volM3: 6 },
  engkel_box: { fr: 'Engkel box (2 T)', ar: 'أنكل مغلق (2 طن)', specFr: 'F1–F2 · 2 t / 10 m³', specAr: 'شقة صغيرة · 2 طن / 10 م³', maxKg: 2000, volM3: 10 },
  engkel_bak: { fr: 'Engkel benne (2,5 T)', ar: 'أنكل قلاب (2,5 طن)', specFr: 'Gravats · 2,5 t / 8 m³', specAr: 'ردوم · 2,5 طن / 8 م³', maxKg: 2500, volM3: 8 },
  cdd_bak: { fr: 'CDD benne (5 T)', ar: 'سي دي دي قلاب (5 طن)', specFr: 'Chantier · 5 t / 18 m³', specAr: 'ورشة · 5 طن / 18 م³', maxKg: 5000, volM3: 18 },
  cdd_box: { fr: 'CDD box (5 T)', ar: 'سي دي دي مغلق (5 طن)', specFr: 'Villa / B2B · 5,5 t / 30 m³', specAr: 'فيلا / شركات · 5,5 طن / 30 م³', maxKg: 5500, volM3: 30 },
  // Alias historiques (mêmes caractéristiques que leurs équivalents du pack)
  small_van: { fr: 'Petit utilitaire', ar: 'مركبة صغيرة', specFr: 'Fourgonnette · 800 kg / 4 m³', specAr: '800 كغ / 4 م³', maxKg: 800, volM3: 4 },
  utility_van: { fr: 'Fourgon utilitaire', ar: 'فورغون نفعي', specFr: '1,5 t / 8 m³', specAr: '1,5 طن / 8 م³', maxKg: 1500, volM3: 8 },
  medium_truck: { fr: 'Camion moyen (3,5 t)', ar: 'شاحنة متوسطة', specFr: '3,5 t / 12 m³', specAr: '3,5 طن / 12 م³', maxKg: 3500, volM3: 12 },
  large_truck: { fr: 'Grand camion', ar: 'شاحنة كبيرة', specFr: '8 t / 25 m³', specAr: '8 طن / 25 م³', maxKg: 8000, volM3: 25 },
  tipper: { fr: 'Camion benne', ar: 'شاحنة قلابة', specFr: 'Gravats · 5 t', specAr: 'ردوم · 5 طن', maxKg: 5000, volM3: 6 },
};

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  'motorcycle', 'tow_truck', 'van', 'pickup_bak',
  'pickup_box', 'engkel_box', 'engkel_bak', 'cdd_bak', 'cdd_box',
];

export const RIDE_STATUS_LABELS: Record<RideStatus, { fr: string; ar: string }> = {
  draft: { fr: 'Brouillon', ar: 'مسودة' },
  searching: { fr: 'Recherche d’offres', ar: 'جاري البحث عن عروض' },
  assigned: { fr: 'Chauffeur attribué', ar: 'تم إسناد السائق' },
  driver_arriving: { fr: 'Chauffeur en route', ar: 'السائق في الطريق' },
  arrived_pickup: { fr: 'Arrivé au départ', ar: 'وصل إلى نقطة الانطلاق' },
  loading: { fr: 'Chargement en cours', ar: 'جاري الشحن' },
  in_transit: { fr: 'En transit', ar: 'في الطريق للتوصيل' },
  arrived_dropoff: { fr: 'Arrivé à destination', ar: 'وصل إلى الوجهة' },
  completed: { fr: 'Terminée (cash)', ar: 'مكتملة (نقداً)' },
  rated: { fr: 'Notée', ar: 'تم التقييم' },
  cancelled_client: { fr: 'Annulée par client', ar: 'ملغاة من الزبون' },
  cancelled_driver: { fr: 'Annulée par chauffeur', ar: 'ملغاة من السائق' },
  expired: { fr: 'Expirée', ar: 'منتهية الصلاحية' },
  disputed: { fr: 'En litige', ar: 'نزاع مفتوح' },
};

export const INTERCITY_STATUS_LABELS: Record<IntercityStatus, { fr: string; ar: string }> = {
  draft: { fr: 'Brouillon', ar: 'مسودة' },
  collecting: { fr: 'Collecte des devis (48 h)', ar: 'جمع العروض (48 ساعة)' },
  quoted: { fr: 'Devis reçus', ar: 'تم استلام عروض' },
  booked: { fr: 'Réservé et engagé', ar: 'محجوز ومؤكد' },
  in_progress: { fr: 'Chargement / En route', ar: 'قيد التنفيذ' },
  completed: { fr: 'Livré', ar: 'تم التسليم' },
  rated: { fr: 'Noté', ar: 'تم التقييم' },
  cancelled_client: { fr: 'Annulé par client', ar: 'ملغى من الزبون' },
  cancelled_driver: { fr: 'Annulé par chauffeur', ar: 'ملغى من السائق' },
  expired: { fr: 'Expiré', ar: 'منتهي الصلاحية' },
  disputed: { fr: 'En litige', ar: 'نزاع مفتوح' },
};

export const DRIVER_STATUS_LABELS: Record<DriverAccountStatus, { fr: string; ar: string }> = {
  pending_documents: { fr: 'Documents manquants', ar: 'وثائق ناقصة' },
  pending_review: { fr: 'En cours d’examen', ar: 'قيد المراجعة' },
  approved: { fr: 'Validé', ar: 'معتمد' },
  rejected: { fr: 'Rejeté', ar: 'مرفوض' },
  suspended: { fr: 'Suspendu', ar: 'موقوف مؤقتاً' },
  blocked: { fr: 'Bloqué', ar: 'محظور' },
};

export const SUB_STATUS_LABELS: Record<SubscriptionStatus, { fr: string; ar: string }> = {
  active: { fr: 'Actif', ar: 'نشط' },
  grace: { fr: 'Période de grâce', ar: 'فترة سماح' },
  expired: { fr: 'Expiré', ar: 'منتهي' },
  cancelled: { fr: 'Annulé', ar: 'ملغى' },
};

export const TEXTS = {
  fr: {
    brand: 'MOVEDZ',
    navClient: 'Espace Client',
    navDriver: 'Espace Chauffeur',
    navAdmin: 'Administration',
    navHelp: 'Centre d’aide',
    urbanMode: 'En ville',
    urbanSub: 'Course immédiate dans votre wilaya · enchères en 15 min',
    intercityMode: 'Entre wilayas',
    intercitySub: 'Trajet planifié longue distance · collecte de devis sous 48 h',
    cashDisclaimer:
      'Le prix est un accord direct entre vous et le chauffeur. Paiement en espèces à la livraison. 0 % commission.',
    intercityInsuranceDisclaimer:
      'La plateforme n’est pas assureur. Vérifiez l’assurance du véhicule au chargement ; les biens transportés voyagent sous la responsabilité convenue entre vous et le chauffeur.',
    otpHint: 'Code OTP de recette : 00000',
    modelABroadcastNotice:
      'Diffusion automatique (Modèle A) : votre demande est envoyée à tous les chauffeurs éligibles sans sollicitation directe ni classement payant.',
    contactLockedNotice:
      'Numéros de téléphone et messagerie strictement verrouillés avant l’acceptation d’une offre (anti-contournement).',
    antiBypassPriceNotice:
      'Prix convenu uniquement dans l’application · Toute sollicitation hors app expose le compte à une suspension.',
  },
  ar: {
    brand: 'MOVEDZ · موف ديزاد',
    navClient: 'فضاء الزبون',
    navDriver: 'فضاء السائق',
    navAdmin: 'لوحة الإدارة',
    navHelp: 'مركز المساعدة',
    urbanMode: 'في المدينة',
    urbanSub: 'رحلة فورية داخل الولاية · عروض الأسعار خلال 15 دقيقة',
    intercityMode: 'بين الولايات',
    intercitySub: 'رحلة مبرمجة لمسافة طويلة · جمع عروض الأسعار خلال 48 ساعة',
    cashDisclaimer:
      'السعر اتفاق مباشر بينك وبين السائق. الدفع نقداً عند التسليم. 0% عمولة.',
    intercityInsuranceDisclaimer:
      'المنصة ليست شركة تأمين. تحقق من تأمين الشاحنة عند الشحن؛ البضائع المنقولة تخضع للاتفاق المباشر مع السائق.',
    otpHint: 'رمز التحقق التجريبي: 00000',
    modelABroadcastNotice:
      'البث التلقائي (النموذج A): يُرسل طلبك تلقائياً لجميع السائقين المؤهلين دون استهداف مباشر أو ترتيب مدفوع.',
    contactLockedNotice:
      'أرقام الهاتف والمحادثة مقفلة تماماً قبل قبول العرض (حماية ضد التجاوز).',
    antiBypassPriceNotice:
      'السعر المتفق عليه يتم داخل التطبيق فقط · أي اتفاق خارج التطبيق يعرّض الحساب للتوقيف.',
  },
} as const;
