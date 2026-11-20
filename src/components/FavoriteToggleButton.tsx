import { Heart } from 'lucide-react';
import type { Locale } from '../domain/types';

interface FavoriteToggleButtonProps {
  locale: Locale;
  driverName: string;
  isFavorite: boolean;
  onToggle: () => void | Promise<void>;
  compact?: boolean;
}

export function FavoriteToggleButton({
  locale,
  driverName,
  isFavorite,
  onToggle,
  compact = false,
}: FavoriteToggleButtonProps) {
  const isAr = locale === 'ar';
  const ariaLabel = isFavorite
    ? isAr
      ? `إزالة ${driverName} من المفضلة`
      : `Retirer ${driverName} des favoris`
    : isAr
    ? `إضافة ${driverName} إلى المفضلة`
    : `Ajouter ${driverName} aux favoris`;

  const visibleLabel = isFavorite
    ? isAr
      ? 'في المفضلة'
      : 'Favori'
    : isAr
    ? 'حفظ كمفضل'
    : 'Favoris';

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isFavorite}
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
        compact ? 'px-2 py-1 text-[11px]' : 'h-8 px-2.5 text-xs'
      } ${
        isFavorite
          ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-950/80'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      <Heart
        className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${
          isFavorite ? 'fill-rose-600 dark:fill-rose-400 text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
        }`}
      />
      <span>{visibleLabel}</span>
    </button>
  );
}
