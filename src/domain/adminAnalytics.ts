import type {
  DriverProfile,
  IntercityRequest,
  Locale,
  Ride,
  SubscriptionPayment,
  Wilaya,
} from './types';

export type AnalyticsPeriodMode = '6m' | 'live';
export type WilayaMetricFilter = 'all' | 'urban' | 'intercity';
export type RevenueChartMetric = 'combined' | 'subscriptions' | 'gmv';

export interface WilayaTripVolumePoint {
  wilayaCode: number;
  name: string;
  shortLabel: string;
  urbanCount: number;
  intercityCount: number;
  totalTrips: number;
  volumeDzd: number;
}

export interface MonthlyRevenuePoint {
  monthKey: string;
  monthLabel: string;
  subscriptionRevenueDzd: number;
  transportVolumeDzd: number;
  activeSubscribers: number;
  tripCount: number;
}

export interface AdminAnalyticsDataset {
  wilayaVolume: WilayaTripVolumePoint[];
  monthlyRevenue: MonthlyRevenuePoint[];
  totals: {
    totalTrips: number;
    totalUrban: number;
    totalIntercity: number;
    topWilayaName: string;
    topWilayaTrips: number;
    totalSubscriptionRevenueDzd: number;
    totalTransportVolumeDzd: number;
    latestMonthSubscriptionDzd: number;
    subscriptionGrowthPct: number;
  };
}

interface MonthSpec {
  key: string;
  fr: string;
  ar: string;
  baselineSubsDzd: number;
  baselineGmvDzd: number;
  baselineActiveDrivers: number;
  baselineTrips: number;
}

const MONTH_SPECS: MonthSpec[] = [
  {
    key: '2026-06',
    fr: 'Juin',
    ar: 'يونيو',
    baselineSubsDzd: 38000,
    baselineGmvDzd: 1420000,
    baselineActiveDrivers: 38,
    baselineTrips: 84,
  },
  {
    key: '2026-07',
    fr: 'Juil.',
    ar: 'يوليو',
    baselineSubsDzd: 46000,
    baselineGmvDzd: 1790000,
    baselineActiveDrivers: 46,
    baselineTrips: 108,
  },
  {
    key: '2026-08',
    fr: 'Août',
    ar: 'أغسطس',
    baselineSubsDzd: 54000,
    baselineGmvDzd: 2150000,
    baselineActiveDrivers: 54,
    baselineTrips: 129,
  },
  {
    key: '2026-09',
    fr: 'Sept.',
    ar: 'سبتمبر',
    baselineSubsDzd: 63000,
    baselineGmvDzd: 2490000,
    baselineActiveDrivers: 63,
    baselineTrips: 148,
  },
  {
    key: '2026-10',
    fr: 'Oct.',
    ar: 'أكتوبر',
    baselineSubsDzd: 72000,
    baselineGmvDzd: 2880000,
    baselineActiveDrivers: 72,
    baselineTrips: 171,
  },
  {
    key: '2026-11',
    fr: 'Nov.',
    ar: 'نوفمبر',
    baselineSubsDzd: 84000,
    baselineGmvDzd: 3310000,
    baselineActiveDrivers: 84,
    baselineTrips: 196,
  },
];

const WILAYA_BASELINE_BY_CODE: Record<
  number,
  { urban: number; intercity: number; volumeDzd: number }
> = {
  31: { urban: 218, intercity: 74, volumeDzd: 5420000 },
  16: { urban: 186, intercity: 68, volumeDzd: 4860000 },
  25: { urban: 74, intercity: 29, volumeDzd: 1640000 },
  19: { urban: 52, intercity: 21, volumeDzd: 1120000 },
  13: { urban: 38, intercity: 18, volumeDzd: 790000 },
  22: { urban: 29, intercity: 14, volumeDzd: 610000 },
  27: { urban: 24, intercity: 11, volumeDzd: 495000 },
  48: { urban: 15, intercity: 8, volumeDzd: 320000 },
  8: { urban: 9, intercity: 9, volumeDzd: 385000 },
};

function resolveMonthKey(isoTimestamp: string | undefined): string {
  if (!isoTimestamp) return '2026-11';
  const match = /^(\d{4}-\d{2})/.exec(isoTimestamp);
  if (!match) return '2026-11';
  const candidate = match[1];
  return MONTH_SPECS.some((m) => m.key === candidate) ? candidate : '2026-11';
}

function isCancelledStatus(status: string): boolean {
  return (
    status === 'cancelled_client' ||
    status === 'cancelled_driver' ||
    status === 'expired'
  );
}

export function buildAdminAnalytics(params: {
  locale: Locale;
  wilayas: Wilaya[];
  drivers: DriverProfile[];
  rides: Ride[];
  intercityRequests: IntercityRequest[];
  payments: SubscriptionPayment[];
  mode: AnalyticsPeriodMode;
}): AdminAnalyticsDataset {
  const { locale, wilayas, drivers, rides, intercityRequests, payments, mode } = params;
  const includeBaseline = mode === '6m';

  const wilayaMap = new Map<
    number,
    { urbanCount: number; intercityCount: number; volumeDzd: number }
  >();

  for (const w of wilayas) {
    if (!w.isActive && !includeBaseline) continue;
    const base = includeBaseline ? WILAYA_BASELINE_BY_CODE[w.code] : undefined;
    if (base) {
      wilayaMap.set(w.code, {
        urbanCount: base.urban,
        intercityCount: base.intercity,
        volumeDzd: base.volumeDzd,
      });
    } else if (w.isActive) {
      wilayaMap.set(w.code, { urbanCount: 0, intercityCount: 0, volumeDzd: 0 });
    }
  }

  const monthMap = new Map<
    string,
    { subsDzd: number; gmvDzd: number; activeSubs: number; trips: number }
  >();
  for (const spec of MONTH_SPECS) {
    monthMap.set(spec.key, {
      subsDzd: includeBaseline ? spec.baselineSubsDzd : 0,
      gmvDzd: includeBaseline ? spec.baselineGmvDzd : 0,
      activeSubs: includeBaseline ? spec.baselineActiveDrivers : 0,
      trips: includeBaseline ? spec.baselineTrips : 0,
    });
  }

  for (const ride of rides) {
    if (isCancelledStatus(ride.status)) continue;
    const price = ride.finalAgreedPriceDzd ?? ride.estimatedPriceDzd ?? 0;

    const existingW = wilayaMap.get(ride.wilayaCode) ?? {
      urbanCount: 0,
      intercityCount: 0,
      volumeDzd: 0,
    };
    existingW.urbanCount += 1;
    existingW.volumeDzd += price;
    wilayaMap.set(ride.wilayaCode, existingW);

    const mKey = resolveMonthKey(ride.completedAt ?? ride.createdAt);
    const mEntry = monthMap.get(mKey);
    if (mEntry) {
      mEntry.gmvDzd += price;
      mEntry.trips += 1;
    }
  }

  for (const ic of intercityRequests) {
    if (isCancelledStatus(ic.status)) continue;
    const price = ic.agreedPriceDzd ?? ic.refPriceDzd ?? 0;

    const existingW = wilayaMap.get(ic.fromWilaya) ?? {
      urbanCount: 0,
      intercityCount: 0,
      volumeDzd: 0,
    };
    existingW.intercityCount += 1;
    existingW.volumeDzd += price;
    wilayaMap.set(ic.fromWilaya, existingW);

    const mKey = resolveMonthKey(ic.createdAt);
    const mEntry = monthMap.get(mKey);
    if (mEntry) {
      mEntry.gmvDzd += price;
      mEntry.trips += 1;
    }
  }

  for (const p of payments) {
    if (p.status !== 'approved') continue;
    const mKey = resolveMonthKey(p.reviewedAt ?? p.submittedAt);
    const mEntry = monthMap.get(mKey);
    if (mEntry) {
      mEntry.subsDzd += p.amountDzd;
      mEntry.activeSubs += 1;
    }
  }

  if (mode === 'live') {
    const activeDriversCount = drivers.filter(
      (d) => d.subscription.status === 'active' || d.subscription.status === 'grace'
    ).length;
    const novEntry = monthMap.get('2026-11');
    if (novEntry && novEntry.activeSubs < activeDriversCount) {
      novEntry.activeSubs = activeDriversCount;
    }
  }

  const wilayaVolume: WilayaTripVolumePoint[] = Array.from(wilayaMap.entries())
    .map(([code, agg]) => {
      const w = wilayas.find((item) => item.code === code);
      const name = w ? (locale === 'ar' ? w.nameAr : w.nameFr) : `Wilaya ${code}`;
      const codeStr = String(code).padStart(2, '0');
      return {
        wilayaCode: code,
        name,
        shortLabel: `${name} (${codeStr})`,
        urbanCount: agg.urbanCount,
        intercityCount: agg.intercityCount,
        totalTrips: agg.urbanCount + agg.intercityCount,
        volumeDzd: agg.volumeDzd,
      };
    })
    .filter((pt) => includeBaseline || pt.totalTrips > 0)
    .sort((a, b) => b.totalTrips - a.totalTrips || a.wilayaCode - b.wilayaCode);

  const monthlyRevenue: MonthlyRevenuePoint[] = MONTH_SPECS.map((spec) => {
    const agg = monthMap.get(spec.key)!;
    return {
      monthKey: spec.key,
      monthLabel: locale === 'ar' ? spec.ar : spec.fr,
      subscriptionRevenueDzd: agg.subsDzd,
      transportVolumeDzd: agg.gmvDzd,
      activeSubscribers: agg.activeSubs,
      tripCount: agg.trips,
    };
  });

  const totalUrban = wilayaVolume.reduce((sum, w) => sum + w.urbanCount, 0);
  const totalIntercity = wilayaVolume.reduce((sum, w) => sum + w.intercityCount, 0);
  const totalTrips = totalUrban + totalIntercity;
  const topWilaya = wilayaVolume[0];

  const totalSubscriptionRevenueDzd = monthlyRevenue.reduce(
    (sum, m) => sum + m.subscriptionRevenueDzd,
    0
  );
  const totalTransportVolumeDzd = monthlyRevenue.reduce(
    (sum, m) => sum + m.transportVolumeDzd,
    0
  );

  const latestMonth = monthlyRevenue[monthlyRevenue.length - 1];
  const prevMonth = monthlyRevenue[monthlyRevenue.length - 2];
  const latestMonthSubscriptionDzd = latestMonth?.subscriptionRevenueDzd ?? 0;
  const prevSubs = prevMonth?.subscriptionRevenueDzd ?? 0;
  const subscriptionGrowthPct =
    prevSubs > 0
      ? Math.round(((latestMonthSubscriptionDzd - prevSubs) / prevSubs) * 100)
      : latestMonthSubscriptionDzd > 0
        ? 100
        : 0;

  return {
    wilayaVolume,
    monthlyRevenue,
    totals: {
      totalTrips,
      totalUrban,
      totalIntercity,
      topWilayaName: topWilaya?.shortLabel ?? '—',
      topWilayaTrips: topWilaya?.totalTrips ?? 0,
      totalSubscriptionRevenueDzd,
      totalTransportVolumeDzd,
      latestMonthSubscriptionDzd,
      subscriptionGrowthPct,
    },
  };
}
