/** Marques & familles de véhicules (inspiré de CAMIO trucks/brands/truck_families). */
export const VEHICLE_BRANDS = [
  'Hyundai', 'Renault', 'Peugeot', 'Suzuki', 'Toyota', 'Isuzu',
  'Ford', 'Mercedes-Benz', 'MAN', 'Volvo', 'Iveco', 'Sonacome',
  'Autre',
] as const;

export type ReliabilityLevel = 'excellent' | 'good' | 'average' | 'low' | 'new';

export interface ReliabilityInfo {
  score: number;
  level: ReliabilityLevel;
  labelFr: string;
  labelAr: string;
  color: string;
}

/**
 * Score de fiabilité composite : note (60 %) + taux de réponse (40 %).
 * Inspiré du `reliability_score` de CAMIO, mais calculé depuis nos données CDC.
 */
export function computeReliability(input: {
  ratingAvg: number;
  ratingsCount: number;
  responseRate: number;
  ridesCompleted: number;
}): ReliabilityInfo {
  if (input.ridesCompleted === 0 && input.ratingsCount === 0) {
    return { score: 100, level: 'new', labelFr: 'Nouveau', labelAr: 'جديد', color: 'slate' };
  }
  const rating = input.ratingsCount > 0 ? input.ratingAvg / 5 : 0.8;
  const ratingWeight = input.ratingsCount > 0 ? 0.6 : 0;
  const responseWeight = input.ratingsCount > 0 ? 0.4 : 1;
  const score = Math.round((rating * ratingWeight + input.responseRate * responseWeight) * 100);
  if (score >= 90) return { score, level: 'excellent', labelFr: 'Excellent', labelAr: 'ممتاز', color: 'emerald' };
  if (score >= 75) return { score, level: 'good', labelFr: 'Fiable', labelAr: 'موثوق', color: 'green' };
  if (score >= 60) return { score, level: 'average', labelFr: 'Correct', labelAr: 'مقبول', color: 'amber' };
  return { score, level: 'low', labelFr: 'À surveiller', labelAr: 'يحتاج متابعة', color: 'red' };
}
