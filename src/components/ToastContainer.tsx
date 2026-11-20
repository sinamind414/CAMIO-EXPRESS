import { AlertTriangle, Bell, CheckCircle2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ToastItem, ToastTone } from '../domain/notifications';
import type { Locale, WorkspaceRole } from '../domain/types';

interface ToastContainerProps {
  toasts: ToastItem[];
  locale: Locale;
  onDismiss: (id: string) => void;
  onNavigateWorkspace: (workspace: WorkspaceRole) => void;
}

interface SingleToastProps {
  toast: ToastItem;
  locale: Locale;
  onDismiss: (id: string) => void;
  onNavigateWorkspace: (workspace: WorkspaceRole) => void;
}

function ToastCard({ toast, locale, onDismiss, onNavigateWorkspace }: SingleToastProps) {
  const isAr = locale === 'ar';
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const elapsed = Date.now() - toast.createdAt;
    const remaining = Math.max(800, toast.durationMs - elapsed);
    const timer = setTimeout(() => onDismiss(toast.id), remaining);
    return () => clearTimeout(timer);
  }, [toast.id, toast.createdAt, toast.durationMs, paused, onDismiss]);

  const toneIcon = (tone: ToastTone) => {
    if (tone === 'success') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />;
    }
    if (tone === 'warning' || tone === 'error') {
      return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />;
    }
    return <Bell className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />;
  };

  const toneSurface = (tone: ToastTone) => {
    if (tone === 'success') return 'border-emerald-200 dark:border-emerald-800';
    if (tone === 'warning') return 'border-amber-200 dark:border-amber-800';
    if (tone === 'error') return 'border-red-200 dark:border-red-800';
    return 'border-slate-200 dark:border-slate-800';
  };

  const title = isAr ? toast.titleAr : toast.titleFr;
  const body = isAr ? toast.bodyAr : toast.bodyFr;

  return (
    <div
      role="status"
      data-testid="toast-notification"
      data-tone={toast.tone}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto bg-white dark:bg-slate-900 border ${toneSurface(
        toast.tone
      )} rounded-lg shadow-lg p-3.5 flex items-start gap-3 transition-all duration-200`}
    >
      {toneIcon(toast.tone)}

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">{title}</div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">{body}</p>
        {toast.actionWorkspace && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                onNavigateWorkspace(toast.actionWorkspace!);
                onDismiss(toast.id);
              }}
              className="text-[11px] font-semibold text-orange-700 dark:text-orange-400 hover:underline"
            >
              {isAr ? 'فتح التفاصيل' : 'Voir le suivi'}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={isAr ? 'إغلاق الإشعار' : 'Fermer la notification'}
        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer({
  toasts,
  locale,
  onDismiss,
  onNavigateWorkspace,
}: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <section
      aria-live="polite"
      aria-label={locale === 'ar' ? 'إشعارات مباشرة' : 'Notifications en temps réel'}
      className="fixed bottom-4 end-4 z-50 w-[calc(100vw-2rem)] sm:w-96 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          locale={locale}
          onDismiss={onDismiss}
          onNavigateWorkspace={onNavigateWorkspace}
        />
      ))}
    </section>
  );
}
