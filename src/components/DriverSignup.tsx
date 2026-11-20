import { ArrowRight, BadgeCheck, Camera, Check, IdCard, Phone, Truck } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../api/client';
import { VEHICLE_CATEGORIES } from '../domain/seedData';
import { VEHICLE_BRANDS } from '../domain/trust';
import { VEHICLE_LABELS } from '../domain/i18n';
import type { Locale, VehicleCategory } from '../domain/types';
import { VehicleIcon } from './VehicleIcon';

interface Props {
  locale: Locale;
  wilayas: Array<{ code: number; nameFr: string; nameAr: string }>;
  onDone: (driverId: string) => void;
  onCancel: () => void;
}

const KYC = [
  { key: 'license', fr: 'Permis de conduire', ar: 'رخصة القيادة', icon: IdCard },
  { key: 'vehicle_registration', fr: 'Carte grise', ar: 'بطاقة رمادية', icon: BadgeCheck },
  { key: 'insurance', fr: 'Assurance véhicule', ar: 'تأمين المركبة', icon: BadgeCheck },
  { key: 'vehicle_photo_plate', fr: 'Photo du véhicule + plaque', ar: 'صورة المركبة واللوحة', icon: Camera },
  { key: 'national_id', fr: 'Selfie + pièce d’identité', ar: 'سيلفي + بطاقة التعريف', icon: IdCard },
] as const;

/** Parcours d'inscription chauffeur en 4 écrans. */
export function DriverSignup({ locale, wilayas, onDone, onCancel }: Props) {
  const isAr = locale === 'ar';
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('+213');
  const [name, setName] = useState('');
  const [wilaya, setWilaya] = useState(31);
  const [category, setCategory] = useState<VehicleCategory>('van');
  const [brand, setBrand] = useState('');
  const [plate, setPlate] = useState('');
  const [docs, setDocs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleDoc = (key: string) => setDocs((prev) => prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await apiRequest<{ driver: { id: string } }>('/api/v1/driver/signup', {
        method: 'POST',
        body: JSON.stringify({
          phone, fullName: name, wilayaCode: wilaya, vehicleCategory: category,
          brand, model: VEHICLE_LABELS[category].fr, plateNumber: plate,
          documents: docs.map((d) => ({ docType: d, fileName: `${d}.jpg` })),
        }),
      });
      onDone(res.driver.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : (isAr ? 'حدث خطأ' : 'Une erreur est survenue'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {isAr ? 'انضم كسائق' : 'Devenir chauffeur'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAr ? '4 خطوات بسيطة لتبدأ استقبال الطلبات' : '4 étapes simples pour recevoir des courses'}
          </p>
        </div>
        <button type="button" onClick={onCancel} className="text-xs text-slate-500 hover:underline">
          {isAr ? 'إلغاء' : 'Annuler'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((s) => (
          <div key={s} className={`h-1.5 rounded-full ${s <= step ? 'bg-orange-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
        ))}
      </div>

      {/* 1 — coordonnées */}
      {step === 0 && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs inline-flex items-center justify-center">1</span>
            {isAr ? 'معلوماتك' : 'Vos coordonnées'}
          </div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+213 5XX XX XX XX"
            className="w-full h-11 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isAr ? 'الاسم الكامل' : 'Nom complet'}
            className="w-full h-11 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100" />
          <select value={wilaya} onChange={(e) => setWilaya(Number(e.target.value))}
            className="w-full h-11 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            {wilayas.map((w) => <option key={w.code} value={w.code}>{String(w.code).padStart(2,'0')} — {isAr ? w.nameAr : w.nameFr}</option>)}
          </select>
          <button type="button" onClick={() => setStep(1)} disabled={!name.trim() || phone.length < 10}
            className="w-full h-11 rounded-lg bg-orange-600 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2">
            <Phone className="w-4 h-4" /> {isAr ? 'متابعة' : 'Continuer'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2 — véhicule */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs inline-flex items-center justify-center">2</span>
            {isAr ? 'مركبتك' : 'Votre véhicule'}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {VEHICLE_CATEGORIES.map((vc) => (
              <button key={vc} type="button" onClick={() => setCategory(vc)}
                className={`p-2 rounded-lg border flex flex-col items-center gap-1 ${category === vc ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                <VehicleIcon category={vc} className="w-20 h-14" />
                <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-100 text-center leading-tight">
                  {isAr ? VEHICLE_LABELS[vc].ar : VEHICLE_LABELS[vc].fr}
                </span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={brand} onChange={(e) => setBrand(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm">
              <option value="">{isAr ? 'الماركة' : 'Marque du véhicule'}</option>
              {VEHICLE_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder={isAr ? 'رقم اللوحة' : 'Plaque (ex. 04521-118-31)'}
              className="w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(0)} className="h-11 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-sm">
              {isAr ? 'رجوع' : 'Retour'}
            </button>
            <button type="button" onClick={() => setStep(2)} className="flex-1 h-11 rounded-lg bg-orange-600 text-white text-sm font-bold inline-flex items-center justify-center gap-2">
              <Truck className="w-4 h-4" /> {isAr ? 'متابعة' : 'Continuer'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3 — documents KYC */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs inline-flex items-center justify-center">3</span>
            {isAr ? 'وثائقك (5 مطلوبة)' : 'Vos documents (5 requis)'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {KYC.map((d) => {
              const has = docs.includes(d.key);
              const Icon = d.icon;
              return (
                <button key={d.key} type="button" onClick={() => toggleDoc(d.key)}
                  className={`p-3 rounded-lg border flex items-center gap-2 text-start ${has ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                  <Icon className={`w-4 h-4 ${has ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex-1">{isAr ? d.ar : d.fr}</span>
                  {has && <Check className="w-4 h-4 text-emerald-600" />}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="h-11 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-sm">
              {isAr ? 'رجوع' : 'Retour'}
            </button>
            <button type="button" onClick={() => setStep(3)} disabled={docs.length < 5}
              className="flex-1 h-11 rounded-lg bg-orange-600 text-white text-sm font-bold disabled:opacity-50">
              {isAr ? 'متابعة' : 'Continuer'}
            </button>
          </div>
        </div>
      )}

      {/* 4 — récapitulatif + envoi */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs inline-flex items-center justify-center">4</span>
            {isAr ? 'تأكيد' : 'Confirmation'}
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
            <div><strong>{name}</strong> · {phone}</div>
            <div>{wilayas.find((w) => w.code === wilaya)?.nameFr} · {VEHICLE_LABELS[category].fr} · {plate || '—'}</div>
            <div>{docs.length} {isAr ? 'وثائق' : 'documents'} · {isAr ? 'فترة تجريبية 30 يوماً' : '30 jours d’essai offerts'}</div>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <button type="button" onClick={submit} disabled={busy}
            className="w-full h-12 rounded-lg bg-emerald-600 text-white text-sm font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            {busy ? (isAr ? 'جارٍ التسجيل…' : 'Inscription…') : (isAr ? 'إنشاء حسابي' : 'Créer mon compte')}
          </button>
          <button type="button" onClick={() => setStep(2)} className="w-full text-xs text-slate-500 hover:underline">
            {isAr ? '← تعديل' : '← Modifier'}
          </button>
        </div>
      )}
    </section>
  );
}
