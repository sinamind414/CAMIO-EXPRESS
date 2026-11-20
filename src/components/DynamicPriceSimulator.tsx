import { ArrowRightLeft, Calculator, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDzd, VEHICLE_LABELS } from '../domain/i18n';
import {
  compareIntercityVehiclesByRules,
  defaultPortersForSimulation,
  resolveWilayaDistance,
  simulateTripPrice,
  type SimulatorMode,
  type SimulatorServiceType,
} from '../domain/priceSimulator';
import { SEED_ROUTE_MATRIX, SEED_WILAYAS } from '../domain/seedData';
import type {
  AppSettings,
  Locale,
  PricingRule,
  RouteMatrixEntry,
  VehicleCategory,
  Wilaya,
} from '../domain/types';
import { VehicleIcon } from './VehicleIcon';
import { ServiceIcon } from './ServiceIcon';

export interface SimulatorApplyPayload {
  mode: SimulatorMode;
  serviceType: SimulatorServiceType;
  vehicleCategory: VehicleCategory;
  distanceKm: number;
  volumeM3: number;
  portersCount: number;
  floorsNoElevator: number;
  fromWilaya?: number;
  toWilaya?: number;
}

interface DynamicPriceSimulatorProps {
  locale: Locale;
  activeMode: SimulatorMode;
  wilayas?: Wilaya[];
  routeMatrix?: RouteMatrixEntry[];
  pricingRules: PricingRule[];
  settings: AppSettings;
  onApply: (payload: SimulatorApplyPayload) => void;
}

export function DynamicPriceSimulator({
  locale,
  activeMode,
  wilayas = SEED_WILAYAS,
  routeMatrix = SEED_ROUTE_MATRIX,
  pricingRules,
  settings,
  onApply,
}: DynamicPriceSimulatorProps) {
  const isAr = locale === 'ar';
  // Toutes les wilayas (69) sont proposées ; l'ouverture commerciale est gérée par routeMatrix.
  const activeWilayas = useMemo(() => wilayas, [wilayas]);

  const [expanded, setExpanded] = useState(false);
  // Default to intercity so the Wilaya-to-Wilaya moving estimator is immediately visible on load
  const [simMode, setSimMode] = useState<SimulatorMode>('intercity');
  const prevActiveModeRef = useRef<SimulatorMode>(activeMode);

  const [fromWilaya, setFromWilaya] = useState<number>(31);
  const [toWilaya, setToWilaya] = useState<number>(16);
  const [serviceType, setServiceType] = useState<SimulatorServiceType>('moving');
  const [distanceKm, setDistanceKm] = useState<number>(() =>
    resolveWilayaDistance(31, 16, wilayas, routeMatrix).distanceKm
  );
  const [manualDistanceOverride, setManualDistanceOverride] = useState(false);
  const [volumeM3, setVolumeM3] = useState<number>(10);
  const [portersCount, setPortersCount] = useState<number>(2);
  const [floorsNoElevator, setFloorsNoElevator] = useState<number>(2);
  const [needsPacking, setNeedsPacking] = useState<boolean>(false);
  const [selectedVehicleOverride, setSelectedVehicleOverride] = useState<VehicleCategory | null>(
    null
  );
  const [appliedBanner, setAppliedBanner] = useState(false);

  // Sync simulator mode when user explicitly switches ClientWorkspace mode after initial mount
  useEffect(() => {
    if (prevActiveModeRef.current === activeMode) return;
    prevActiveModeRef.current = activeMode;
    setSimMode(activeMode);
    setManualDistanceOverride(false);
    if (activeMode === 'urban') {
      setDistanceKm((prev) => (prev > 120 ? 12 : prev));
    } else {
      const resolved = resolveWilayaDistance(fromWilaya, toWilaya, wilayas, routeMatrix);
      setDistanceKm(resolved.distanceKm);
    }
  }, [activeMode, fromWilaya, toWilaya, wilayas, routeMatrix]);

  const resolvedRoute = useMemo(
    () => resolveWilayaDistance(fromWilaya, toWilaya, wilayas, routeMatrix),
    [fromWilaya, toWilaya, wilayas, routeMatrix]
  );

  // Auto-update distance when Wilaya pair changes in intercity mode (unless manually edited right after)
  useEffect(() => {
    if (simMode === 'intercity' && !manualDistanceOverride) {
      setDistanceKm(resolvedRoute.distanceKm);
    }
  }, [simMode, resolvedRoute.distanceKm, manualDistanceOverride]);

  const handleWilayaChange = (side: 'from' | 'to', code: number) => {
    setManualDistanceOverride(false);
    setAppliedBanner(false);
    if (side === 'from') {
      setFromWilaya(code);
    } else {
      setToWilaya(code);
    }
  };

  const handleSwapWilayas = () => {
    setFromWilaya(toWilaya);
    setToWilaya(fromWilaya);
    setManualDistanceOverride(false);
    setAppliedBanner(false);
  };

  const handleServiceChange = (nextService: SimulatorServiceType) => {
    setServiceType(nextService);
    setPortersCount(defaultPortersForSimulation(nextService, volumeM3));
    if (nextService !== 'moving') {
      setNeedsPacking(false);
    }
    setAppliedBanner(false);
  };

  const handleVolumeChange = (nextVol: number) => {
    const safe = Number.isFinite(nextVol) ? nextVol : 1;
    setVolumeM3(safe);
    setSelectedVehicleOverride(null);
    if (serviceType === 'moving') {
      setPortersCount(defaultPortersForSimulation('moving', safe));
    }
    setAppliedBanner(false);
  };

  const activeAxisCoef =
    simMode === 'intercity' && !manualDistanceOverride ? resolvedRoute.axisCoefficient : 1.0;

  const simulation = useMemo(
    () =>
      simulateTripPrice(
        {
          mode: simMode,
          serviceType,
          distanceKm,
          volumeM3,
          axisCoefficient: activeAxisCoef,
          portersCount,
          floorsNoElevator,
          needsPacking: serviceType === 'moving' && needsPacking,
          vehicleCategoryOverride: selectedVehicleOverride ?? undefined,
        },
        pricingRules,
        settings
      ),
    [
      simMode,
      serviceType,
      distanceKm,
      volumeM3,
      activeAxisCoef,
      portersCount,
      floorsNoElevator,
      needsPacking,
      selectedVehicleOverride,
      pricingRules,
      settings,
    ]
  );

  const vehicleTiers = useMemo(
    () =>
      simMode === 'intercity'
        ? compareIntercityVehiclesByRules(
            {
              serviceType,
              distanceKm: simulation.distanceKm,
              volumeM3: simulation.volumeM3,
              axisCoefficient: activeAxisCoef,
              portersCount: simulation.portersCount,
              floorsNoElevator: simulation.floorsNoElevator,
              needsPacking: serviceType === 'moving' && needsPacking,
            },
            pricingRules,
            settings
          )
        : [],
    [
      simMode,
      serviceType,
      simulation.distanceKm,
      simulation.volumeM3,
      activeAxisCoef,
      simulation.portersCount,
      simulation.floorsNoElevator,
      needsPacking,
      pricingRules,
      settings,
    ]
  );

  const activeRule = useMemo(
    () =>
      pricingRules.find((r) => r.vehicleCategory === simulation.vehicleCategory) ??
      pricingRules[1] ??
      pricingRules[0],
    [pricingRules, simulation.vehicleCategory]
  );

  const recVehicle = VEHICLE_LABELS[simulation.recommendation.vehicleCategory];
  const distanceMin = simMode === 'urban' ? 2 : 30;
  const distanceMax = simMode === 'urban' ? 120 : 1800;
  const distanceStep = simMode === 'urban' ? 1 : 5;

  const wilayaLabel = (code: number) => {
    const w = wilayas.find((x) => x.code === code);
    if (!w) return String(code);
    return `${String(w.code).padStart(2, '0')} · ${isAr ? w.nameAr : w.nameFr}`;
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `~${mins} ${isAr ? 'د' : 'min'}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `~${h}${isAr ? ' س ' : 'h '}${m > 0 ? String(m).padStart(2, '0') : ''}`;
  };

  const handleApply = () => {
    onApply({
      mode: simMode,
      serviceType,
      vehicleCategory: simulation.recommendation.vehicleCategory,
      distanceKm: simulation.distanceKm,
      volumeM3: simulation.volumeM3,
      portersCount: simulation.portersCount,
      floorsNoElevator: simulation.floorsNoElevator,
      fromWilaya: simMode === 'intercity' ? fromWilaya : undefined,
      toWilaya: simMode === 'intercity' ? toWilaya : undefined,
    });
    setAppliedBanner(true);
  };

  return (
    <section
      aria-label={isAr ? 'مقدر أسعار النقل بين الولايات' : 'Estimateur de prix transport (m³ & wilayas)'}
      data-testid="dynamic-price-simulator"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
    >
      {/* Header Bar */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-brand-700 dark:bg-brand-600 text-white flex items-center justify-center shrink-0">
            <Calculator className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {isAr
                ? 'مقدر تكلفة النقل بين الولايات'
                : 'Estimateur de prix transport (m³ & wilayas)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {isAr
                ? 'احسب السعر الفوري حسب الحجم (م³) والمسافة بين ولايتين وفق تعريفة المنصة'
                : 'Calculez le coût estimé selon le volume (m³) et la distance entre deux wilayas via les tarifs officiels'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!expanded && (
            <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 tabular-nums">
              {formatDzd(simulation.estimatedPriceDzd, locale)}
            </span>
          )}
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="h-8 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>
              {expanded
                ? isAr
                  ? 'طيّ المقدر'
                  : 'Réduire'
                : isAr
                ? 'فتح المقدر'
                : 'Estimer mon trajet'}
            </span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Controls */}
          <div className="lg:col-span-7 space-y-4">
            {/* Row 1: Service Type + Scope */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isAr ? 'نوع الخدمة' : 'Type de service'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'moving', fr: 'Déménagement', ar: 'نقل الأثاث' },
                      { id: 'freight', fr: 'Fret / marchandises', ar: 'نقل البضائع' },
                      { id: 'refrigerated', fr: 'Transport Réfrigéré', ar: 'النقل المبرد' },
                      { id: 'towing', fr: 'Remorquage', ar: 'سحب المركبات' },
                    ] as const
                  ).map((svc) => (
                    <button
                      key={svc.id}
                      type="button"
                      aria-pressed={serviceType === svc.id}
                      onClick={() => handleServiceChange(svc.id)}
                      className={`h-11 px-2.5 rounded-md border text-xs font-semibold flex items-center gap-2 transition-colors ${
                        serviceType === svc.id
                          ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <ServiceIcon
                        service={svc.id}
                        title={isAr ? svc.ar : svc.fr}
                        className="w-12 h-9 shrink-0"
                      />
                      <span className="truncate">{isAr ? svc.ar : svc.fr}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-4">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isAr ? 'نطاق الرحلة' : 'Portée du trajet'}
                </span>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 h-11">
                  <button
                    type="button"
                    aria-pressed={simMode === 'urban'}
                    onClick={() => {
                      setSimMode('urban');
                      setManualDistanceOverride(false);
                      if (distanceKm > 120) setDistanceKm(12);
                      setAppliedBanner(false);
                    }}
                    className={`rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                      simMode === 'urban'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {isAr ? 'داخل الولاية' : 'En ville'}
                  </button>
                  <button
                    type="button"
                    aria-pressed={simMode === 'intercity'}
                    onClick={() => {
                      setSimMode('intercity');
                      setManualDistanceOverride(false);
                      setDistanceKm(resolvedRoute.distanceKm);
                      setAppliedBanner(false);
                    }}
                    className={`rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                      simMode === 'intercity'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {isAr ? 'بين ولايتين' : 'Entre 2 wilayas'}
                  </button>
                </div>
              </div>
            </div>

            {/* Wilaya-to-Wilaya Corridor Selector (Intercity mode) */}
            {simMode === 'intercity' && (
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-11 gap-2 items-end">
                  <div className="sm:col-span-5">
                    <label
                      htmlFor="sim-from-wilaya"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {isAr ? 'ولاية الانطلاق' : 'Wilaya de départ'}
                    </label>
                    <select
                      id="sim-from-wilaya"
                      data-testid="sim-from-wilaya"
                      value={fromWilaya}
                      onChange={(e) => handleWilayaChange('from', Number(e.target.value))}
                      className="w-full h-10 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100"
                    >
                      {activeWilayas.map((w) => (
                        <option key={w.code} value={w.code} disabled={w.code === toWilaya}>
                          {String(w.code).padStart(2, '0')} · {isAr ? w.nameAr : w.nameFr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={handleSwapWilayas}
                      aria-label={isAr ? 'عكس الولايات' : 'Inverser les wilayas'}
                      title={isAr ? 'عكس الولايات' : 'Inverser'}
                      className="h-10 w-full sm:w-9 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="sm:col-span-5">
                    <label
                      htmlFor="sim-to-wilaya"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {isAr ? 'ولاية الوصول' : 'Wilaya d’arrivée'}
                    </label>
                    <select
                      id="sim-to-wilaya"
                      data-testid="sim-to-wilaya"
                      value={toWilaya}
                      onChange={(e) => handleWilayaChange('to', Number(e.target.value))}
                      className="w-full h-10 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100"
                    >
                      {activeWilayas.map((w) => (
                        <option key={w.code} value={w.code} disabled={w.code === fromWilaya}>
                          {String(w.code).padStart(2, '0')} · {isAr ? w.nameAr : w.nameFr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span data-testid="sim-route-distance-summary" className="tabular-nums">
                    {wilayaLabel(fromWilaya)} → {wilayaLabel(toWilaya)}
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <strong className="font-mono text-slate-900 dark:text-slate-100">
                      {simulation.distanceKm} km
                    </strong>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>
                      {manualDistanceOverride
                        ? isAr
                          ? 'مسافة معدلة يدوياً'
                          : 'Distance ajustée manuellement'
                        : resolvedRoute.source === 'matrix'
                        ? isAr
                          ? 'محور رسمي معتمد'
                          : 'Distance corridor officiel'
                        : isAr
                        ? 'تقدير طرقي حسب الإحداثيات'
                        : 'Estimation routière GPS'}
                    </span>
                  </span>

                  {manualDistanceOverride && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualDistanceOverride(false);
                        setDistanceKm(resolvedRoute.distanceKm);
                      }}
                      className="text-orange-700 dark:text-orange-400 font-semibold hover:underline"
                    >
                      {isAr
                        ? `إعادة (${resolvedRoute.distanceKm} كم)`
                        : `Réinitialiser (${resolvedRoute.distanceKm} km)`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Row 2: Distance (km) & Volume (m3) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Distance Slider + Input */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="sim-distance" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {isAr ? 'المسافة (كم)' : 'Distance du trajet (km)'}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id="sim-distance"
                      data-testid="sim-distance-input"
                      type="number"
                      min={distanceMin}
                      max={distanceMax}
                      step={distanceStep}
                      value={distanceKm}
                      onChange={(e) => {
                        setDistanceKm(Number(e.target.value));
                        if (simMode === 'intercity') setManualDistanceOverride(true);
                        setAppliedBanner(false);
                      }}
                      className="w-16 h-7 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 text-end tabular-nums"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">km</span>
                  </div>
                </div>
                <input
                  aria-label={isAr ? 'شريط المسافة بالكيلومتر' : 'Curseur distance en km'}
                  type="range"
                  min={distanceMin}
                  max={distanceMax}
                  step={distanceStep}
                  value={simulation.distanceKm}
                  onChange={(e) => {
                    setDistanceKm(Number(e.target.value));
                    if (simMode === 'intercity') setManualDistanceOverride(true);
                    setAppliedBanner(false);
                  }}
                  className="w-full accent-orange-600 cursor-pointer"
                />
                {simMode === 'urban' ? (
                  <div className="flex flex-wrap gap-1.5">
                    {[5, 12, 25, 60].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setDistanceKm(preset);
                          setAppliedBanner(false);
                        }}
                        className={`px-2 py-0.5 rounded border text-[11px] font-mono tabular-nums transition-colors ${
                          simulation.distanceKm === preset
                            ? 'border-slate-900 dark:border-slate-100 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {preset} km
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { from: 31, to: 16, label: 'Oran → Alger' },
                      { from: 31, to: 25, label: 'Oran → Constantine' },
                      { from: 16, to: 19, label: 'Alger → Sétif' },
                    ].map((corridor) => (
                      <button
                        key={corridor.label}
                        type="button"
                        onClick={() => {
                          setFromWilaya(corridor.from);
                          setToWilaya(corridor.to);
                          setManualDistanceOverride(false);
                          setAppliedBanner(false);
                        }}
                        className={`px-2 py-0.5 rounded border text-[11px] transition-colors ${
                          fromWilaya === corridor.from && toWilaya === corridor.to && !manualDistanceOverride
                            ? 'border-slate-900 dark:border-slate-100 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {corridor.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Volume m3 Slider + Input */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="sim-volume" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {isAr ? 'الحجم المقدر (م³)' : 'Volume à transporter (m³)'}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id="sim-volume"
                      data-testid="sim-volume-input"
                      type="number"
                      min={1}
                      max={30}
                      step={1}
                      value={volumeM3}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-16 h-7 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 text-end tabular-nums"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">m³</span>
                  </div>
                </div>
                <input
                  aria-label={isAr ? 'شريط الحجم بالمتر المكعب' : 'Curseur volume en m3'}
                  type="range"
                  min={1}
                  max={25}
                  step={1}
                  value={Math.min(25, simulation.volumeM3)}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full accent-orange-600 cursor-pointer"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { v: 3, fr: '3 m³ · Studio', ar: '3 م³ · ستوديو' },
                    { v: 6, fr: '6 m³ · Fourgon', ar: '6 م³ · فورغون' },
                    { v: 10, fr: '10 m³ · F2/F3', ar: '10 م³ · شقة' },
                    { v: 20, fr: '20 m³ · Villa', ar: '20 م³ · فيلا' },
                  ].map((p) => (
                    <button
                      key={p.v}
                      type="button"
                      onClick={() => handleVolumeChange(p.v)}
                      className={`px-2 py-0.5 rounded border text-[11px] tabular-nums transition-colors ${
                        simulation.volumeM3 === p.v
                          ? 'border-slate-900 dark:border-slate-100 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isAr ? p.ar : p.fr}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Porters, Floors, Packing + Recommended Vehicle Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-5 grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="sim-porters" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {isAr ? 'عمال الشحن' : 'Manutentionnaires'}
                  </label>
                  <select
                    id="sim-porters"
                    value={portersCount}
                    onChange={(e) => {
                      setPortersCount(Number(e.target.value));
                      setAppliedBanner(false);
                    }}
                    className="w-full h-9 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 tabular-nums"
                  >
                    {[0, 1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n === 0
                          ? isAr
                            ? '0 (السائق فقط)'
                            : '0 (sans porteur)'
                          : `${n} ${isAr ? 'عمال' : n === 1 ? 'porteur' : 'porteurs'}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="sim-floors" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {isAr ? 'طوابق بدون مصعد' : 'Étages (sans asc.)'}
                  </label>
                  <select
                    id="sim-floors"
                    value={floorsNoElevator}
                    onChange={(e) => {
                      setFloorsNoElevator(Number(e.target.value));
                      setAppliedBanner(false);
                    }}
                    className="w-full h-9 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 tabular-nums"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((f) => (
                      <option key={f} value={f}>
                        {f === 0 ? (isAr ? 'طابق أرضي / مصعد' : 'RDC / Ascenseur') : `${f}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vehicle Recommendation & Capacity Gauge */}
              <div className="sm:col-span-7 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 flex items-center gap-3">
                <VehicleIcon
                  category={simulation.recommendation.vehicleCategory}
                  title={isAr ? recVehicle.ar : recVehicle.fr}
                  className="w-20 h-14 text-brand-700 dark:text-brand-300 shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600 dark:text-slate-400 truncate">
                      {isAr ? 'المركبة المناسبة:' : 'Véhicule :'}
                    </span>
                    <strong className="text-slate-900 dark:text-slate-100 font-semibold truncate">
                      {isAr ? recVehicle.ar : recVehicle.fr} ({simulation.recommendation.capacityM3} m³)
                    </strong>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        simulation.recommendation.exceedsSingleTruck ? 'bg-amber-600' : 'bg-orange-600'
                      }`}
                      style={{ width: `${simulation.recommendation.fillRatioPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>
                      {simulation.recommendation.exceedsSingleTruck
                        ? isAr
                          ? 'يتجاوز سعة الشاحنة المختارة'
                          : `Volume > ${simulation.recommendation.capacityM3} m³ : capacité dépassée`
                        : isAr
                        ? `الامتلاء: ${simulation.recommendation.fillRatioPct}%`
                        : `Remplissage : ${simulation.recommendation.fillRatioPct} %`}
                    </span>
                    <span>
                      {activeRule
                        ? simMode === 'intercity'
                          ? `${formatDzd(activeRule.intercityBaseDzd, locale)} + ${activeRule.intercityPerKmDzd} DA/km`
                          : `${formatDzd(activeRule.baseFareDzd, locale)} + ${activeRule.perKmDzd} DA/km`
                        : formatDuration(simulation.durationMinEst)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 4 (Intercity): Interactive pricingRules Vehicle Tier Comparison + Packing Option */}
            {simMode === 'intercity' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {isAr
                      ? 'مقارنة الفئات حسب سلم الأسعار (pricingRules) :'
                      : 'Comparatif par gabarit (barème pricingRules) :'}
                  </span>
                  {serviceType === 'moving' && (
                    <label className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={needsPacking}
                        onChange={(e) => {
                          setNeedsPacking(e.target.checked);
                          setAppliedBanner(false);
                        }}
                      />
                      <span>{isAr ? 'تغليف كامل (+4000 دج)' : 'Emballage complet (+4 000 DA)'}</span>
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {vehicleTiers.map((tier) => {
                    const label = VEHICLE_LABELS[tier.vehicleCategory];
                    const isSelected = simulation.vehicleCategory === tier.vehicleCategory;
                    return (
                      <button
                        key={tier.vehicleCategory}
                        type="button"
                        data-testid={`sim-tier-${tier.vehicleCategory}`}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedVehicleOverride(
                            tier.isRecommended ? null : tier.vehicleCategory
                          );
                          setAppliedBanner(false);
                        }}
                        className={`p-2.5 rounded-md border text-start transition-colors ${
                          isSelected
                            ? 'border-orange-600 bg-orange-50/70 dark:bg-orange-950/35'
                            : tier.isSufficientCapacity
                            ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                          <span className="truncate">{isAr ? label.ar : label.fr}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                          {tier.capacityM3} m³ · {tier.intercityPerKmDzd} DA/km
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-1">
                          {formatDzd(tier.estimatedPriceDzd, locale)}
                        </div>
                        {tier.isRecommended && (
                          <div className="text-[10px] font-semibold text-orange-700 dark:text-orange-400 mt-0.5">
                            {isAr ? 'موصى به للحجم' : 'Recommandé'}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Live Estimate Card */}
          <div className="lg:col-span-5 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isAr ? 'التكلفة التقديرية الفورية' : 'Coût estimé en direct'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  {serviceType === 'moving'
                    ? isAr
                      ? 'خدمة نقل الأثاث'
                      : 'Formule Déménagement'
                    : serviceType === 'refrigerated'
                    ? isAr
                      ? 'النقل المبرد (+20%)'
                      : 'Chaîne du froid (+20 %)'
                    : serviceType === 'towing'
                    ? isAr
                      ? 'سحب وقطر (+25%)'
                      : 'Plateau & treuil (+25 %)'
                    : isAr
                    ? 'تعريفة نقل البضائع (-10%)'
                    : 'Tarif Fret (-10 %)'}{' '}
                  · {simulation.distanceKm} km · {simulation.volumeM3} m³ · {formatDuration(simulation.durationMinEst)}
                </div>
              </div>
              <div
                data-testid="simulator-estimated-price"
                className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums shrink-0"
              >
                {formatDzd(simulation.estimatedPriceDzd, locale)}
              </div>
            </div>

            <div className="px-3 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs tabular-nums">
              <span className="text-slate-600 dark:text-slate-300">
                {isAr ? 'نطاق العروض المتوقع:' : 'Fourchette d’offres chauffeurs :'}
              </span>
              <strong className="text-slate-900 dark:text-slate-100 font-mono">
                {formatDzd(simulation.priceFloorDzd, locale)} – {formatDzd(simulation.priceCapDzd, locale)}
              </strong>
            </div>

            <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-700">
              {simulation.breakdown.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                  <span>{isAr ? item.labelAr : item.labelFr}</span>
                  <span
                    className={`font-mono tabular-nums ${
                      item.amountDzd < 0 ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : ''
                    }`}
                  >
                    {formatDzd(item.amountDzd, locale)}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              data-testid="sim-apply-button"
              onClick={handleApply}
              className="w-full h-10 rounded-md bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isAr ? 'تطبيق هذه المعطيات على طلبي' : 'Appliquer ces paramètres à ma demande'}
              </span>
            </button>

            {appliedBanner && (
              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 text-center">
                {isAr
                  ? 'تم تحديث نموذج الطلب بالولايات والمركبة والحجم المختار.'
                  : 'Formulaire pré-rempli avec les wilayas, le service, véhicule et volume simulés.'}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
