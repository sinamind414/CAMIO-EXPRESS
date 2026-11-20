import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  FileWarning,
  History,
  PackageX,
  ShieldAlert,
  UserX,
  X,
} from 'lucide-react';
import { useMemo, useState, type ComponentType, type FormEvent } from 'react';
import {
  formatDateDz,
  formatDzd,
  INTERCITY_STATUS_LABELS,
  RIDE_STATUS_LABELS,
  SERVICE_LABELS,
  VEHICLE_LABELS,
} from '../domain/i18n';
import {
  buildRideHistoryEntries,
  DISPUTE_STATUS_LABELS,
  getIncidentCategoryLabel,
  INCIDENT_CATEGORIES,
  validateIncidentReport,
  type RideHistoryEntry,
} from '../domain/incidents';
import type {
  Dispute,
  DisputeCategory,
  IntercityRequest,
  IntercityStatus,
  Locale,
  Ride,
  RideStatus,
  Wilaya,
} from '../domain/types';

export interface QuickIncidentSubmitPayload {
  parentType: 'ride' | 'intercity_request';
  parentId: string;
  code: string;
  category: DisputeCategory;
  description: string;
}

interface QuickIncidentPanelProps {
  id?: string;
  locale: Locale;
  rides: Ride[];
  intercityRequests: IntercityRequest[];
  disputes: Dispute[];
  wilayas: Wilaya[];
  onInspectTrip: (parentType: 'ride' | 'intercity_request', id: string) => void;
  onSubmitIncident: (payload: QuickIncidentSubmitPayload) => Promise<void>;
}

const CATEGORY_ICONS: Record<DisputeCategory, ComponentType<{ className?: string }>> = {
  damage: PackageX,
  delay: Clock,
  price: Banknote,
  no_show: UserX,
  rudeness: ShieldAlert,
  app_bug: AlertTriangle,
  other: FileWarning,
};

export function QuickIncidentPanel({
  id = 'client-ride-history',
  locale,
  rides,
  intercityRequests,
  disputes,
  wilayas,
  onInspectTrip,
  onSubmitIncident,
}: QuickIncidentPanelProps) {
  const isAr = locale === 'ar';
  const [filterMode, setFilterMode] = useState<'all' | 'ride' | 'intercity_request' | 'disputed'>('all');
  const [activeTargetKey, setActiveTargetKey] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DisputeCategory>('damage');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const entries = useMemo(
    () => buildRideHistoryEntries(rides, intercityRequests, disputes),
    [rides, intercityRequests, disputes]
  );

  const filteredEntries = useMemo(() => {
    if (filterMode === 'all') return entries;
    if (filterMode === 'disputed') {
      return entries.filter((e) => e.incidents.length > 0 || e.status === 'disputed');
    }
    return entries.filter((e) => e.parentType === filterMode);
  }, [entries, filterMode]);

  const openIncidentsCount = useMemo(
    () => entries.filter((e) => e.hasOpenIncident).length,
    [entries]
  );

  const wilayaLabel = (code?: number) => {
    if (!code) return '';
    const w = wilayas.find((item) => item.code === code);
    return w ? (isAr ? w.nameAr : w.nameFr) : String(code);
  };

  const getStatusLabel = (entry: RideHistoryEntry) => {
    if (entry.parentType === 'ride') {
      const lbl = RIDE_STATUS_LABELS[entry.status as RideStatus];
      return lbl ? (isAr ? lbl.ar : lbl.fr) : entry.status;
    }
    const lbl = INTERCITY_STATUS_LABELS[entry.status as IntercityStatus];
    return lbl ? (isAr ? lbl.ar : lbl.fr) : entry.status;
  };

  const openReportForm = (entry: RideHistoryEntry, presetCategory: DisputeCategory = 'damage') => {
    const key = `${entry.parentType}:${entry.id}`;
    if (activeTargetKey === key) {
      setActiveTargetKey(null);
      setFormError(null);
      return;
    }
    setActiveTargetKey(key);
    setSelectedCategory(presetCategory);
    setDescription('');
    setFormError(null);
  };

  const handleCategoryChange = (cat: DisputeCategory) => {
    setSelectedCategory(cat);
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent, entry: RideHistoryEntry) => {
    e.preventDefault();
    const check = validateIncidentReport({
      parentId: entry.id,
      parentType: entry.parentType,
      category: selectedCategory,
      description,
    });
    if (!check.valid) {
      setFormError(isAr ? check.reasonAr || 'بيانات غير صالحة' : check.reasonFr || 'Signalement incomplet.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmitIncident({
        parentType: entry.parentType,
        parentId: entry.id,
        code: entry.code,
        category: check.category,
        description: check.description,
      });
      setActiveTargetKey(null);
      setDescription('');
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : isAr
          ? 'تعذر إرسال البلاغ.'
          : 'Impossible d’enregistrer le signalement.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const activeCategoryMeta =
    INCIDENT_CATEGORIES.find((c) => c.id === selectedCategory) ?? INCIDENT_CATEGORIES[0];

  return (
    <section
      id={id}
      data-testid="ride-history-incidents-panel"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header + Filter Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-orange-600 shrink-0" />
            <span>
              {isAr
                ? 'سجل الرحلات والإبلاغ السريع عن الحوادث'
                : 'Historique des trajets & signalement rapide'}
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {isAr
              ? `${entries.length} رحلة مسجلة · ${openIncidentsCount} بلاغ مفتوح — أبلغ عن أي ضرر أو تأخر مباشرة من السجل.`
              : `${entries.length} trajet(s) enregistré(s) · ${openIncidentsCount} incident(s) ouvert(s) — déclarez un dommage ou un retard en 2 clics.`}
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          {(
            [
              { id: 'all', fr: 'Tous', ar: 'الكل' },
              { id: 'ride', fr: 'En ville', ar: 'داخل المدينة' },
              { id: 'intercity_request', fr: 'Inter-wilaya', ar: 'بين الولايات' },
              { id: 'disputed', fr: 'Signalés', ar: 'بها بلاغ' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                filterMode === tab.id
                  ? 'bg-slate-900 dark:bg-orange-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isAr ? tab.ar : tab.fr}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      {filteredEntries.length === 0 ? (
        <div className="p-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
          {isAr
            ? 'لا توجد رحلات مطابقة لهذا الفلتر.'
            : 'Aucun trajet ne correspond à ce filtre.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const targetKey = `${entry.parentType}:${entry.id}`;
            const isFormOpen = activeTargetKey === targetKey;
            const routeTitle =
              entry.parentType === 'intercity_request' && entry.fromWilaya && entry.toWilaya
                ? `${wilayaLabel(entry.fromWilaya)} → ${wilayaLabel(entry.toWilaya)}`
                : `${entry.pickupLabel} → ${entry.dropoffLabel}`;

            return (
              <div
                key={targetKey}
                data-testid={`history-entry-${entry.id}`}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {entry.code}
                      </span>
                      <span className="text-slate-400 dark:text-slate-600">·</span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {entry.parentType === 'intercity_request'
                          ? isAr
                            ? 'بين الولايات'
                            : 'Inter-wilaya'
                          : isAr
                          ? 'داخل المدينة'
                          : 'En ville'}
                      </span>
                      <span className="text-slate-400 dark:text-slate-600">·</span>
                      <span
                        className={`font-semibold ${
                          entry.status === 'disputed' || entry.hasOpenIncident
                            ? 'text-red-700 dark:text-red-400'
                            : entry.status === 'completed' || entry.status === 'rated'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {getStatusLabel(entry)}
                      </span>
                      <span className="text-slate-400 dark:text-slate-600">·</span>
                      <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatDateDz(entry.timestampIso, locale)}
                      </span>
                    </div>

                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {routeTitle}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                      <span>
                        {isAr
                          ? SERVICE_LABELS[entry.serviceType].ar
                          : SERVICE_LABELS[entry.serviceType].fr}
                      </span>
                      <span>·</span>
                      <span>
                        {isAr
                          ? VEHICLE_LABELS[entry.vehicleCategory].ar
                          : VEHICLE_LABELS[entry.vehicleCategory].fr}
                      </span>
                      <span>·</span>
                      <span>{entry.distanceKm} km</span>
                      {entry.driverName && (
                        <>
                          <span>·</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {entry.driverName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums me-1">
                      {formatDzd(entry.priceDzd, locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onInspectTrip(entry.parentType, entry.id)}
                      className="h-8 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap"
                    >
                      {isAr ? 'عرض الرحلة' : 'Suivre'}
                    </button>
                    <button
                      type="button"
                      data-testid={`report-incident-${entry.id}`}
                      onClick={() => openReportForm(entry, 'damage')}
                      className={`h-8 px-3 rounded-md border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                        isFormOpen
                          ? 'bg-red-700 border-red-700 text-white'
                          : 'border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40'
                      }`}
                    >
                      <FileWarning className="w-3.5 h-3.5" />
                      <span>
                        {isFormOpen
                          ? isAr
                            ? 'إغلاق'
                            : 'Fermer'
                          : isAr
                          ? 'إبلاغ عن حادث'
                          : 'Signaler un incident'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Existing incidents attached to this ride */}
                {entry.incidents.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                    {entry.incidents.map((inc) => (
                      <div
                        key={inc.id}
                        data-testid={`incident-record-${inc.id}`}
                        className="p-2.5 rounded-md border border-red-200/80 dark:border-red-900/70 bg-red-50/60 dark:bg-red-950/30 flex flex-wrap items-start justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-red-900 dark:text-red-200 flex flex-wrap items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{getIncidentCategoryLabel(inc.category, locale)}</span>
                            <span className="text-red-400 dark:text-red-600">·</span>
                            <span>
                              {isAr
                                ? DISPUTE_STATUS_LABELS[inc.status].ar
                                : DISPUTE_STATUS_LABELS[inc.status].fr}
                            </span>
                          </div>
                          <p className="text-slate-700 dark:text-slate-300">{inc.description}</p>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {formatDateDz(inc.createdAt, locale)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline Quick Incident Report Drawer */}
                {isFormOpen && (
                  <form
                    onSubmit={(e) => handleSubmit(e, entry)}
                    data-testid="quick-incident-form"
                    className="p-4 rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {isAr
                            ? `بلاغ سريع عن الرحلة ${entry.code}`
                            : `Signalement rapide · ${entry.code}`}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isAr
                            ? 'اختر نوع الحادث (ضرر، تأخر...) وأضف وصفاً مختصراً ليتم تحويله فوراً إلى الدعم.'
                            : 'Sélectionnez le type d’incident (dommage, retard…) et précisez les faits.'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTargetKey(null)}
                        aria-label={isAr ? 'إغلاق النموذج' : 'Fermer le formulaire'}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Category Buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {INCIDENT_CATEGORIES.map((cat) => {
                        const Icon = CATEGORY_ICONS[cat.id];
                        const active = selectedCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            data-testid={`incident-cat-${cat.id}`}
                            onClick={() => handleCategoryChange(cat.id)}
                            className={`p-2 rounded-md border text-start transition-colors flex items-center gap-1.5 text-xs font-medium ${
                              active
                                ? 'bg-red-700 border-red-700 text-white'
                                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-red-300 dark:hover:border-red-800'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{isAr ? cat.labelAr : cat.labelFr}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Presets for Selected Category */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        {isAr ? 'أمثلة سريعة:' : 'Motifs rapides :'}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeCategoryMeta.quickReasons.map((reason, idx) => {
                          const text = isAr ? reason.ar : reason.fr;
                          const isSelected = description.trim() === text;
                          return (
                            <button
                              key={idx}
                              type="button"
                              data-testid={`incident-preset-${activeCategoryMeta.id}-${idx}`}
                              onClick={() => {
                                setDescription(text);
                                setFormError(null);
                              }}
                              className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors text-start ${
                                isSelected
                                  ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 font-semibold'
                                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                            >
                              {text}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Description Textarea */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor={`quick-inc-desc-${entry.id}`}
                          className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          {isAr ? 'تفاصيل الحادث' : 'Détails constatés'}
                        </label>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                          {description.trim().length} / 8+ {isAr ? 'حرف' : 'car.'}
                        </span>
                      </div>
                      <textarea
                        id={`quick-inc-desc-${entry.id}`}
                        data-testid="quick-incident-description"
                        rows={2}
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          if (formError) setFormError(null);
                        }}
                        placeholder={
                          isAr
                            ? activeCategoryMeta.hintAr
                            : `${activeCategoryMeta.hintFr} (ex. heure, objet concerné, circonstances)...`
                        }
                        className="w-full p-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
                      />
                    </div>

                    {formError && (
                      <div
                        role="alert"
                        className="p-2.5 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/45 text-red-800 dark:text-red-200 text-xs"
                      >
                        {formError}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTargetKey(null)}
                        className="h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {isAr ? 'إلغاء' : 'Annuler'}
                      </button>
                      <button
                        type="submit"
                        data-testid="submit-quick-incident"
                        disabled={submitting}
                        className="h-9 px-4 rounded-md bg-red-700 hover:bg-red-600 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {submitting
                          ? isAr
                            ? 'جاري الإرسال...'
                            : 'Envoi en cours...'
                          : isAr
                          ? 'إرسال البلاغ'
                          : 'Envoyer le signalement'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
