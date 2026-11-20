import type { DriverProfile, DriverReview, FavoriteDriverEntry } from './types';

export const DEFAULT_CLIENT_ID = 'client-amine';

export function isDriverFavorited(
  favorites: FavoriteDriverEntry[],
  driverId: string,
  clientId: string = DEFAULT_CLIENT_ID
): boolean {
  return favorites.some((f) => f.driverId === driverId && f.clientId === clientId);
}

export function toggleFavoriteDriver(
  favorites: FavoriteDriverEntry[],
  input: {
    driverId: string;
    clientId?: string;
    note?: string;
    nowIso?: string;
  }
): {
  next: FavoriteDriverEntry[];
  added: boolean;
  entry?: FavoriteDriverEntry;
} {
  const clientId = input.clientId ?? DEFAULT_CLIENT_ID;
  const existing = favorites.find(
    (f) => f.driverId === input.driverId && f.clientId === clientId
  );

  if (existing) {
    return {
      next: favorites.filter(
        (f) => !(f.driverId === input.driverId && f.clientId === clientId)
      ),
      added: false,
    };
  }

  const createdAt = input.nowIso ?? new Date().toISOString();
  const cleanNote = input.note?.trim().slice(0, 140);
  const entry: FavoriteDriverEntry = {
    id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    clientId,
    driverId: input.driverId,
    ...(cleanNote ? { note: cleanNote } : {}),
    createdAt,
  };

  return {
    next: [entry, ...favorites],
    added: true,
    entry,
  };
}

export function updateFavoriteNote(
  favorites: FavoriteDriverEntry[],
  input: {
    driverId: string;
    clientId?: string;
    note: string;
  }
): FavoriteDriverEntry[] {
  const clientId = input.clientId ?? DEFAULT_CLIENT_ID;
  const cleanNote = input.note.trim().slice(0, 140);
  return favorites.map((f) =>
    f.driverId === input.driverId && f.clientId === clientId
      ? { ...f, note: cleanNote || undefined }
      : f
  );
}

export interface ResolvedFavoriteDriver {
  favorite: FavoriteDriverEntry;
  driver: DriverProfile;
  verifiedReviewsCount: number;
}

export function resolveFavoriteDrivers(
  favorites: FavoriteDriverEntry[],
  drivers: DriverProfile[],
  reviews: DriverReview[],
  clientId: string = DEFAULT_CLIENT_ID
): ResolvedFavoriteDriver[] {
  const driverMap = new Map(drivers.map((d) => [d.id, d]));
  const reviewCounts = new Map<string, number>();
  for (const r of reviews) {
    reviewCounts.set(r.driverId, (reviewCounts.get(r.driverId) ?? 0) + 1);
  }

  return favorites
    .filter((f) => f.clientId === clientId)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((favorite) => {
      const driver = driverMap.get(favorite.driverId);
      if (!driver) return null;
      return {
        favorite,
        driver,
        verifiedReviewsCount: reviewCounts.get(driver.id) ?? 0,
      };
    })
    .filter((item): item is ResolvedFavoriteDriver => item !== null);
}

export function prioritizeFavoriteItems<T extends { driverId: string }>(
  items: T[],
  favoriteDriverIds: Set<string>
): T[] {
  if (favoriteDriverIds.size === 0 || items.length <= 1) return items;
  const preferred: T[] = [];
  const others: T[] = [];
  for (const item of items) {
    if (favoriteDriverIds.has(item.driverId)) {
      preferred.push(item);
    } else {
      others.push(item);
    }
  }
  return [...preferred, ...others];
}
