import { ArrowRight, MapPin, Package, Sparkles, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { QUICK_PRESETS, type QuickAnswer } from '../domain/quickRequest';
import { formatDzd, SERVICE_LABELS, VEHICLE_LABELS } from '../domain/i18n';
import type { Locale, ServiceType, VehicleCategory } from '../domain/types';
import { ServiceIcon } from './ServiceIcon';
import { VehicleIcon } from './VehicleIcon';

interface Props {
  locale: Locale;
  wilayas: Array<{ code: number; nameFr: string; nameAr: string }>;
  onPublish: (input: {
    service: ServiceType;
    vehicle: VehicleCategory;
    porters: number;
    wilayaCode: number;
    pickupAddress: string;
    dropoffAddress: string;
  }) => void;
  onAdvanced: () => void;
}

/** 3 questions, une seule action : publier. Le reste est pré-rempli. */
export function QuickRequest({ locale, wilayas, onPublish, onAdvanced }: Props) {
  const isAr = locale === 'ar';
  const [step, setStep] = useState(0);
  const [service, setService] = useState<ServiceType | null>(null);
  const [preset, setPreset] = useState<QuickAnswer | null>(null);
  const [wilayaCode, setWilayaCode] = useState(31);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');

  const services = useMemo(() => Object.keys(SERVICE_LABELS) as ServiceType[], []);
  const wilayaName = wilayas.find((w) => w.code === wilayaCode);
  const name = isAr ? wilayaName?.nameAr : wilayaName?.nameFr;

  const chooseService = (s: ServiceType) => {
    setService(s);
    setPreset(null);
    setStep(1);
  };

  const choosePreset = (p: QuickAnswer) => {
    setPreset(p);
    setService(p.service);
    setStep(2);
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {isAr ? 'اطلب خدمتك في 3 خطوات' : 'Demandez votre service en 3 étapes'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAr ? 'سؤال واحد في كل مرة. الباقي تلقائي.' : 'Une seule question à la fois — le reste est automatique.'}
          </p>
        </div>
      </div>

      {/* étapes 1-2-3 */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-orange-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
        ))}
      </div>

      {/* Q1 — Quel service ? */}
      {step === 0 && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs inline-flex items-center justify-center">1</span>
            {isAr ? 'ماذا تريد أن تنقل؟' : 'Que voulez-vous faire ?'}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {services.map((s) => (
              <button key={s} type="button" onClick={() => chooseService(s)}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 flex flex-col items-center gap-2 text-center">
                <ServiceIcon service={s} className="w-14 h-12" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {isAr ? SERVICE_LABELS[s].ar : SERVICE_LABELS[s].fr}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Q2 — Quelle taille ? */}
      {step === 1 && service && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs inline-flex items-center justify-center">2</span>
            {isAr ? 'كم حجم الشحنة؟' : 'Quelle taille ?'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_PRESETS.filter((p) => p.service === service).map((p) => (
              <button key={p.labelFr} type="button" onClick={() => choosePreset(p)}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 flex items-center gap-3 text-start">
                <VehicleIcon category={p.vehicle} className="w-16 h-12 shrink-0" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {isAr ? p.labelAr : p.labelFr}
                </span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep(0)} className="text-xs text-slate-500 hover:underline">
            {isAr ? '← رجوع' : '← Retour'}
          </button>
        </div>
      )}

      {/* Q3 — Où ? */}
      {step === 2 && preset && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs inline-flex items-center justify-center">3</span>
            {isAr ? 'أين؟ (ولاية واحدة تكفي)' : 'Où ? (une seule wilaya suffit)'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {isAr ? 'الولاية' : 'Wilaya'}
              </label>
              <select value={wilayaCode} onChange={(e) => setWilayaCode(Number(e.target.value))}
                className="w-full h-10 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm">
                {wilayas.map((w) => (
                  <option key={w.code} value={w.code}>
                    {String(w.code).padStart(2, '0')} — {isAr ? w.nameAr : w.nameFr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {isAr ? 'الدائرة (اختياري)' : 'Commune (optionnel)'}
              </label>
              <input value={pickup} onChange={(e) => setPickup(e.target.value)}
                placeholder={name ?? ''}
                className="w-full h-10 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {isAr ? 'الوجهة (اختياري)' : 'Destination (optionnel)'}
              </label>
              <input value={dropoff} onChange={(e) => setDropoff(e.target.value)}
                placeholder={isAr ? 'نوع المكان' : 'ex. Es Senia'}
                className="w-full h-10 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm" />
            </div>
          </div>

          {/* récapitulatif */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
            <ServiceIcon service={preset.service} className="w-12 h-9" />
            <VehicleIcon category={preset.vehicle} className="w-14 h-10" />
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {isAr ? preset.labelAr : preset.labelFr} · {name}
            </span>
            {preset.porters > 0 && (
              <span className="text-slate-500">+ {preset.porters} {isAr ? 'عمال' : 'porteurs'}</span>
            )}
          </div>

          <button type="button"
            onClick={() => onPublish({
              service: preset.service,
              vehicle: preset.vehicle,
              porters: preset.porters,
              wilayaCode,
              pickupAddress: pickup || name || '',
              dropoffAddress: dropoff || (preset.service === 'waste_removal' ? '' : (name ?? '')),
            })}
            className="w-full h-12 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 inline-flex items-center justify-center gap-2">
            <Truck className="w-4 h-4" />
            {isAr ? 'اطلب الخدمة الآن' : 'Demander ce service'}
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setStep(1)} className="text-xs text-slate-500 hover:underline">
              {isAr ? '← رجوع' : '← Retour'}
            </button>
            <button type="button" onClick={onAdvanced} className="text-xs font-semibold text-orange-700 dark:text-orange-400 hover:underline inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {isAr ? 'أريد تحديد تفاصيل أكثر' : 'Je veux préciser les détails'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
