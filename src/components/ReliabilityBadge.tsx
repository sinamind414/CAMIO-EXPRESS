import { ShieldCheck } from 'lucide-react';
import type { Locale } from '../domain/types';
import type { ReliabilityInfo } from '../domain/trust';

const STYLES: Record<string, string> = {
  emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  green: 'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
  amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  red: 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
  slate: 'bg-slate-50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
};

/** Badge de fiabilité — inspiré du reliability_score de CAMIO. */
export function ReliabilityBadge({ info, locale }: { info: ReliabilityInfo; locale: Locale }) {
  const isAr = locale === 'ar';
  return (
    <span
      data-testid="reliability-badge"
      title={isAr ? 'مؤشر الموثوقية' : 'Indice de fiabilité'}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-bold ${STYLES[info.color] ?? STYLES.slate}`}
    >
      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
      {isAr ? info.labelAr : info.labelFr} · {info.score}%
    </span>
  );
}
