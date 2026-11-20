import {
  AlertCircle,
  BarChart3,
  Check,
  CreditCard,
  Download,
  FileText,
  Map,
  Settings,
  ShieldAlert,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api/client';
import { AdminAnalyticsCharts } from './AdminAnalyticsCharts';
import { detectSuspiciousCancellations } from '../domain/compliance';
import {
  DRIVER_STATUS_LABELS,
  formatDateDz,
  formatDzd,
  INTERCITY_STATUS_LABELS,
  RIDE_STATUS_LABELS,
  SERVICE_LABELS,
  SUB_STATUS_LABELS,
  VEHICLE_LABELS,
} from '../domain/i18n';
import { DISPUTE_STATUS_LABELS, getIncidentCategoryLabel } from '../domain/incidents';
import type { ThemeMode } from '../domain/theme';
import type {
  AppSettings,
  AuditLog,
  Dispute,
  DriverProfile,
  EmptyReturnDeclaration,
  IntercityRequest,
  Locale,
  Ride,
  RouteMatrixEntry,
  SubscriptionPayment,
  Voucher,
  Wilaya,
} from '../domain/types';

interface AdminWorkspaceProps {
  locale: Locale;
  theme?: ThemeMode;
  wilayas: Wilaya[];
  routeMatrix: RouteMatrixEntry[];
  settings: AppSettings;
  drivers: DriverProfile[];
  rides: Ride[];
  intercityRequests: IntercityRequest[];
  emptyReturns: EmptyReturnDeclaration[];
  payments: SubscriptionPayment[];
  vouchers: Voucher[];
  disputes: Dispute[];
  auditLogs: AuditLog[];
  onRefresh: () => Promise<void>;
}

type AdminSection = 'dashboard' | 'drivers' | 'payments' | 'rides' | 'intercity' | 'disputes' | 'audit';

export function AdminWorkspace({
  locale,
  theme = 'light',
  wilayas,
  routeMatrix,
  settings,
  drivers,
  rides,
  intercityRequests,
  emptyReturns,
  payments,
  vouchers,
  disputes,
  auditLogs,
  onRefresh,
}: AdminWorkspaceProps) {
  const isAr = locale === 'ar';
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id ?? '');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [driverSearch, setDriverSearch] = useState('');
  const [rejectReason, setRejectReason] = useState('Photo illisible ou montant incorrect');
  const [manualDays, setManualDays] = useState('15');
  const [voucherCount, setVoucherCount] = useState('5');
  const [voucherBatch, setVoucherBatch] = useState('ORAN-DEC-2026');
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(settings);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    setSettingsDraft(settings);
  }, [settings]);

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.id === selectedDriverId) ?? drivers[0],
    [drivers, selectedDriverId]
  );

  const onlineDriversCount = drivers.filter((d) => d.isOnline).length;
  const pendingKycCount = drivers.filter((d) => d.status === 'pending_review' || d.status === 'pending_documents').length;
  const pendingPayments = payments.filter((p) => p.status === 'pending');
  const activeUrbanRides = rides.filter((r) => !['completed', 'rated', 'cancelled_client', 'cancelled_driver', 'expired'].includes(r.status));
  const openDisputes = disputes.filter((d) => d.status === 'open' || d.status === 'in_review');
  const paidSubsCount = drivers.filter((d) => d.subscription.status === 'active' || d.subscription.status === 'grace').length;
  const mrrDzd = paidSubsCount * settings.subscriptionPriceDzd;
  const demotedDrivers = drivers.filter((d) => d.isDemotedInBroadcast);
  const lowQualityIntercityDrivers = drivers.filter(
    (d) => d.intercityRatingsCount >= 3 && d.ratingIntercityAvg < 3.5
  );
  const suspiciousCancellationAlerts = useMemo(
    () => detectSuspiciousCancellations(rides, intercityRequests),
    [rides, intercityRequests]
  );

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      if (driverFilter !== 'all' && d.status !== driverFilter) return false;
      if (driverSearch.trim()) {
        const q = driverSearch.toLowerCase();
        return (
          d.fullName.toLowerCase().includes(q) ||
          d.phone.includes(q) ||
          d.vehicle.plateNumber.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [drivers, driverFilter, driverSearch]);

  const wilayaName = (code: number) => {
    const w = wilayas.find((x) => x.code === code);
    return w ? (isAr ? w.nameAr : w.nameFr) : String(code);
  };

  const exportVouchersCsv = () => {
    const rows = ['code,batch,period_days,uses,max_uses,valid_until'];
    for (const v of vouchers) {
      rows.push(`${v.code},${v.batch},${v.periodDays},${v.uses},${v.maxUses},${v.validUntil}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'camio-express-vouchers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const navItems: Array<{ id: AdminSection; fr: string; ar: string; icon: typeof BarChart3 }> = [
    { id: 'dashboard', fr: 'Tableau de bord', ar: 'لوحة القيادة', icon: BarChart3 },
    { id: 'drivers', fr: 'Chauffeurs & KYC', ar: 'السائقون والوثائق', icon: Users },
    { id: 'payments', fr: 'Abonnements & Vouchers', ar: 'الاشتراكات والتعبئة', icon: CreditCard },
    { id: 'rides', fr: 'Courses urbaines', ar: 'الرحلات الحضرية', icon: Truck },
    { id: 'intercity', fr: 'Inter-wilaya & Axes', ar: 'بين الولايات', icon: Map },
    { id: 'disputes', fr: 'Litiges & Paramètres', ar: 'النزاعات والإعدادات', icon: Settings },
    { id: 'audit', fr: 'Journal d’audit', ar: 'سجل التدقيق', icon: FileText },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Admin Left Sidebar */}
      <aside className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-1">
        <div className="px-3 py-2 text-xs font-bold text-brand-700 dark:text-brand-300 border-b border-slate-100 dark:border-slate-800 mb-1">
          {isAr ? 'وحدة التحكم الإدارية' : 'Console Administration'}
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`w-full px-3 py-2.5 rounded-md text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${
                active
                  ? 'bg-brand-700 dark:bg-brand-600 text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-brand-50/70 hover:text-brand-800 dark:hover:bg-slate-800 dark:hover:text-brand-200'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{isAr ? item.ar : item.fr}</span>
              </span>
              {item.id === 'payments' && pendingPayments.length > 0 && (
                <span className={`font-mono tabular-nums text-[11px] ${active ? 'text-orange-300' : 'text-orange-600 dark:text-orange-400'}`}>
                  {pendingPayments.length}
                </span>
              )}
              {item.id === 'drivers' && pendingKycCount > 0 && (
                <span className={`font-mono tabular-nums text-[11px] ${active ? 'text-orange-300' : 'text-orange-600 dark:text-orange-400'}`}>
                  {pendingKycCount}
                </span>
              )}
            </button>
          );
        })}
      </aside>

      {/* Main Admin Viewport */}
      <div className="lg:col-span-9 space-y-5">
        {banner && (
          <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between">
            <span>{banner}</span>
            <button type="button" onClick={() => setBanner(null)} className="underline">
              Fermer
            </button>
          </div>
        )}

        {/* ==================== 1. DASHBOARD ==================== */}
        {section === 'dashboard' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { labelFr: 'Chauffeurs en ligne', labelAr: 'سائقون متصلون', value: `${onlineDriversCount}/${drivers.length}` },
                { labelFr: 'KYC en attente', labelAr: 'ملفات قيد المراجعة', value: String(pendingKycCount) },
                { labelFr: 'Paiements en attente', labelAr: 'دفعات معلقة', value: String(pendingPayments.length) },
                { labelFr: 'MRR Abonnements', labelAr: 'الإيراد الشهري', value: formatDzd(mrrDzd, locale) },
                { labelFr: 'Courses / Inter-wilaya', labelAr: 'رحلات نشطة', value: `${activeUrbanRides.length} / ${intercityRequests.length}` },
              ].map((kpi, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">{isAr ? kpi.labelAr : kpi.labelFr}</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-1">{kpi.value}</div>
                </div>
              ))}
            </div>

            <AdminAnalyticsCharts
              locale={locale}
              theme={theme}
              wilayas={wilayas}
              drivers={drivers}
              rides={rides}
              intercityRequests={intercityRequests}
              payments={payments}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Service Breakdown */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isAr ? 'توزيع الخدمات' : 'Répartition des courses par service'}
                </h3>
                {(['moving', 'waste_removal', 'freight', 'refrigerated', 'towing'] as const).map((svc) => {
                  const count = rides.filter((r) => r.serviceType === svc).length;
                  const pct = rides.length > 0 ? Math.round((count / rides.length) * 100) : 0;
                  return (
                    <div key={svc} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {isAr ? SERVICE_LABELS[svc].ar : SERVICE_LABELS[svc].fr}
                        </span>
                        <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full bg-orange-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Operational Alerts */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isAr ? 'تنبيهات العمليات' : 'Alertes opérationnelles'}
                </h3>
                <div className="space-y-2 text-xs">
                  {pendingPayments.length > 0 && (
                    <div className="p-2.5 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/45 flex items-center justify-between gap-2">
                      <span className="text-amber-900 dark:text-amber-200">
                        {isAr
                          ? `${pendingPayments.length} وصل دفع BaridiMob/CCP قيد المراجعة (< 24 ساعة)`
                          : `${pendingPayments.length} justificatif(s) BaridiMob/CCP à valider (SLA < 24 h)`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSection('payments')}
                        className="font-semibold text-amber-900 dark:text-amber-200 underline shrink-0"
                      >
                        {isAr ? 'فتح' : 'Ouvrir'}
                      </button>
                    </div>
                  )}
                  {pendingKycCount > 0 && (
                    <div className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-2">
                      <span className="text-slate-800 dark:text-slate-200">
                        {isAr ? `${pendingKycCount} ملف(ات) سائق قيد المراجعة` : `${pendingKycCount} dossier(s) chauffeur KYC en attente`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSection('drivers')}
                        className="font-semibold text-slate-900 dark:text-slate-100 underline shrink-0"
                      >
                        {isAr ? 'مراجعة' : 'Examiner'}
                      </button>
                    </div>
                  )}
                  {openDisputes.length > 0 && (
                    <div className="p-2.5 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/45 flex items-center justify-between gap-2">
                      <span className="text-red-900 dark:text-red-200">
                        {isAr ? `${openDisputes.length} نزاع(ات) مفتوح(ة)` : `${openDisputes.length} litige(s) ouvert(s)`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSection('disputes')}
                        className="font-semibold text-red-900 dark:text-red-200 underline shrink-0"
                      >
                        {isAr ? 'معالجة' : 'Traiter'}
                      </button>
                    </div>
                  )}
                  {demotedDrivers.length > 0 && (
                    <div
                      data-testid="admin-reactivity-alert"
                      className="p-2.5 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/45 flex items-center justify-between gap-2"
                    >
                      <span className="text-amber-900 dark:text-amber-200">
                        {isAr
                          ? `${demotedDrivers.length} سائق(ون) تم خفض أولويتهم بسبب ضعف الاستجابة`
                          : `${demotedDrivers.length} chauffeur(s) rétrogradé(s) en diffusion (réactivité < ${Math.round(settings.driverResponseRateMin * 100)} % ou ≥ ${settings.driverIgnoredRequestsMax} ignorées)`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSection('drivers')}
                        className="font-semibold text-amber-900 dark:text-amber-200 underline shrink-0"
                      >
                        {isAr ? 'عرض' : 'Voir'}
                      </button>
                    </div>
                  )}
                  {lowQualityIntercityDrivers.length > 0 && (
                    <div className="p-2.5 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/45 flex items-center justify-between gap-2">
                      <span className="text-red-900 dark:text-red-200">
                        {isAr
                          ? `${lowQualityIntercityDrivers.length} سائق(ون) موقوفون عن بين الولايات (< 3.5★)`
                          : `${lowQualityIntercityDrivers.length} chauffeur(s) retiré(s) de l’inter-wilaya (note < 3,5/5)`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSection('drivers')}
                        className="font-semibold text-red-900 dark:text-red-200 underline shrink-0"
                      >
                        {isAr ? 'مراجعة' : 'Examiner'}
                      </button>
                    </div>
                  )}
                  {suspiciousCancellationAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-2.5 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/45 text-red-900 dark:text-red-200"
                    >
                      {isAr ? alert.detailAr : alert.detailFr}
                    </div>
                  ))}
                  {pendingPayments.length === 0 &&
                    pendingKycCount === 0 &&
                    openDisputes.length === 0 &&
                    demotedDrivers.length === 0 &&
                    lowQualityIntercityDrivers.length === 0 &&
                    suspiciousCancellationAlerts.length === 0 && (
                      <p className="text-slate-500 dark:text-slate-400">{isAr ? 'لا توجد تنبيهات معلقة.' : 'Aucune alerte en attente.'}</p>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. DRIVERS & KYC ==================== */}
        {section === 'drivers' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  type="search"
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  placeholder={isAr ? 'بحث بالاسم، الهاتف، اللوحة...' : 'Rechercher nom, téléphone, plaque...'}
                  className="h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs w-64"
                />
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-md border border-slate-200 dark:border-slate-700">
                  {(['all', 'approved', 'pending_review', 'suspended'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setDriverFilter(f)}
                      className={`px-2.5 py-1 rounded text-xs font-medium ${
                        driverFilter === f
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {f === 'all' ? 'Tous' : DRIVER_STATUS_LABELS[f].fr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2 text-start font-medium">Chauffeur</th>
                      <th className="py-2 text-start font-medium">Véhicule / Plaque</th>
                      <th className="py-2 text-start font-medium">Statut KYC</th>
                      <th className="py-2 text-start font-medium">Abonnement</th>
                      <th className="py-2 text-end font-medium">Réactivité</th>
                      <th className="py-2 text-end font-medium">Urbain / Inter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDrivers.map((d) => (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedDriverId(d.id)}
                        className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                          selectedDriver?.id === d.id ? 'bg-orange-50/50 dark:bg-orange-950/30' : ''
                        }`}
                      >
                        <td className="py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                          {d.fullName}
                          <div className="font-mono font-normal text-[11px] text-slate-500 dark:text-slate-400">{d.phone}</div>
                        </td>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">
                          {VEHICLE_LABELS[d.vehicle.category].fr}
                          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{d.vehicle.plateNumber}</div>
                        </td>
                        <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                          {isAr ? DRIVER_STATUS_LABELS[d.status].ar : DRIVER_STATUS_LABELS[d.status].fr}
                        </td>
                        <td className="py-2.5 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {SUB_STATUS_LABELS[d.subscription.status].fr} · {formatDateDz(d.subscription.endsOn, locale)}
                        </td>
                        <td className="py-2.5 text-end font-mono tabular-nums">
                          <span
                            className={
                              d.isDemotedInBroadcast
                                ? 'text-red-700 dark:text-red-400 font-semibold'
                                : 'text-slate-700 dark:text-slate-300'
                            }
                          >
                            {Math.round((d.responseRate ?? 1) * 100)}%
                          </span>
                          {d.isDemotedInBroadcast && (
                            <div className="text-[10px] text-red-700 dark:text-red-400">Rétrogradé</div>
                          )}
                        </td>
                        <td className="py-2.5 text-end font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          ★ {d.ratingAvg || '—'} ({d.ridesCompleted}) / ★ {d.ratingIntercityAvg || '—'} ({d.intercityCompleted})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedDriver && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">{selectedDriver.fullName}</h4>
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      {wilayaName(selectedDriver.wilayaCode)} · {selectedDriver.vehicle.brand} {selectedDriver.vehicle.model} ·{' '}
                      <span className="font-mono">{selectedDriver.vehicle.plateNumber}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/v1/admin/drivers/${selectedDriver.id}/status`, {
                          method: 'POST',
                          body: JSON.stringify({ status: 'approved' }),
                        });
                        setBanner(`Compte ${selectedDriver.fullName} approuvé.`);
                        await onRefresh();
                      }}
                      className="h-8 px-3 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                    >
                      Valider le compte
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/v1/admin/drivers/${selectedDriver.id}/status`, {
                          method: 'POST',
                          body: JSON.stringify({ status: 'suspended', reason: 'Suspension administrative' }),
                        });
                        setBanner(`Compte ${selectedDriver.fullName} suspendu.`);
                        await onRefresh();
                      }}
                      className="h-8 px-3 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/45 text-amber-900 dark:text-amber-200 text-xs font-semibold"
                    >
                      Suspendre
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/v1/admin/drivers/${selectedDriver.id}/status`, {
                          method: 'POST',
                          body: JSON.stringify({ status: 'rejected', reason: rejectReason }),
                        });
                        setBanner(`Compte ${selectedDriver.fullName} rejeté.`);
                        await onRefresh();
                      }}
                      className="h-8 px-3 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/45 text-red-800 dark:text-red-200 text-xs font-semibold"
                    >
                      Rejeter
                    </button>
                  </div>
                </div>

                {/* KYC Documents Review */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedDriver.documents.map((doc) => (
                    <div key={doc.id} className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/50 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{doc.docType}</div>
                        <div className="font-mono text-slate-500 dark:text-slate-400">{doc.fileName}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Statut : {doc.status}</div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/v1/admin/documents/${doc.id}/review`, {
                              method: 'POST',
                              body: JSON.stringify({ status: 'approved' }),
                            });
                            await onRefresh();
                          }}
                          className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                          title="Approuver pièce"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/v1/admin/documents/${doc.id}/review`, {
                              method: 'POST',
                              body: JSON.stringify({ status: 'rejected', note: rejectReason }),
                            });
                            await onRefresh();
                          }}
                          className="p-1.5 rounded bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
                          title="Rejeter pièce"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Manual Subscription Grant & Reactivity Reset */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Octroi manuel de jours :</span>
                    <input
                      type="number"
                      value={manualDays}
                      onChange={(e) => setManualDays(e.target.value)}
                      className="h-8 w-20 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/v1/admin/drivers/${selectedDriver.id}/subscription/manual`, {
                          method: 'POST',
                          body: JSON.stringify({ days: Number(manualDays), reason: 'Geste commercial admin' }),
                        });
                        setBanner(`+${manualDays} jours accordés à ${selectedDriver.fullName}.`);
                        await onRefresh();
                      }}
                      className="h-8 px-3 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white font-medium"
                    >
                      Prolonger l’abonnement
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                      Réactivité : {Math.round((selectedDriver.responseRate ?? 1) * 100)}% · {selectedDriver.ignoredRequestsStreak ?? 0} ignorée(s)
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/v1/admin/drivers/${selectedDriver.id}/reset-reactivity`, {
                          method: 'POST',
                        });
                        setBanner(`Réactivité réinitialisée pour ${selectedDriver.fullName}.`);
                        await onRefresh();
                      }}
                      className="h-8 px-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                    >
                      Réinitialiser réactivité
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== 3. PAYMENTS & VOUCHERS ==================== */}
        {section === 'payments' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isAr ? 'مراجعة وصلات الدفع (BaridiMob / CCP)' : 'File de validation des paiements'}
              </h3>

              <div className="space-y-2.5">
                {payments.map((p) => {
                  const isDup = payments.filter((x) => x.reference === p.reference).length > 1;
                  return (
                    <div key={p.id} className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {p.driverName} · <span className="uppercase">{p.method}</span> ·{' '}
                          <span className="font-mono">{p.reference}</span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          Reçu : {p.proofLabel} · {formatDateDz(p.submittedAt, locale)} · Statut :{' '}
                          <strong
                            className={
                              p.status === 'approved'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : p.status === 'rejected'
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }
                          >
                            {p.status}
                          </strong>
                        </div>
                        {isDup && (
                          <div className="text-red-700 dark:text-red-400 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Alerte anti-doublon : référence déjà soumise</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatDzd(p.amountDzd, locale)}
                        </span>
                        {p.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiRequest(`/api/v1/admin/payments/${p.id}/review`, {
                                  method: 'POST',
                                  body: JSON.stringify({ action: 'approve' }),
                                });
                                setBanner(`Paiement ${p.reference} validé (+30 jours).`);
                                await onRefresh();
                              }}
                              className="h-8 px-3 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                            >
                              Valider (+30 j)
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiRequest(`/api/v1/admin/payments/${p.id}/review`, {
                                  method: 'POST',
                                  body: JSON.stringify({ action: 'reject', reason: rejectReason }),
                                });
                                setBanner(`Paiement ${p.reference} rejeté.`);
                                await onRefresh();
                              }}
                              className="h-8 px-3 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/45 text-red-800 dark:text-red-200 font-semibold"
                            >
                              Rejeter
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Voucher Batch Generator */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {isAr ? 'إنشاء رموز تعبئة (Vouchers)' : 'Générateur de lots de vouchers'}
                </h3>
                <button
                  type="button"
                  onClick={exportVouchersCsv}
                  className="h-8 px-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor="v-batch" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nom du lot
                  </label>
                  <input
                    id="v-batch"
                    type="text"
                    value={voucherBatch}
                    onChange={(e) => setVoucherBatch(e.target.value)}
                    className="h-9 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="v-count" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Quantité
                  </label>
                  <input
                    id="v-count"
                    type="number"
                    min={1}
                    max={20}
                    value={voucherCount}
                    onChange={(e) => setVoucherCount(e.target.value)}
                    className="h-9 w-24 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiRequest('/api/v1/admin/vouchers', {
                      method: 'POST',
                      body: JSON.stringify({ batch: voucherBatch, count: Number(voucherCount), periodDays: 30 }),
                    });
                    setBanner(`${voucherCount} codes voucher générés (${voucherBatch}).`);
                    await onRefresh();
                  }}
                  className="h-9 px-4 rounded bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700"
                >
                  Générer les codes
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {vouchers.slice(0, 9).map((v) => (
                  <div key={v.code} className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs flex justify-between items-center">
                    <div>
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100">{v.code}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{v.batch} · {v.periodDays} j</div>
                    </div>
                    <span className={`font-mono text-[11px] font-semibold ${v.uses >= v.maxUses ? 'text-slate-400 dark:text-slate-500' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {v.uses}/{v.maxUses}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 4. URBAN RIDES SUPERVISION ==================== */}
        {section === 'rides' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Supervision des courses urbaines</h3>
            <div className="space-y-2.5">
              {rides.map((r) => (
                <div key={r.id} className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {r.rideCode} · {RIDE_STATUS_LABELS[r.status].fr}
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                      {r.clientName} {r.driverName ? `→ Chauffeur : ${r.driverName}` : '· En recherche'} · {r.pickup.address}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatDzd(r.finalAgreedPriceDzd ?? r.estimatedPriceDzd, locale)}
                    </span>
                    {r.status !== 'completed' && r.status !== 'rated' && r.status !== 'cancelled_client' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/v1/rides/${r.id}/status`, {
                            method: 'PATCH',
                            body: JSON.stringify({ toStatus: 'completed', actor: 'admin', note: 'Clôture forcée admin' }),
                          });
                          setBanner(`Course ${r.rideCode} clôturée par l’administrateur.`);
                          await onRefresh();
                        }}
                        className="h-8 px-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Forcer clôture
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== 5. INTER-WILAYA & ROUTE MATRIX ==================== */}
        {section === 'intercity' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Trajets inter-wilaya</h3>
              {intercityRequests.map((ic) => (
                <div key={ic.id} className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {ic.requestCode} · {wilayaName(ic.fromWilaya)} → {wilayaName(ic.toWilaya)}
                    </div>
                    <div className="text-slate-600 dark:text-slate-300">
                      {INTERCITY_STATUS_LABELS[ic.status].fr} · {formatDateDz(ic.preferredDate, locale)} · {ic.quotes.length} devis
                    </div>
                  </div>
                  <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatDzd(ic.agreedPriceDzd ?? ic.refPriceDzd, locale)}
                  </span>
                </div>
              ))}
            </div>

            {/* Route Matrix Editor */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Matrice des axes (route_matrix)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2 text-start">Axe</th>
                      <th className="py-2 text-end">Distance</th>
                      <th className="py-2 text-end">Réf. Camion moyen</th>
                      <th className="py-2 text-end">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {routeMatrix.map((rt) => (
                      <tr key={rt.id}>
                        <td className="py-2 font-semibold text-slate-900 dark:text-slate-100">
                          {wilayaName(rt.fromWilaya)} → {wilayaName(rt.toWilaya)}
                        </td>
                        <td className="py-2 text-end font-mono tabular-nums text-slate-700 dark:text-slate-300">{rt.distanceKm} km</td>
                        <td className="py-2 text-end font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {formatDzd(rt.refPrices.medium_truck, locale)}
                        </td>
                        <td className="py-2 text-end">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(`/api/v1/admin/routes/${rt.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ isActive: !rt.isActive }),
                              });
                              await onRefresh();
                            }}
                            className={`px-2.5 py-1 rounded border text-[11px] font-semibold ${
                              rt.isActive
                                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-800 dark:text-emerald-300'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {rt.isActive ? 'Ouvert' : 'Fermé'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Empty Returns Monitor */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Retours à vide déclarés ({emptyReturns.length})</h4>
              {emptyReturns.map((er) => (
                <div key={er.id} className="text-xs text-slate-700 dark:text-slate-300 flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span>
                    <strong className="text-slate-900 dark:text-slate-100">{er.driverName}</strong> · {wilayaName(er.fromWilaya)} → {wilayaName(er.toWilaya)}
                  </span>
                  <span className="font-mono text-slate-600 dark:text-slate-400">{formatDateDz(er.departDate, locale)} · {er.availableM3} m³</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== 6. DISPUTES & SETTINGS ==================== */}
        {section === 'disputes' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span>Gestion des litiges</span>
              </h3>
              {disputes.map((d) => (
                <div key={d.id} className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 space-y-2 text-xs">
                  <div className="flex justify-between gap-3 font-bold text-slate-900 dark:text-slate-100">
                    <span>
                      <span className="font-mono tabular-nums">{d.code}</span> · {getIncidentCategoryLabel(d.category, locale)} · {d.openedByName}
                    </span>
                    <span className={d.status === 'resolved' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                      {locale === 'ar' ? DISPUTE_STATUS_LABELS[d.status].ar : DISPUTE_STATUS_LABELS[d.status].fr}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{d.description}</p>
                  {d.status === 'open' && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Note de résolution..."
                        value={resolutionNotes[d.id] ?? ''}
                        onChange={(e) => setResolutionNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="flex-1 h-8 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/v1/admin/disputes/${d.id}/resolve`, {
                            method: 'POST',
                            body: JSON.stringify({
                              status: 'resolved',
                              resolutionNote: resolutionNotes[d.id] || 'Résolu après médiation.',
                            }),
                          });
                          setBanner(`Litige ${d.code} résolu.`);
                          await onRefresh();
                        }}
                        className="h-8 px-3 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white font-medium"
                      >
                        Résoudre
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* App Settings (CDC v2.1 §19.3) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Paramètres métier (app_settings · CDC v2.1)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Modèle de mise en relation, protection des coordonnées (C10–C12) et seuils opérationnels.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label htmlFor="set-sub" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Abonnement mensuel (DA)
                  </label>
                  <input
                    id="set-sub"
                    type="number"
                    value={settingsDraft.subscriptionPriceDzd}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, subscriptionPriceDzd: Number(e.target.value) }))
                    }
                    className="w-full h-9 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="set-dep" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Seuil acompte inter-wilaya (DA)
                  </label>
                  <input
                    id="set-dep"
                    type="number"
                    value={settingsDraft.intercityDepositRequiredAboveDzd}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({
                        ...s,
                        intercityDepositRequiredAboveDzd: Number(e.target.value),
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="set-ccp" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Compte CCP / BaridiMob
                  </label>
                  <input
                    id="set-ccp"
                    type="text"
                    value={settingsDraft.ccpAccount}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, ccpAccount: e.target.value }))}
                    className="w-full h-9 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="set-rate-min" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Taux réponse min. chauffeur (%)
                  </label>
                  <input
                    id="set-rate-min"
                    type="number"
                    min={5}
                    max={95}
                    value={Math.round((settingsDraft.driverResponseRateMin ?? 0.3) * 100)}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({
                        ...s,
                        driverResponseRateMin: Math.max(0.05, Math.min(0.95, Number(e.target.value) / 100)),
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="set-ign-max" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Seuil demandes ignorées (rétrogradation)
                  </label>
                  <input
                    id="set-ign-max"
                    type="number"
                    min={5}
                    max={100}
                    value={settingsDraft.driverIgnoredRequestsMax ?? 20}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({
                        ...s,
                        driverIgnoredRequestsMax: Math.max(1, Number(e.target.value)),
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="set-ic-block" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Blocage urbain inter-wilaya (±h)
                  </label>
                  <input
                    id="set-ic-block"
                    type="number"
                    min={0}
                    max={72}
                    value={settingsDraft.intercityDriverBlockHours ?? 24}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({
                        ...s,
                        intercityDriverBlockHours: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <label className="flex items-start gap-2.5 p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="setting-direct-request-toggle"
                    checked={Boolean(settingsDraft.directRequestEnabled)}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, directRequestEnabled: e.target.checked }))
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="block text-slate-900 dark:text-slate-100">
                      Sollicitation nominative (Modèle C — direct_request_enabled)
                    </strong>
                    <span className="text-slate-500 dark:text-slate-400">
                      Désactivé par défaut (Modèle A : diffusion automatique à tous les chauffeurs éligibles).
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="setting-chat-before-assign-toggle"
                    checked={Boolean(settingsDraft.chatEnabledBeforeAssignment)}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, chatEnabledBeforeAssignment: e.target.checked }))
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="block text-slate-900 dark:text-slate-100">
                      Chat avant attribution (chat_enabled_before_assignment)
                    </strong>
                    <span className="text-slate-500 dark:text-slate-400">
                      Désactivé par défaut (C11 : chat strictement verrouillé avant acceptation d’une offre).
                    </span>
                  </span>
                </label>
              </div>

              <button
                type="button"
                data-testid="admin-save-settings-btn"
                onClick={async () => {
                  await apiRequest('/api/v1/admin/settings', {
                    method: 'PUT',
                    body: JSON.stringify(settingsDraft),
                  });
                  setBanner('Paramètres enregistrés et appliqués en direct.');
                  await onRefresh();
                }}
                className="h-9 px-4 rounded bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700"
              >
                Enregistrer les paramètres
              </button>
            </div>
          </div>
        )}

        {/* ==================== 7. AUDIT LOGS ==================== */}
        {section === 'audit' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Journal d’audit immuable</h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{log.action}</span>
                    <span className="mx-1.5 text-slate-400 dark:text-slate-500">·</span>
                    <span className="text-slate-700 dark:text-slate-300">{log.detail}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    {log.actor} · {formatDateDz(log.createdAt, locale)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
