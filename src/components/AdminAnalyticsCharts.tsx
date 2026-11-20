import { BarChart3, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildAdminAnalytics,
  type AnalyticsPeriodMode,
  type MonthlyRevenuePoint,
  type RevenueChartMetric,
  type WilayaMetricFilter,
  type WilayaTripVolumePoint,
} from '../domain/adminAnalytics';
import { formatDzd } from '../domain/i18n';
import type { ThemeMode } from '../domain/theme';
import type {
  DriverProfile,
  IntercityRequest,
  Locale,
  Ride,
  SubscriptionPayment,
  Wilaya,
} from '../domain/types';

interface AdminAnalyticsChartsProps {
  locale: Locale;
  theme?: ThemeMode;
  wilayas: Wilaya[];
  drivers: DriverProfile[];
  rides: Ride[];
  intercityRequests: IntercityRequest[];
  payments: SubscriptionPayment[];
}

interface CustomTooltipPayloadItem {
  dataKey?: string;
  value?: number;
  payload?: WilayaTripVolumePoint | MonthlyRevenuePoint;
}

function formatCompactDzd(value: number, isAr: boolean): string {
  if (value >= 1_000_000) {
    const m = (value / 1_000_000).toFixed(1).replace('.0', '');
    return isAr ? `${m}م` : `${m}M`;
  }
  if (value >= 1_000) {
    const k = Math.round(value / 1_000);
    return isAr ? `${k}ألف` : `${k}k`;
  }
  return `${value}`;
}

export function AdminAnalyticsCharts({
  locale,
  theme = 'light',
  wilayas,
  drivers,
  rides,
  intercityRequests,
  payments,
}: AdminAnalyticsChartsProps) {
  const isAr = locale === 'ar';
  const isDark = theme === 'dark';
  const gridStroke = isDark ? '#2A2042' : '#E5DFEF';
  const axisTickColor = isDark ? '#A398BA' : '#4D4463';
  const yAxisTickColor = isDark ? '#A398BA' : '#685F7D';
  const axisLineStroke = isDark ? '#3A2D57' : '#CFC6DF';
  const cursorFill = isDark ? 'rgba(83, 3, 145, 0.18)' : '#F6EEFF';
  const intercityBarFill = isDark ? '#BC84FF' : '#530391';
  const subsBarFill = isDark ? '#9E4DFF' : '#530391';
  const subsLineStroke = isDark ? '#D8B8FF' : '#420275';
  const orangeBrandHex = '#FE5601';
  const [periodMode, setPeriodMode] = useState<AnalyticsPeriodMode>('6m');
  const [wilayaFilter, setWilayaFilter] = useState<WilayaMetricFilter>('all');
  const [revenueMetric, setRevenueMetric] = useState<RevenueChartMetric>('combined');

  const analytics = useMemo(
    () =>
      buildAdminAnalytics({
        locale,
        wilayas,
        drivers,
        rides,
        intercityRequests,
        payments,
        mode: periodMode,
      }),
    [locale, wilayas, drivers, rides, intercityRequests, payments, periodMode]
  );

  const visibleWilayas = useMemo(() => {
    const filtered = analytics.wilayaVolume.filter((item) => {
      if (wilayaFilter === 'urban') return item.urbanCount > 0;
      if (wilayaFilter === 'intercity') return item.intercityCount > 0;
      return item.totalTrips > 0;
    });
    return filtered.slice(0, 8);
  }, [analytics.wilayaVolume, wilayaFilter]);

  return (
    <section
      data-testid="admin-analytics-section"
      aria-label={isAr ? 'تحليلات النشاط والإيرادات' : 'Visualisation du volume et des revenus'}
      className="space-y-4"
    >
      {/* Section Header & Period Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {isAr ? 'مؤشرات النشاط والإيرادات' : 'Analytique transport & revenus'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'حجم الرحلات حسب الولاية وتطور عائدات الاشتراكات وحجم النقل الشهري.'
              : 'Volume des trajets par wilaya et revenus mensuels générés (abonnements plateforme & volume transport).'}
          </p>
        </div>

        <div
          role="group"
          aria-label={isAr ? 'نطاق البيانات' : 'Période analytique'}
          className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700"
        >
          {(
            [
              { id: '6m', fr: '6 derniers mois', ar: 'آخر 6 أشهر' },
              { id: 'live', fr: 'Session en direct', ar: 'الجلسة الحالية' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriodMode(opt.id)}
              aria-pressed={periodMode === opt.id}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                periodMode === opt.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isAr ? opt.ar : opt.fr}
            </button>
          ))}
        </div>
      </div>

      {/* Dual Chart Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Chart 1: Volume de trajets par wilaya */}
        <div
          data-testid="wilaya-volume-chart"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col justify-between gap-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <BarChart3 className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                <h4>{isAr ? 'حجم الرحلات حسب الولاية' : 'Volume de trajets par wilaya'}</h4>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>
                  {isAr
                    ? `الإجمالي: ${analytics.totals.totalTrips} رحلة`
                    : `Total : ${analytics.totals.totalTrips} trajets`}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {isAr
                    ? `الأعلى نشاطاً: ${analytics.totals.topWilayaName}`
                    : `Wilaya n°1 : ${analytics.totals.topWilayaName}`}
                </span>
              </div>
            </div>

            <div
              role="group"
              aria-label={isAr ? 'تصفية نوع الرحلات' : 'Filtre type de trajet'}
              className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700"
            >
              {(
                [
                  { id: 'all', fr: 'Tous', ar: 'الكل' },
                  { id: 'urban', fr: 'Urbain', ar: 'حضري' },
                  { id: 'intercity', fr: 'Inter-wilaya', ar: 'بين الولايات' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setWilayaFilter(tab.id)}
                  aria-pressed={wilayaFilter === tab.id}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    wilayaFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isAr ? tab.ar : tab.fr}
                </button>
              ))}
            </div>
          </div>

          {visibleWilayas.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-md">
              {isAr
                ? 'لا توجد رحلات مسجلة لهذه التصفية حالياً.'
                : 'Aucun trajet enregistré pour ce filtre sur la session active.'}
            </div>
          ) : (
            <div dir="ltr" className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={visibleWilayas}
                  margin={{ top: 8, right: 12, left: 0, bottom: 18 }}
                  barCategoryGap="24%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                    axisLine={{ stroke: axisLineStroke }}
                    tickLine={false}
                    interval={0}
                    angle={visibleWilayas.length > 5 ? -20 : 0}
                    textAnchor={visibleWilayas.length > 5 ? 'end' : 'middle'}
                    height={visibleWilayas.length > 5 ? 46 : 28}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: yAxisTickColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ fill: cursorFill }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const pt = (payload[0] as CustomTooltipPayloadItem).payload as WilayaTripVolumePoint;
                      if (!pt) return null;
                      return (
                        <div
                          dir={isAr ? 'rtl' : 'ltr'}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-3 text-xs space-y-1.5 min-w-[190px]"
                        >
                          <div className="font-bold text-slate-900 dark:text-slate-100">{pt.shortLabel}</div>
                          <div className="flex justify-between gap-4 text-slate-700 dark:text-slate-300 tabular-nums">
                            <span>{isAr ? 'رحلات حضرية' : 'Courses urbaines'}</span>
                            <span className="font-mono font-semibold text-orange-600 dark:text-orange-400">
                              {pt.urbanCount}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4 text-slate-700 dark:text-slate-300 tabular-nums">
                            <span>{isAr ? 'بين الولايات' : 'Inter-wilaya'}</span>
                            <span className="font-mono font-semibold text-brand-700 dark:text-brand-300">
                              {pt.intercityCount}
                            </span>
                          </div>
                          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-4 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                            <span>{isAr ? 'حجم الطلبات' : 'Volume transport'}</span>
                            <span className="font-mono">{formatDzd(pt.volumeDzd, locale)}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {(wilayaFilter === 'all' || wilayaFilter === 'urban') && (
                    <Bar
                      dataKey="urbanCount"
                      stackId={wilayaFilter === 'all' ? 'trips' : undefined}
                      fill={orangeBrandHex}
                      radius={[4, 4, 0, 0]}
                      name={isAr ? 'رحلات حضرية' : 'Courses urbaines'}
                    />
                  )}
                  {(wilayaFilter === 'all' || wilayaFilter === 'intercity') && (
                    <Bar
                      dataKey="intercityCount"
                      stackId={wilayaFilter === 'all' ? 'trips' : undefined}
                      fill={intercityBarFill}
                      radius={wilayaFilter === 'intercity' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      name={isAr ? 'بين الولايات' : 'Inter-wilaya'}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Legend & Key Stats */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-xs bg-orange-500 inline-block" aria-hidden="true" />
                <span>
                  {isAr
                    ? `حضري (${analytics.totals.totalUrban})`
                    : `Urbain (${analytics.totals.totalUrban})`}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className="w-2.5 h-2.5 rounded-xs bg-brand-700 dark:bg-brand-300 inline-block"
                  aria-hidden="true"
                />
                <span>
                  {isAr
                    ? `بين الولايات (${analytics.totals.totalIntercity})`
                    : `Inter-wilaya (${analytics.totals.totalIntercity})`}
                </span>
              </span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
              {analytics.wilayaVolume.length}{' '}
              {isAr ? 'ولايات نشطة' : analytics.wilayaVolume.length > 1 ? 'wilayas actives' : 'wilaya active'}
            </span>
          </div>
        </div>

        {/* Chart 2: Revenus mensuels générés */}
        <div
          data-testid="monthly-revenue-chart"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col justify-between gap-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <TrendingUp className="w-4 h-4 text-brand-700 dark:text-brand-300 shrink-0" />
                <h4>{isAr ? 'الإيرادات الشهرية المحققة' : 'Revenus mensuels générés'}</h4>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>
                  {isAr
                    ? `الاشتراكات: ${formatDzd(analytics.totals.totalSubscriptionRevenueDzd, locale)}`
                    : `Abonnements : ${formatDzd(analytics.totals.totalSubscriptionRevenueDzd, locale)}`}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {isAr
                    ? `حجم النقل: ${formatDzd(analytics.totals.totalTransportVolumeDzd, locale)}`
                    : `Volume transport : ${formatDzd(analytics.totals.totalTransportVolumeDzd, locale)}`}
                </span>
              </div>
            </div>

            <div
              role="group"
              aria-label={isAr ? 'اختيار مؤشر الإيرادات' : 'Métrique de revenus'}
              className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700"
            >
              {(
                [
                  { id: 'combined', fr: 'Combiné', ar: 'مدمج' },
                  { id: 'subscriptions', fr: 'Abonnements', ar: 'الاشتراكات' },
                  { id: 'gmv', fr: 'Volume GMV', ar: 'حجم النقل' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRevenueMetric(tab.id)}
                  aria-pressed={revenueMetric === tab.id}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    revenueMetric === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isAr ? tab.ar : tab.fr}
                </button>
              ))}
            </div>
          </div>

          <div dir="ltr" className="h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={analytics.monthlyRevenue}
                margin={{ top: 8, right: 8, left: 4, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="camioGmvFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={orangeBrandHex} stopOpacity={isDark ? 0.35 : 0.22} />
                    <stop offset="95%" stopColor={orangeBrandHex} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fill: axisTickColor, fontSize: 11 }}
                  axisLine={{ stroke: axisLineStroke }}
                  tickLine={false}
                />
                {(revenueMetric === 'combined' || revenueMetric === 'subscriptions') && (
                  <YAxis
                    yAxisId="subs"
                    orientation="left"
                    tick={{ fill: isDark ? '#BC84FF' : '#530391', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={46}
                    tickFormatter={(v: number) => formatCompactDzd(v, isAr)}
                  />
                )}
                {(revenueMetric === 'combined' || revenueMetric === 'gmv') && (
                  <YAxis
                    yAxisId="gmv"
                    orientation={revenueMetric === 'combined' ? 'right' : 'left'}
                    tick={{ fill: isDark ? '#FF7433' : '#E54900', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    tickFormatter={(v: number) => formatCompactDzd(v, isAr)}
                  />
                )}
                <Tooltip
                  cursor={{ fill: cursorFill }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const pt = (payload[0] as CustomTooltipPayloadItem).payload as MonthlyRevenuePoint;
                    if (!pt) return null;
                    return (
                      <div
                        dir={isAr ? 'rtl' : 'ltr'}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-3 text-xs space-y-1.5 min-w-[215px]"
                      >
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {pt.monthLabel} · {pt.monthKey}
                        </div>
                        <div className="flex justify-between gap-4 text-slate-700 dark:text-slate-300 tabular-nums">
                          <span>{isAr ? 'عائدات الاشتراكات' : 'Revenus abonnements'}</span>
                          <span className="font-mono font-semibold text-brand-700 dark:text-brand-300">
                            {formatDzd(pt.subscriptionRevenueDzd, locale)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4 text-slate-700 dark:text-slate-300 tabular-nums">
                          <span>{isAr ? 'حجم النقل المباشر' : 'Volume transport (GMV)'}</span>
                          <span className="font-mono font-semibold text-orange-600 dark:text-orange-400">
                            {formatDzd(pt.transportVolumeDzd, locale)}
                          </span>
                        </div>
                        <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-4 text-slate-600 dark:text-slate-300 tabular-nums">
                          <span>{isAr ? 'مشتركون / رحلات' : 'Abonnés / trajets'}</span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {pt.activeSubscribers} / {pt.tripCount}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                {(revenueMetric === 'combined' || revenueMetric === 'gmv') && (
                  <Area
                    yAxisId="gmv"
                    type="monotone"
                    dataKey="transportVolumeDzd"
                    stroke={orangeBrandHex}
                    strokeWidth={2}
                    fill="url(#camioGmvFill)"
                    name={isAr ? 'حجم النقل' : 'Volume transport'}
                  />
                )}
                {(revenueMetric === 'combined' || revenueMetric === 'subscriptions') && (
                  <Bar
                    yAxisId="subs"
                    dataKey="subscriptionRevenueDzd"
                    fill={subsBarFill}
                    radius={[4, 4, 0, 0]}
                    barSize={revenueMetric === 'subscriptions' ? 32 : 20}
                    name={isAr ? 'الاشتراكات' : 'Abonnements'}
                  />
                )}
                {revenueMetric === 'subscriptions' && (
                  <Line
                    yAxisId="subs"
                    type="monotone"
                    dataKey="subscriptionRevenueDzd"
                    stroke={subsLineStroke}
                    strokeWidth={2}
                    dot={{ r: 3, fill: subsLineStroke }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend & Growth Summary */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-xs bg-brand-700 dark:bg-brand-400 inline-block" aria-hidden="true" />
                <span>{isAr ? 'الاشتراكات (DA)' : 'Abonnements (DA)'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-xs bg-orange-500 inline-block" aria-hidden="true" />
                <span>{isAr ? 'حجم النقل (GMV)' : 'Volume transport (GMV)'}</span>
              </span>
            </div>
            <span
              className={`font-semibold tabular-nums whitespace-nowrap ${
                analytics.totals.subscriptionGrowthPct >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {analytics.totals.subscriptionGrowthPct >= 0 ? '+' : ''}
              {analytics.totals.subscriptionGrowthPct}%{' '}
              {isAr ? 'نمو شهري' : 'ce mois'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
