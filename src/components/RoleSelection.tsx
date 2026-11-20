import { Truck, User } from 'lucide-react';
import type { Locale } from '../domain/types';
import { ServiceIcon } from './ServiceIcon';
import { VehicleIcon } from './VehicleIcon';

interface Props {
  locale: Locale;
  onChoose: (role: 'client' | 'driver') => void;
}

/** Écran d'accueil « Qui êtes-vous ? » — inspiré du role_selection de CAMIO. */
export function RoleSelection({ locale, onChoose }: Props) {
  const isAr = locale === 'ar';
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          {isAr ? 'مرحباً بكم في MOVEDZ' : 'Bienvenue sur MOVEDZ'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isAr ? 'منصة النقل والخدمات اللوجستية في الجزائر' : 'La plateforme logistique d’Algérie · 0 % commission'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        <button type="button" onClick={() => onChoose('client')}
          className="group p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-orange-500 hover:shadow-lg transition-all text-center space-y-4">
          <div className="flex justify-center gap-2">
            <ServiceIcon service="moving" className="w-20 h-16" />
            <User className="w-6 h-6 text-orange-600 self-start" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {isAr ? 'أنا زبون' : 'Je suis client'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isAr ? 'أطلب خدمة نقل في 3 خطوات' : 'Demander un service en 3 étapes'}
            </div>
          </div>
        </button>
        <button type="button" onClick={() => onChoose('driver')}
          className="group p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-orange-500 hover:shadow-lg transition-all text-center space-y-4">
          <div className="flex justify-center gap-2">
            <VehicleIcon category="medium_truck" className="w-24 h-16" />
            <Truck className="w-6 h-6 text-orange-600 self-start" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {isAr ? 'أنا سائق' : 'Je suis chauffeur'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isAr ? 'انضم واستقبل الطلبات' : 'Rejoindre et recevoir des courses'}
            </div>
          </div>
        </button>
      </div>
      <p className="text-[11px] text-slate-400">
        {isAr ? 'يمكنك تغيير الدور في أي وقت من القائمة السفلية' : 'Vous pourrez changer de rôle à tout moment depuis la barre inférieure'}
      </p>
    </div>
  );
}
