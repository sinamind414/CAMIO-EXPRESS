import type {
  AppSettings,
  PriceBreakdownItem,
  PricingRule,
  RideEstimate,
  ServiceType,
  VehicleCategory,
} from './types';

export function roundTo500(value: number): number {
  return Math.round(value / 500) * 500;
}

export function ceilTo500(value: number): number {
  return Math.ceil(value / 500) * 500;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.round(haversineKm(lat1, lng1, lat2, lng2) * 1000);
}

export interface UrbanEstimateInput {
  serviceType: ServiceType;
  vehicleCategory: VehicleCategory;
  pickupLat: number;
  pickupLng: number;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  roadDistanceKm?: number;
  floorFrom: number;
  floorTo?: number | null;
  hasElevatorFrom: boolean;
  hasElevatorTo: boolean;
  portersCount: number;
}

export function estimateUrbanRide(
  input: UrbanEstimateInput,
  rule: PricingRule,
  settings: Pick<AppSettings, 'floorMultiplier' | 'capMultiplier'>
): RideEstimate {
  let distanceKm = input.roadDistanceKm ?? 0;
  let isApproximateDistance = false;

  if (!input.roadDistanceKm) {
    if (input.dropoffLat != null && input.dropoffLng != null) {
      const straight = haversineKm(input.pickupLat, input.pickupLng, input.dropoffLat, input.dropoffLng);
      distanceKm = Math.max(2, Number((straight * 1.35).toFixed(1)));
      isApproximateDistance = true;
    } else {
      // Waste removal without specified dump location uses standard municipal dump distance
      distanceKm = 8;
      isApproximateDistance = true;
    }
  }

  const baseFare = rule.baseFareDzd;
  const distanceFare = Math.round(rule.perKmDzd * distanceKm);
  const effectiveFloorsFrom = input.hasElevatorFrom ? 0 : Math.max(0, input.floorFrom);
  const effectiveFloorsTo =
    input.dropoffLat != null && !input.hasElevatorTo ? Math.max(0, input.floorTo ?? 0) : 0;
  const totalFloors = effectiveFloorsFrom + effectiveFloorsTo;
  const floorsFare = rule.perFloorDzd * totalFloors;
  const portersFare = rule.porterUnitDzd * Math.max(0, input.portersCount);

  const breakdown: PriceBreakdownItem[] = [
    { labelFr: 'Prise en charge', labelAr: 'رسوم الانطلاق', amountDzd: baseFare },
    {
      labelFr: `Distance (${distanceKm.toFixed(1)} km)`,
      labelAr: `المسافة (${distanceKm.toFixed(1)} كم)`,
      amountDzd: distanceFare,
    },
  ];

  if (floorsFare > 0) {
    breakdown.push({
      labelFr: `Étages sans ascenseur (${totalFloors})`,
      labelAr: `طوابق بدون مصعد (${totalFloors})`,
      amountDzd: floorsFare,
    });
  }

  if (portersFare > 0) {
    breakdown.push({
      labelFr: `${input.portersCount} manutentionnaire(s)`,
      labelAr: `${input.portersCount} عمال شحن`,
      amountDzd: portersFare,
    });
  }

  let rawTotal = baseFare + distanceFare + floorsFare + portersFare;

  if (input.serviceType === 'waste_removal') {
    const dumpFee = 3000;
    rawTotal += dumpFee;
    breakdown.push({
      labelFr: 'Forfait mise en décharge',
      labelAr: 'رسوم التفريغ في المفرغة',
      amountDzd: dumpFee,
    });
  } else if (input.serviceType === 'freight') {
    const discount = Math.round(rawTotal * -0.1);
    rawTotal = Math.round(rawTotal * 0.9);
    breakdown.push({
      labelFr: 'Tarif transport de marchandises (-10 %)',
      labelAr: 'تعريفة نقل البضائع (-10%)',
      amountDzd: discount,
    });
  } else if (input.serviceType === 'refrigerated') {
    const coldSurcharge = Math.round(rawTotal * 0.2);
    rawTotal += coldSurcharge;
    breakdown.push({
      labelFr: 'Supplément chaîne du froid (+20 %)',
      labelAr: 'إضافة التبريد والمحافظة على الحرارة (+20%)',
      amountDzd: coldSurcharge,
    });
  } else if (input.serviceType === 'towing') {
    const winchSurcharge = Math.round(rawTotal * 0.25);
    rawTotal += winchSurcharge;
    breakdown.push({
      labelFr: 'Forfait plateau & treuil (+25 %)',
      labelAr: 'إضافة الرافعة والمسطحة (+25%)',
      amountDzd: winchSurcharge,
    });
  }

  const estimatedPriceDzd = Math.max(rule.minPriceDzd, ceilTo500(rawTotal));
  const priceFloorDzd = Math.max(rule.minPriceDzd, roundTo500(estimatedPriceDzd * settings.floorMultiplier));
  const priceCapDzd = roundTo500(estimatedPriceDzd * settings.capMultiplier);
  const durationMinEst = Math.max(15, Math.round(distanceKm * 3.5 + input.portersCount * 10));

  return {
    estimatedPriceDzd,
    priceFloorDzd,
    priceCapDzd,
    distanceKm,
    durationMinEst,
    isApproximateDistance,
    breakdown,
  };
}

export function validateUrbanOfferPrice(
  priceDzd: number,
  priceFloorDzd: number,
  priceCapDzd: number
): { valid: boolean; reason?: string } {
  if (!Number.isFinite(priceDzd) || priceDzd <= 0) {
    return { valid: false, reason: 'Montant invalide' };
  }
  if (priceDzd < priceFloorDzd || priceDzd > priceCapDzd) {
    return {
      valid: false,
      reason: `Prix hors fourchette autorisée (${priceFloorDzd} – ${priceCapDzd} DA)`,
    };
  }
  return { valid: true };
}

export interface IntercityEstimateInput {
  serviceType?: ServiceType;
  vehicleCategory: VehicleCategory;
  distanceKm: number;
  axisCoefficient?: number;
  portersCount: number;
  floorFrom: number;
  floorTo: number;
  hasElevatorFrom: boolean;
  hasElevatorTo: boolean;
  needsDisassembly: boolean;
  needsPacking: boolean;
}

export function estimateIntercityReference(
  input: IntercityEstimateInput,
  rule: PricingRule,
  settings: Pick<AppSettings, 'intercityFloorMultiplier' | 'intercityCapMultiplier'>
): {
  refPriceDzd: number;
  priceFloorDzd: number;
  priceCapDzd: number;
  breakdown: PriceBreakdownItem[];
} {
  const coef = input.axisCoefficient ?? 1.0;
  const base = rule.intercityBaseDzd;
  const kmTotal = Math.round(rule.intercityPerKmDzd * input.distanceKm);
  const portersTotal = 2500 * Math.max(0, input.portersCount);
  const floorsNoElev =
    (input.hasElevatorFrom ? 0 : Math.max(0, input.floorFrom)) +
    (input.hasElevatorTo ? 0 : Math.max(0, input.floorTo));
  const floorsTotal = 700 * floorsNoElev;
  const disassemblyTotal = input.needsDisassembly ? 2500 : 0;
  const packingTotal = input.needsPacking ? 4000 : 0;

  const subtotal = base + kmTotal + portersTotal + floorsTotal + disassemblyTotal + packingTotal;
  const baseRefPriceDzd = roundTo500(subtotal * coef);

  const breakdown: PriceBreakdownItem[] = [
    { labelFr: 'Forfait départ longue distance', labelAr: 'رسوم الانطلاق بين الولايات', amountDzd: base },
    {
      labelFr: `Trajet routier (${input.distanceKm} km × ${rule.intercityPerKmDzd} DA)`,
      labelAr: `المسافة الطرقية (${input.distanceKm} كم)`,
      amountDzd: kmTotal,
    },
  ];
  if (portersTotal > 0) {
    breakdown.push({
      labelFr: `Manutentionnaires (${input.portersCount})`,
      labelAr: `عمال الشحن (${input.portersCount})`,
      amountDzd: portersTotal,
    });
  }
  if (floorsTotal > 0) {
    breakdown.push({
      labelFr: `Étages sans ascenseur (${floorsNoElev})`,
      labelAr: `طوابق بدون مصعد (${floorsNoElev})`,
      amountDzd: floorsTotal,
    });
  }
  if (disassemblyTotal > 0) {
    breakdown.push({
      labelFr: 'Démontage / remontage',
      labelAr: 'فك وتركيب الأثاث',
      amountDzd: disassemblyTotal,
    });
  }
  if (packingTotal > 0) {
    breakdown.push({
      labelFr: 'Emballage complet',
      labelAr: 'تغليف كامل',
      amountDzd: packingTotal,
    });
  }
  if (coef !== 1.0) {
    breakdown.push({
      labelFr: `Coefficient axe (${coef}×)`,
      labelAr: `معامل المحور (${coef}×)`,
      amountDzd: baseRefPriceDzd - roundTo500(subtotal),
    });
  }

  let refPriceDzd = baseRefPriceDzd;
  if (input.serviceType === 'freight') {
    const adjusted = Math.max(rule.intercityBaseDzd, roundTo500(baseRefPriceDzd * 0.9));
    const delta = adjusted - baseRefPriceDzd;
    refPriceDzd = adjusted;
    if (delta !== 0) {
      breakdown.push({
        labelFr: 'Tarif transport de marchandises (-10 %)',
        labelAr: 'تعريفة نقل البضائع (-10%)',
        amountDzd: delta,
      });
    }
  } else if (input.serviceType === 'refrigerated') {
    const adjusted = roundTo500(baseRefPriceDzd * 1.2);
    const delta = adjusted - baseRefPriceDzd;
    refPriceDzd = adjusted;
    if (delta !== 0) {
      breakdown.push({
        labelFr: 'Supplément chaîne du froid (+20 %)',
        labelAr: 'إضافة التبريد (+20%)',
        amountDzd: delta,
      });
    }
  } else if (input.serviceType === 'towing') {
    const adjusted = roundTo500(baseRefPriceDzd * 1.25);
    const delta = adjusted - baseRefPriceDzd;
    refPriceDzd = adjusted;
    if (delta !== 0) {
      breakdown.push({
        labelFr: 'Forfait plateau & treuil (+25 %)',
        labelAr: 'إضافة الرافعة والمسطحة (+25%)',
        amountDzd: delta,
      });
    }
  }

  const priceFloorDzd = roundTo500(refPriceDzd * settings.intercityFloorMultiplier);
  const priceCapDzd = roundTo500(refPriceDzd * settings.intercityCapMultiplier);

  return { refPriceDzd, priceFloorDzd, priceCapDzd, breakdown };
}

export function validateIntercityQuotePrice(
  priceDzd: number,
  refPriceDzd: number,
  options: { isEmptyReturn: boolean; isGroupage: boolean },
  settings: Pick<
    AppSettings,
    | 'intercityFloorMultiplier'
    | 'intercityCapMultiplier'
    | 'emptyReturnDiscountMaxPct'
    | 'groupageDiscountMaxPct'
  >
): { valid: boolean; minAllowed: number; maxAllowed: number; isSuspiciouslyLow: boolean; reason?: string } {
  let floorRatio = settings.intercityFloorMultiplier;
  if (options.isGroupage) {
    floorRatio = Math.min(floorRatio, 1 - settings.groupageDiscountMaxPct / 100);
  }
  if (options.isEmptyReturn) {
    floorRatio = Math.min(floorRatio, 1 - settings.emptyReturnDiscountMaxPct / 100);
  }
  const minAllowed = roundTo500(refPriceDzd * floorRatio);
  const maxAllowed = roundTo500(refPriceDzd * settings.intercityCapMultiplier);
  const isSuspiciouslyLow = priceDzd < refPriceDzd * 0.7;

  if (!Number.isFinite(priceDzd) || priceDzd < minAllowed || priceDzd > maxAllowed) {
    return {
      valid: false,
      minAllowed,
      maxAllowed,
      isSuspiciouslyLow,
      reason: `Devis hors bornes (${minAllowed} – ${maxAllowed} DA)`,
    };
  }
  return { valid: true, minAllowed, maxAllowed, isSuspiciouslyLow };
}

/** Remise réelle d'un devis inter-wilaya par rapport au prix de référence (en %). */
export function computeEmptyReturnDiscountPct(priceDzd: number, refPriceDzd: number): number {
  if (!Number.isFinite(priceDzd) || !Number.isFinite(refPriceDzd) || refPriceDzd <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - priceDzd / refPriceDzd) * 100)));
}

export function validatePriceRevision(
  agreedPriceDzd: number,
  proposedPriceDzd: number,
  maxCapPct = 30
): { valid: boolean; maxAllowedDzd: number; increasePct: number } {
  const maxAllowedDzd = Math.round(agreedPriceDzd * (1 + maxCapPct / 100));
  const increasePct = Math.round(((proposedPriceDzd - agreedPriceDzd) / agreedPriceDzd) * 100);
  return {
    valid: proposedPriceDzd >= agreedPriceDzd && proposedPriceDzd <= maxAllowedDzd,
    maxAllowedDzd,
    increasePct,
  };
}
