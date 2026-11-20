import type { DriverProfile, VehicleCategory, AppSettings } from './types';
import { VEHICLE_LABELS } from './i18n';

export interface DriverSignupInput {
  phone: string;
  fullName: string;
  wilayaCode: number;
  vehicleCategory: VehicleCategory;
  brand: string;
  model: string;
  plateNumber: string;
  documents: Array<{ docType: string; fileName: string }>;
}

const DOC_LABELS: Record<string, string> = {
  license: 'permis',
  vehicle_registration: 'carte_grise',
  insurance: 'assurance',
  vehicle_photo: 'photo_vehicule',
  vehicle_photo_plate: 'photo_plaque',
  national_id: 'cni',
};

/** Construit un profil chauffeur complet à partir d'une inscription minimale. */
export function buildDriverProfile(input: DriverSignupInput, settings: AppSettings): DriverProfile {
  const id = `drv-${Date.now().toString(36)}`;
  const vInfo = VEHICLE_LABELS[input.vehicleCategory] ?? VEHICLE_LABELS.van;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const trialEnd = new Date(now.getTime() + settings.trialDays * 86_400_000).toISOString().slice(0, 10);

  return {
    id,
    phone: input.phone,
    fullName: input.fullName.trim() || 'Chauffeur Camio',
    wilayaCode: input.wilayaCode,
    status: 'pending_documents',
    bio: '',
    isOnline: false,
    lat: 35.6971,
    lng: -0.6308,
    ratingAvg: 0,
    ratingsCount: 0,
    ratingIntercityAvg: 0,
    intercityRatingsCount: 0,
    intercityCompleted: 0,
    intercityPenaltyCount: 0,
    ridesCompleted: 0,
    ridesCancelled: 0,
    acceptanceRate: 1,
    requestsReceivedCount: 0,
    requestsRespondedCount: 0,
    ignoredRequestsStreak: 0,
    responseRate: 1,
    isDemotedInBroadcast: false,
    vehicle: {
      id: `veh-${id}`,
      driverId: id,
      category: input.vehicleCategory,
      brand: input.brand.trim() || 'Véhicule utilitaire',
      model: input.model.trim() || vInfo.fr,
      plateNumber: input.plateNumber.trim() || 'AA-000-AA',
      year: now.getFullYear(),
      maxLoadKg: vInfo.maxKg,
      volumeM3: vInfo.volM3,
      hasTailgate: false,
      hasRamps: false,
      isActive: true,
    },
    documents: input.documents.map((d, i) => ({
      id: `doc-${id}-${i}`,
      driverId: id,
      docType: (d.docType in DOC_LABELS ? d.docType : 'license') as DriverProfile['documents'][number]['docType'],
      fileName: d.fileName || `${DOC_LABELS[d.docType] ?? 'document'}.jpg`,
      previewUrl: '',
      status: 'uploaded',
    })),
    subscription: {
      id: `sub-${id}`,
      driverId: id,
      kind: 'trial',
      status: 'active',
      startsOn: today,
      endsOn: trialEnd,
      graceUntil: new Date(new Date(trialEnd).getTime() + settings.graceDays * 86_400_000).toISOString().slice(0, 10),
      amountDzd: 0,
    },
    coverageAxes: [{ fromWilaya: input.wilayaCode, toWilaya: null }],
  };
}

/** Nombre de documents KYC requis avant soumission. */
export const REQUIRED_KYC_DOCS = ['license', 'vehicle_registration', 'insurance', 'vehicle_photo_plate'] as const;
