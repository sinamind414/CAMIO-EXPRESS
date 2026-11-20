import type { AppSettings, DriverProfile } from './types';
import { computeSubscriptionStatus } from './stateMachine';

/**
 * Modèle de monétisation « visibilité » (CAMIO EXPRESS).
 *
 * Règle n°1 : le chauffeur GRATUIT reste toujours visible et recevable.
 * Le tier Pro paie pour être PREMIER à l'annuaire, jamais pour exister.
 * Le tri du broadcast (CDC C10) est untouched — aucun classement payant.
 */

export type VisibilityTier = 'free' | 'pro' | 'entreprise';

function today(todayStr?: string): string {
  return todayStr ?? new Date().toISOString().slice(0, 10);
}

/**
 * Pro uniquement si abonnement actif, non-trial et période couverte.
 * Le trial est toujours traité comme free. `entreprise` est réservé à une
 * future offre B2B (aucun champ de données ne le porte encore).
 */
export function getDriverTier(driver: DriverProfile, settings: AppSettings, todayStr?: string): VisibilityTier {
  const computed = computeSubscriptionStatus(driver.subscription, today(todayStr));
  if (computed.status !== 'active') return 'free';
  if (driver.subscription.kind === 'trial') return 'free';
  return 'pro';
}

/**
 * Listage dans l'annuaire. Par défaut (`hideUnpaidProfiles: false`),
 * PERSONNE n'est masqué. Le masquage dur est une décision admin future.
 */
export function isDriverListed(driver: DriverProfile, settings: AppSettings, todayStr?: string): boolean {
  if (!settings.hideUnpaidProfiles) return true;
  const computed = computeSubscriptionStatus(driver.subscription, today(todayStr));
  // `grace` reste listé ; seul `expired` (et `cancelled`) disparaît.
  return computed.status !== 'expired' && computed.status !== 'cancelled';
}

/**
 * Éligibilité à recevoir des courses.
 * Le tier gratuit est TOUJOURS recevable — c'est la règle de liquidité.
 * Ce helper remplace les anciens contrôles `canReceiveRides` sur le supply.
 */
export function canDriverReceiveRides(driver: DriverProfile, settings: AppSettings, todayStr?: string): boolean {
  if (driver.status !== 'approved') return false;
  if (settings.freeTierEnabled) return true;
  return computeSubscriptionStatus(driver.subscription, today(todayStr)).canReceiveRides;
}

/**
 * Classement de l'ANNUAIRE / recherche de chauffeurs (jamais du broadcast).
 * 1. masqués exclus, 2. Pro avant Free, 3. mérite : note puis courses.
 */
export function rankDirectory(
  drivers: DriverProfile[],
  settings: AppSettings,
  todayStr?: string
): DriverProfile[] {
  const date = today(todayStr);
  const weight = (d: DriverProfile): number => (getDriverTier(d, settings, date) === 'pro' ? 1 : 0);
  return drivers
    .filter((d) => isDriverListed(d, settings, date))
    .slice()
    .sort((a, b) => {
      const tierDiff = weight(b) - weight(a);
      if (tierDiff !== 0) return tierDiff;
      const ratingDiff = (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.ridesCompleted ?? 0) - (a.ridesCompleted ?? 0);
    });
}
