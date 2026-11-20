import { BookmarkCheck, Heart, Pencil, Send, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { resolveFavoriteDrivers } from '../domain/favorites';
import { formatDateDz, VEHICLE_LABELS } from '../domain/i18n';
import type {
  DriverProfile,
  DriverReview,
  FavoriteDriverEntry,
  Locale,
} from '../domain/types';
import { VehicleIcon } from './VehicleIcon';

interface FavoriteDriversPanelProps {
  id?: string;
  locale: Locale;
  favorites: FavoriteDriverEntry[];
  drivers: DriverProfile[];
  reviews: DriverReview[];
  preferredDriverId?: string | null;
  directRequestEnabled?: boolean;
  onToggleFavorite: (driverId: string) => Promise<void>;
  onUpdateNote: (driverId: string, note: string) => Promise<void>;
  onRequestDriver: (driver: DriverProfile) => void;
  onInspectReviews: (driverId: string) => void;
}

export function FavoriteDriversPanel({
  id = 'client-favorite-drivers',
  locale,
  favorites,
  drivers,
  reviews,
  preferredDriverId = null,
  directRequestEnabled = false,
  onToggleFavorite,
  onUpdateNote,
  onRequestDriver,
  onInspectReviews,
}: FavoriteDriversPanelProps) {
  const isAr = locale === 'ar';
  const [editingNoteDriverId, setEditingNoteDriverId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [savingNote, setSavingNote] = useState<boolean>(false);

  const resolvedFavorites = useMemo(
    () => resolveFavoriteDrivers(favorites, drivers, reviews),
    [favorites, drivers, reviews]
  );

  const suggestedApprovedDrivers = useMemo(() => {
    const favIds = new Set(resolvedFavorites.map((item) => item.driver.id));
    return drivers.filter((d) => d.status === 'approved' && !favIds.has(d.id)).slice(0, 3);
  }, [drivers, resolvedFavorites]);

  const startEditNote = (driverId: string, currentNote?: string) => {
    setEditingNoteDriverId(driverId);
    setNoteDraft(currentNote ?? '');
  };

  const submitNote = async (driverId: string) => {
    setSavingNote(true);
    try {
      await onUpdateNote(driverId, noteDraft);
      setEditingNoteDriverId(null);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <section
      id={id}
      data-testid="favorite-drivers-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
            <BookmarkCheck className="w-4 h-4 shrink-0" />
            <span>
              {isAr ? 'دليل السائقين الموثوقين لديك' : 'Carnet d’adresses transport personnel'}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
            {isAr ? 'سائقوي المفضلون' : 'Mes chauffeurs favoris'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {directRequestEnabled
              ? isAr
                ? 'احفظ السائقين الذين تثق بهم لإعادة طلبهم بنقرة واحدة في رحلاتك القادمة.'
                : 'Sauvegardez vos chauffeurs de confiance pour préremplir et prioriser vos prochaines demandes.'
              : isAr
              ? 'دفتر خاص لمتابعة السائقين المفضلين وترتيب عروضهم أولاً (البث التلقائي للنموذج A مفعل بدون طلب مباشر).'
              : 'Carnet personnel pour repérer vos favoris dans les offres reçues et préremplir leur catégorie de véhicule (diffusion automatique Modèle A).'}
          </p>
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          {resolvedFavorites.length}{' '}
          {isAr
            ? 'سائق محفوظ'
            : resolvedFavorites.length > 1
            ? 'chauffeurs enregistrés'
            : 'chauffeur enregistré'}
        </div>
      </div>

      {resolvedFavorites.length === 0 ? (
        <div
          data-testid="favorites-empty-state"
          className="p-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-4"
        >
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {isAr ? 'لا يوجد سائقون في المفضلة حالياً' : 'Aucun chauffeur favori enregistré pour le moment'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr
                ? 'انقر على «حفظ كمفضل» في العروض أو التقييمات لحفظ سائق، أو أضف أحد السائقين المعتمدين أدناه.'
                : 'Cliquez sur « Favoris » depuis une offre, une course terminée ou un avis client pour l’ajouter ici.'}
            </p>
          </div>

          {suggestedApprovedDrivers.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {suggestedApprovedDrivers.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onToggleFavorite(d.id)}
                  className="h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5"
                >
                  <Heart className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>
                    {isAr ? `إضافة ${d.fullName}` : `Ajouter ${d.fullName}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resolvedFavorites.map(({ favorite, driver, verifiedReviewsCount }) => {
            const vInfo = VEHICLE_LABELS[driver.vehicle.category];
            const isPreferred = preferredDriverId === driver.id;
            const isEditingNote = editingNoteDriverId === driver.id;

            return (
              <article
                key={favorite.id}
                data-testid="favorite-driver-card"
                className={`p-4 rounded-lg border flex flex-col justify-between gap-3 transition-colors ${
                  isPreferred
                    ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row: Vehicle photo + Identity */}
                  <div className="flex items-start gap-3">
                    <VehicleIcon
                      category={driver.vehicle.category}
                      title={isAr ? vInfo.ar : vInfo.fr}
                      className="w-20 h-14 shrink-0 text-brand-700 dark:text-brand-300"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {driver.fullName}
                        </h4>
                        <button
                          type="button"
                          aria-label={
                            isAr
                              ? `إزالة ${driver.fullName} من المفضلة`
                              : `Retirer ${driver.fullName} des favoris`
                          }
                          onClick={() => onToggleFavorite(driver.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        {driver.vehicle.brand} {driver.vehicle.model} · {isAr ? vInfo.ar : vInfo.fr}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        ★ {driver.ratingAvg > 0 ? driver.ratingAvg.toFixed(2) : '—'} · {driver.ridesCompleted}{' '}
                        {isAr ? 'رحلة' : 'courses'}
                        <span className="mx-1.5">·</span>
                        <span
                          className={
                            driver.isOnline
                              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                              : 'text-slate-500 dark:text-slate-400'
                          }
                        >
                          {driver.isOnline
                            ? isAr
                              ? 'متاح الآن'
                              : 'Disponible'
                            : isAr
                            ? 'غير متصل'
                            : 'Hors ligne'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Personal memo / note */}
                  {isEditingNote ? (
                    <div className="space-y-2 pt-1">
                      <label htmlFor={`fav-note-${driver.id}`} className="sr-only">
                        {isAr ? 'ملاحظة شخصية' : 'Mémo personnel'}
                      </label>
                      <input
                        id={`fav-note-${driver.id}`}
                        type="text"
                        maxLength={140}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder={
                          isAr
                            ? 'مثال: ممتاز للأثاث الحساس...'
                            : 'Ex: Ponctuel, équipé de sangles...'
                        }
                        className="w-full h-8 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={savingNote}
                          onClick={() => submitNote(driver.id)}
                          className="h-7 px-3 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50"
                        >
                          {isAr ? 'حفظ' : 'Enregistrer'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNoteDriverId(null)}
                          className="h-7 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200"
                        >
                          {isAr ? 'إلغاء' : 'Annuler'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="leading-snug">
                        {favorite.note ? (
                          <>« {favorite.note} »</>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">
                            {isAr ? 'بدون ملاحظة شخصية' : 'Aucune note personnelle'}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        aria-label={
                          isAr
                            ? `تعديل ملاحظة ${driver.fullName}`
                            : `Modifier la note pour ${driver.fullName}`
                        }
                        onClick={() => startEditNote(driver.id, favorite.note)}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions & Meta Footer */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {verifiedReviewsCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => onInspectReviews(driver.id)}
                        className="font-medium text-orange-700 dark:text-orange-400 hover:underline tabular-nums"
                      >
                        {isAr
                          ? `عرض ${verifiedReviewsCount} تقييمات موثّقة`
                          : `Voir les ${verifiedReviewsCount} avis vérifiés`}
                      </button>
                    ) : (
                      <span>{isAr ? 'ملف معتمد' : 'Profil vérifié'}</span>
                    )}
                    <span className="font-mono tabular-nums">
                      {formatDateDz(favorite.createdAt, locale)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRequestDriver(driver)}
                    className={`w-full h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                      isPreferred
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white'
                        : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {directRequestEnabled
                        ? isPreferred
                          ? isAr
                            ? 'محدد في طلبك الحالي'
                            : 'Sélectionné pour la demande'
                          : isAr
                          ? 'طلب هذا السائق'
                          : 'Demander ce chauffeur'
                        : isAr
                        ? 'تعبئة نوع المركبة والولاية'
                        : 'Préremplir véhicule & wilaya'}
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
