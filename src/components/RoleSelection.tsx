import clientDark from '../assets/icons/entry/client-dark.jpg';
import clientLight from '../assets/icons/entry/client-light.jpg';
import driverDark from '../assets/icons/entry/driver-dark.jpg';
import driverLight from '../assets/icons/entry/driver-light.jpg';
import type { ThemeMode } from '../domain/theme';
import type { Locale } from '../domain/types';

interface Props {
  locale: Locale;
  theme: ThemeMode;
  onChoose: (role: 'client' | 'driver') => void;
}

/**
 * Écran d'accueil « Qui êtes-vous ? » — inspiré du role_selection de CAMIO.
 * L'illustration suit le thème actif : fond clair en mode clair, fond sombre en
 * mode sombre. Client = personne avec colis, Chauffeur = camion.
 */
export function RoleSelection({ locale, theme, onChoose }: Props) {
  const isAr = locale === 'ar';
  const isDark = theme === 'dark';

  const roles = [
    {
      key: 'client' as const,
      image: isDark ? clientDark : clientLight,
      title: isAr ? 'أنا زبون' : 'Je suis client',
      subtitle: isAr ? 'أطلب خدمة نقل في 3 خطوات' : 'Demander un service en 3 étapes',
      cta: isAr ? 'ابدأ الطلب' : 'Commencer',
    },
    {
      key: 'driver' as const,
      image: isDark ? driverDark : driverLight,
      title: isAr ? 'أنا سائق' : 'Je suis chauffeur',
      subtitle: isAr ? 'انضم واستقبل الطلبات' : 'Rejoindre et recevoir des courses',
      cta: isAr ? 'ابدأ القيادة' : 'Rejoindre',
    },
  ];

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-8 px-4" data-testid="role-selection">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          {isAr ? 'مرحباً بكم في MOVEDZ' : 'Bienvenue sur MOVEDZ'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isAr ? 'منصة النقل والخدمات اللوجستية في الجزائر' : 'La plateforme logistique d’Algérie · 0 % commission'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
        {roles.map((role) => (
          <button
            key={role.key}
            type="button"
            onClick={() => onChoose(role.key)}
            data-testid={`role-${role.key}`}
            className="group overflow-hidden rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-orange-500 hover:shadow-xl transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            {/* Illustration — suit le thème actif (fond clair / fond sombre) */}
            <div className="aspect-[4/3] w-full overflow-hidden bg-white dark:bg-[#0d0b1f]">
              <img
                src={role.image}
                alt={role.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                draggable={false}
              />
            </div>
            <div className="p-5 space-y-2">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {role.title}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {role.subtitle}
              </div>
              <div className="inline-flex items-center gap-1 pt-1 text-sm font-bold text-orange-600 dark:text-orange-500">
                {role.cta}
                <span aria-hidden="true">{isAr ? '←' : '→'}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        {isAr ? 'يمكنك تغيير الدور في أي وقت من القائمة السفلية' : 'Vous pourrez changer de rôle à tout moment depuis la barre inférieure'}
      </p>
    </div>
  );
}
