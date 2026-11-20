import { Moon, Sun, User, Truck, LayoutDashboard, CircleHelp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, type BootstrapPayload } from './api/client';
import { wsClient } from './api/wsClient';
import { AdminWorkspace } from './components/AdminWorkspace';
import { CamioLogo } from './components/CamioLogo';
import { ClientWorkspace } from './components/ClientWorkspace';
import { DriverWorkspace } from './components/DriverWorkspace';
import { HelpCenter } from './components/HelpCenter';
import { RoleSelection } from './components/RoleSelection';
import { ToastContainer } from './components/ToastContainer';
import { TEXTS } from './domain/i18n';
import {
  dismissToast,
  mapWsEnvelopeToToast,
  pushToast,
  type ToastItem,
} from './domain/notifications';
import {
  applyThemeToElement,
  persistThemeMode,
  resolveInitialTheme,
  toggleThemeMode,
  type ThemeMode,
} from './domain/theme';
import type { IntercityRequest, Locale, Ride, WorkspaceRole } from './domain/types';

type AppTab = WorkspaceRole | 'help';

export default function App() {
  const [locale, setLocale] = useState<Locale>('fr');
  const [theme, setTheme] = useState<ThemeMode>(() =>
    resolveInitialTheme(
      typeof window !== 'undefined' ? window.localStorage : null,
      typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
    )
  );
  const [workspace, setWorkspace] = useState<AppTab>('client');
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sessionRole, setSessionRole] = useState<'client' | 'driver' | 'admin' | null>(null);
  // Écran d'accueil « Qui êtes-vous ? » (persisté localement).
  const [roleSelected, setRoleSelected] = useState<'client' | 'driver' | null>(() => {
    if (typeof window === 'undefined') return 'client';
    return (window.localStorage.getItem('camio_role') as 'client' | 'driver' | null) ?? null;
  });

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => toggleThemeMode(prev));
  }, []);

  const handleDismissToast = useCallback((id: string) => {
    setToasts((prev) => dismissToast(prev, id));
  }, []);

  const fetchBootstrap = useCallback(async () => {
    try {
      const payload = await apiRequest<BootstrapPayload>('/api/v1/bootstrap');
      setData(payload);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de connexion au serveur');
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    applyThemeToElement(document.documentElement, theme);
    persistThemeMode(theme, typeof window !== 'undefined' ? window.localStorage : null);
  }, [theme]);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  // Real WebSocket subscription for live multi-actor sync (Client <-> Driver <-> Admin)
  useEffect(() => {
    const unsubscribe = wsClient.subscribeEvents((msg) => {
      if (msg.event === 'connected') return;

      const toastDraft = mapWsEnvelopeToToast(msg);
      if (toastDraft) {
        setToasts((prev) => pushToast(prev, toastDraft));
      }

      if (msg.event === 'driver.position') {
        const payload = msg.payload as {
          rideId?: string;
          pos?: Ride['driverLivePos'];
          trail?: Ride['driverTrail'];
        };
        if (payload?.rideId && payload.pos) {
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              rides: prev.rides.map((r) =>
                r.id === payload.rideId
                  ? {
                      ...r,
                      driverLivePos: payload.pos,
                      driverTrail: payload.trail ?? r.driverTrail,
                    }
                  : r
              ),
            };
          });
        }
        return;
      }

      if (msg.event === 'intercity.position') {
        const payload = msg.payload as {
          intercityId?: string;
          pos?: IntercityRequest['driverLivePos'];
          trail?: IntercityRequest['driverTrail'];
        };
        if (payload?.intercityId && payload.pos) {
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              intercityRequests: prev.intercityRequests.map((ic) =>
                ic.id === payload.intercityId
                  ? {
                      ...ic,
                      driverLivePos: payload.pos,
                      driverTrail: payload.trail ?? ic.driverTrail,
                    }
                  : ic
              ),
            };
          });
        }
        return;
      }

      if (msg.event === 'ride.status.changed' || msg.event === 'bid.accepted') {
        const payload = msg.payload as { rideId?: string; ride?: Ride };
        if (payload?.ride) {
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              rides: prev.rides.map((r) => (r.id === payload.ride!.id ? payload.ride! : r)),
            };
          });
          return;
        }
      }

      fetchBootstrap();
    });

    return () => {
      unsubscribe();
    };
  }, [fetchBootstrap]);

  // Rôle de la session (lu côté serveur via /auth/me : le jeton reste httpOnly).
  useEffect(() => {
    let cancelled = false;
    apiRequest<{ authenticated: boolean; user: { role: 'client' | 'driver' | 'admin' } | null }>('/api/v1/auth/me')
      .then((me) => {
        if (!cancelled) setSessionRole(me.authenticated && me.user ? me.user.role : null);
      })
      .catch(() => {
        if (!cancelled) setSessionRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Un utilisateur non-admin ne peut pas rester dans l'espace Administration.
  useEffect(() => {
    if (workspace === 'admin' && sessionRole !== 'admin') setWorkspace('client');
  }, [workspace, sessionRole]);

  const t = TEXTS[locale];

  // Écran d'accueil : choix du rôle au premier lancement.
  if (!roleSelected) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <div className="flex justify-end p-4">
          <button type="button" onClick={() => setLocale((l) => (l === 'fr' ? 'ar' : 'fr'))}
            className="h-9 px-3 rounded-md bg-brand-700 text-white text-xs font-semibold">
            {locale === 'fr' ? 'العربية' : 'Français'}
          </button>
        </div>
        <RoleSelection
          locale={locale}
          onChoose={(role) => {
            window.localStorage.setItem('camio_role', role);
            setRoleSelected(role);
            setWorkspace(role);
          }}
        />
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen flex flex-col pb-[72px] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-t-[3px] border-t-brand-700 dark:border-t-brand-500 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-8">
          {/* Zone 1: Brand mark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setWorkspace('client');
            }}
            className="flex items-center whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400 rounded"
            aria-label={t.brand}
          >
            <CamioLogo className="h-7 sm:h-[38px]" />
          </a>

          {/* Zone 2: réservée à l'espacement — la navigation est passée en barre inférieure */}
          <div className="flex-1" />

          {/* Zone 3: Theme Switcher + FR / AR RTL toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              data-testid="theme-toggle-button"
              onClick={handleToggleTheme}
              aria-pressed={isDark}
              aria-label={
                locale === 'ar'
                  ? isDark
                    ? 'تفعيل الوضع النهاري'
                    : 'تفعيل الوضع الليلي'
                  : isDark
                  ? 'Activer le mode clair'
                  : 'Activer le mode sombre'
              }
              title={
                locale === 'ar'
                  ? isDark
                    ? 'الوضع النهاري'
                    : 'الوضع الليلي'
                  : isDark
                  ? 'Mode clair'
                  : 'Mode sombre'
              }
              className="h-8 sm:h-9 px-2 sm:px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-brand-300 hover:bg-brand-50/60 dark:hover:bg-slate-700 text-[11px] sm:text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-brand-700 shrink-0" />
              )}
              <span className="hidden md:inline">
                {locale === 'ar'
                  ? isDark
                    ? 'نهاري'
                    : 'ليلي'
                  : isDark
                  ? 'Clair'
                  : 'Sombre'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLocale((l) => (l === 'fr' ? 'ar' : 'fr'))}
              className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-md bg-brand-700 dark:bg-brand-600 text-white text-[11px] sm:text-xs font-semibold hover:bg-brand-800 dark:hover:bg-brand-500 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              {locale === 'fr' ? 'العربية' : 'Français'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {loadError && (
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200 text-sm mb-6">
            {loadError}
          </div>
        )}

        {!data ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 space-y-4">
            <div className="h-6 w-56 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-32 w-full bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
          </div>
        ) : (
          <>
            {workspace === 'client' && (
              <ClientWorkspace
                locale={locale}
                theme={theme}
                wilayas={data.wilayas}
                routeMatrix={data.routeMatrix}
                pricingRules={data.pricingRules}
                settings={data.settings}
                drivers={data.drivers}
                rides={data.rides}
                intercityRequests={data.intercityRequests}
                chats={data.chats}
                reviews={data.reviews}
                favorites={data.favorites}
                routeTemplates={data.routeTemplates}
                disputes={data.disputes}
                onRefresh={fetchBootstrap}
              />
            )}

            {workspace === 'driver' && (
              <DriverWorkspace
                locale={locale}
                theme={theme}
                onToggleTheme={handleToggleTheme}
                wilayas={data.wilayas}
                settings={data.settings}
                drivers={data.drivers}
                rides={data.rides}
                intercityRequests={data.intercityRequests}
                emptyReturns={data.emptyReturns}
                payments={data.payments}
                vouchers={data.vouchers}
                chats={data.chats}
                reviews={data.reviews}
                onRefresh={fetchBootstrap}
              />
            )}

            {workspace === 'admin' && (
              <AdminWorkspace
                locale={locale}
                theme={theme}
                wilayas={data.wilayas}
                routeMatrix={data.routeMatrix}
                settings={data.settings}
                drivers={data.drivers}
                rides={data.rides}
                intercityRequests={data.intercityRequests}
                emptyReturns={data.emptyReturns}
                payments={data.payments}
                vouchers={data.vouchers}
                disputes={data.disputes}
                auditLogs={data.auditLogs}
                onRefresh={fetchBootstrap}
              />
            )}

            {workspace === 'help' && (
              <HelpCenter
                locale={locale}
                settings={data.settings}
                onNavigateWorkspace={(target) => setWorkspace(target)}
              />
            )}
          </>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            <strong className="font-bold text-brand-700 dark:text-brand-300">{t.brand}</strong> ·{' '}
            {locale === 'ar' ? 'منصة النقل والخدمات اللوجستية في الجزائر' : 'Plateforme logistique Algérie · 0 % commission'}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <span>
              {locale === 'ar' ? 'دفع نقدي مباشر · اشتراك شهري للسائقين' : 'Paiement cash direct · Abonnement chauffeur 1 000 DA/mois'}
            </span>
            <button
              type="button"
              onClick={() => setWorkspace('help')}
              className="font-semibold text-brand-700 dark:text-brand-300 hover:text-orange-600 dark:hover:text-orange-400 underline underline-offset-2"
            >
              {t.navHelp}
            </button>
          </div>
        </div>
      </footer>

      {/* Barre de navigation inférieure — Espaces plateforme */}
      <nav
        aria-label="Espaces plateforme"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-[0_-2px_12px_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom)]"
      >
        <div
          className="max-w-7xl mx-auto grid"
          style={{ gridTemplateColumns: `repeat(${sessionRole === 'admin' ? 4 : 3}, minmax(0, 1fr))` }}
        >
          {(
            [
              { id: 'client', full: t.navClient, short: locale === 'ar' ? 'الزبون' : 'Client', Icon: User },
              { id: 'driver', full: t.navDriver, short: locale === 'ar' ? 'السائق' : 'Chauffeur', Icon: Truck },
              { id: 'admin', full: t.navAdmin, short: locale === 'ar' ? 'الإدارة' : 'Admin', Icon: LayoutDashboard },
              { id: 'help', full: t.navHelp, short: locale === 'ar' ? 'مساعدة' : 'Aide', Icon: CircleHelp },
            ] as const)
            .filter((nav) => nav.id !== 'admin' || sessionRole === 'admin')
            .map((nav) => {
            const active = workspace === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => setWorkspace(nav.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 min-h-[64px] border-t-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400 ${
                  active
                    ? 'border-orange-500 text-brand-700 dark:text-brand-300 bg-brand-50/70 dark:bg-brand-950/30'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-brand-700 dark:hover:text-brand-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <nav.Icon className={`w-5 h-5 shrink-0 ${active ? 'text-orange-500' : ''}`} />
                <span className="text-[10px] sm:text-xs font-semibold leading-none whitespace-nowrap">
                  <span className="sm:hidden">{nav.short}</span>
                  <span className="hidden sm:inline">{nav.full}</span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Real-time WebSocket Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        locale={locale}
        onDismiss={handleDismissToast}
        onNavigateWorkspace={(target) => setWorkspace(target)}
      />
    </div>
  );
}
