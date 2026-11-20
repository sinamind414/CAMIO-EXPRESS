import type { Wilaya } from './types';

/**
 * Les 69 wilayas d'Algérie — liste officielle (Loi n° 26-06 du 4 avril 2026),
 * telle que publiée par Wikipedia / État civil algérien (consulté le 19/11/2026).
 * Les 11 dernières (59→69) ont été créées le 16 novembre 2025 dans les
 * Hautes Plaines et le Sud. Coordonnées = chef-lieu (approximatives pour les
 * wilayas non détaillées); une commune par défaut permet au formulaire de
 * fonctionner partout.
 */

interface RawWilaya {
  code: number;
  fr: string;
  ar: string;
  lat: number;
  lng: number;
  active?: boolean;
}

const RAW: RawWilaya[] = [
  { code: 1, fr: 'Adrar', ar: 'أدرار', lat: 27.8747, lng: -0.2899, active: true },
  { code: 2, fr: 'Chlef', ar: 'الشلف', lat: 36.1650, lng: 1.3317, active: true },
  { code: 3, fr: 'Laghouat', ar: 'الأغواط', lat: 33.8030, lng: 2.8630, active: true },
  { code: 4, fr: 'Oum El Bouaghi', ar: 'أم البواقي', lat: 35.8780, lng: 7.1130, active: true },
  { code: 5, fr: 'Batna', ar: 'باتنة', lat: 35.5550, lng: 6.1810, active: true },
  { code: 6, fr: 'Béjaïa', ar: 'بجاية', lat: 36.7510, lng: 5.0610, active: true },
  { code: 7, fr: 'Biskra', ar: 'بسكرة', lat: 34.8480, lng: 5.7270, active: true },
  { code: 8, fr: 'Béchar', ar: 'بشار', lat: 31.6150, lng: -2.2180, active: true },
  { code: 9, fr: 'Blida', ar: 'البليدة', lat: 36.4700, lng: 2.8330, active: true },
  { code: 10, fr: 'Bouïra', ar: 'البويرة', lat: 36.3720, lng: 3.9000, active: true },
  { code: 11, fr: 'Tamanrasset', ar: 'تمنراست', lat: 22.7850, lng: 5.5228 },
  { code: 12, fr: 'Tébessa', ar: 'تبسة', lat: 35.4050, lng: 8.1220, active: true },
  { code: 13, fr: 'Tlemcen', ar: 'تلمسان', lat: 34.8850, lng: -1.3160, active: true },
  { code: 14, fr: 'Tiaret', ar: 'تيارت', lat: 35.3680, lng: 1.3200, active: true },
  { code: 15, fr: 'Tizi Ouzou', ar: 'تيزي وزو', lat: 36.5620, lng: 4.0450, active: true },
  { code: 16, fr: 'Alger', ar: 'الجزائر', lat: 36.7538, lng: 3.0588, active: true },
  { code: 17, fr: 'Djelfa', ar: 'الجلفة', lat: 34.6680, lng: 3.2530, active: true },
  { code: 18, fr: 'Jijel', ar: 'جيجل', lat: 36.8210, lng: 5.6930, active: true },
  { code: 19, fr: 'Sétif', ar: 'سطيف', lat: 36.1890, lng: 5.4100, active: true },
  { code: 20, fr: 'Saïda', ar: 'سعيدة', lat: 34.8000, lng: 0.1500, active: true },
  { code: 21, fr: 'Skikda', ar: 'سكيكدة', lat: 36.8680, lng: 6.9070, active: true },
  { code: 22, fr: 'Sidi Bel Abbès', ar: 'سيدي بلعباس', lat: 35.1870, lng: -0.6340, active: true },
  { code: 23, fr: 'Annaba', ar: 'عنابة', lat: 36.9000, lng: 7.7500, active: true },
  { code: 24, fr: 'Guelma', ar: 'قالمة', lat: 36.4620, lng: 7.4330, active: true },
  { code: 25, fr: 'Constantine', ar: 'قسنطينة', lat: 36.3650, lng: 6.6147, active: true },
  { code: 26, fr: 'Médéa', ar: 'المدية', lat: 36.2640, lng: 2.7570, active: true },
  { code: 27, fr: 'Mostaganem', ar: 'مستغانم', lat: 35.9330, lng: 0.0880, active: true },
  { code: 28, fr: 'M’Sila', ar: 'المسيلة', lat: 35.7040, lng: 4.5580, active: true },
  { code: 29, fr: 'Mascara', ar: 'معسكر', lat: 35.3870, lng: 0.1380, active: true },
  { code: 30, fr: 'Ouargla', ar: 'ورقلة', lat: 31.9500, lng: 5.2670 },
  { code: 31, fr: 'Oran', ar: 'وهران', lat: 35.6971, lng: -0.6308, active: true },
  { code: 32, fr: 'El Bayadh', ar: 'البيض', lat: 33.6800, lng: 1.0170 },
  { code: 33, fr: 'Illizi', ar: 'اليزي', lat: 26.5000, lng: 8.4500 },
  { code: 34, fr: 'Bordj Bou Arréridj', ar: 'برج بوعريريج', lat: 36.0720, lng: 4.7800, active: true },
  { code: 35, fr: 'Boumerdès', ar: 'بومرداس', lat: 36.7330, lng: 3.9830, active: true },
  { code: 36, fr: 'El Tarf', ar: 'الطارف', lat: 36.7670, lng: 8.3170, active: true },
  { code: 37, fr: 'Tindouf', ar: 'تندوف', lat: 27.6740, lng: -8.1430 },
  { code: 38, fr: 'Tissemsilt', ar: 'تسمسيلت', lat: 35.6000, lng: 1.8100, active: true },
  { code: 39, fr: 'El Oued', ar: 'الوادي', lat: 33.3670, lng: 6.7830 },
  { code: 40, fr: 'Khenchela', ar: 'خنشلة', lat: 35.2300, lng: 7.1430, active: true },
  { code: 41, fr: 'Souk Ahras', ar: 'سوق أهراس', lat: 36.2830, lng: 8.4500, active: true },
  { code: 42, fr: 'Tipaza', ar: 'تيبازة', lat: 36.6000, lng: 2.4500, active: true },
  { code: 43, fr: 'Mila', ar: 'ميلة', lat: 36.4630, lng: 6.2570, active: true },
  { code: 44, fr: 'Aïn Defla', ar: 'عين الدفلى', lat: 36.2500, lng: 1.9330, active: true },
  { code: 45, fr: 'Naâma', ar: 'النعامة', lat: 33.2670, lng: -0.3170 },
  { code: 46, fr: 'Aïn Témouchent', ar: 'عين تموشنت', lat: 35.3000, lng: -1.1000, active: true },
  { code: 47, fr: 'Ghardaïa', ar: 'غرداية', lat: 32.4930, lng: 3.6750 },
  { code: 48, fr: 'Relizane', ar: 'غليزان', lat: 35.7330, lng: 0.5500, active: true },
  { code: 49, fr: 'Timimoun', ar: 'تيميمون', lat: 29.2580, lng: 0.2370 },
  { code: 50, fr: 'Bordj Badji Mokhtar', ar: 'برج باجي مختار', lat: 21.4350, lng: 0.9230 },
  { code: 51, fr: 'Ouled Djellal', ar: 'أولاد جلال', lat: 34.4000, lng: 5.0000 },
  { code: 52, fr: 'Béni Abbès', ar: 'بني عباس', lat: 30.1330, lng: -2.1500 },
  { code: 53, fr: 'In Salah', ar: 'عين صالح', lat: 27.2000, lng: 2.4660 },
  { code: 54, fr: 'In Guezzam', ar: 'عين قزام', lat: 19.6330, lng: 5.7500 },
  { code: 55, fr: 'Touggourt', ar: 'تقرت', lat: 33.1000, lng: 6.0000 },
  { code: 56, fr: 'Djanet', ar: 'جانت', lat: 24.5500, lng: 9.4830 },
  { code: 57, fr: 'El M’Ghair', ar: 'المغير', lat: 33.3500, lng: 6.2000 },
  { code: 58, fr: 'El Menia', ar: 'المنيعة', lat: 30.5830, lng: 2.8670 },
  // 11 nouvelles wilayas (16 novembre 2025)
  { code: 59, fr: 'Aflou', ar: 'آفلو', lat: 34.0958, lng: 2.1014 },
  { code: 60, fr: 'Barika', ar: 'بريكة', lat: 35.6500, lng: 5.7500 },
  { code: 61, fr: 'El Kantara', ar: 'القنطرة', lat: 35.2333, lng: 5.6167 },
  { code: 62, fr: 'Bir El Ater', ar: 'بئر العاتر', lat: 34.7167, lng: 8.4333 },
  { code: 63, fr: 'El Aricha', ar: 'العريشة', lat: 34.8500, lng: -1.5667 },
  { code: 64, fr: 'Ksar Chellala', ar: 'قصر الشلالة', lat: 35.0000, lng: 2.1167 },
  { code: 65, fr: 'Aïn Oussera', ar: 'عين وسارة', lat: 35.4500, lng: 2.9167 },
  { code: 66, fr: 'Messaad', ar: 'مسعد', lat: 35.1000, lng: 3.2000 },
  { code: 67, fr: 'Ksar El Boukhari', ar: 'قصر البخاري', lat: 35.0500, lng: 2.6667 },
  { code: 68, fr: 'Bousaâda', ar: 'بوسعادة', lat: 35.4417, lng: 4.2986 },
  { code: 69, fr: 'El Abiodh Sidi Cheikh', ar: 'الأبيض سيدي الشيخ', lat: 32.9000, lng: 0.9333 },
];

export const SEED_WILAYAS: Wilaya[] = RAW.map((w) => ({
  code: w.code,
  nameFr: w.fr,
  nameAr: w.ar,
  isActive: w.active ?? false,
  lat: w.lat,
  lng: w.lng,
  communes: [
    {
      id: `${String(w.code).padStart(2, '0')}01`,
      nameFr: w.fr,
      nameAr: w.ar,
      lat: w.lat,
      lng: w.lng,
    },
  ],
}));

export const WILAYA_COUNT = SEED_WILAYAS.length; // 69
