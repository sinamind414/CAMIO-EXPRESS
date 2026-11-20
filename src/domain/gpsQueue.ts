/**
 * File d'attente GPS locale — résilience réseau dégradé (CDC v2.1 §13 C3).
 * Les positions non transmises sont conservées localement puis replayées
 * dans l'ordre dès que la connexion revient.
 */

export interface GpsSample {
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
  ts: string;
  target: { kind: 'ride' | 'intercity'; id: string };
}

export const GPS_QUEUE_MAX = 200;

/** Ajoute un échantillon (déduplication des positions identiques consécutives). */
export function enqueueGps(queue: GpsSample[], sample: GpsSample): GpsSample[] {
  const last = queue[queue.length - 1];
  if (
    last &&
    last.target.kind === sample.target.kind &&
    last.target.id === sample.target.id &&
    Math.abs(last.lat - sample.lat) < 1e-6 &&
    Math.abs(last.lng - sample.lng) < 1e-6
  ) {
    return queue;
  }
  const next = [...queue, sample];
  return next.length > GPS_QUEUE_MAX ? next.slice(next.length - GPS_QUEUE_MAX) : next;
}

/** Retire jusqu'à `max` échantillons du début de la file (FIFO). */
export function dequeueGps(queue: GpsSample[], max = 20): { sent: GpsSample[]; remaining: GpsSample[] } {
  return { sent: queue.slice(0, max), remaining: queue.slice(max) };
}

/** Regroupe les échantillons par cible pour un envoi par lot. */
export function groupByTarget(samples: GpsSample[]): Array<{ target: GpsSample['target']; positions: GpsSample[] }> {
  const map = new Map<string, { target: GpsSample['target']; positions: GpsSample[] }>();
  for (const s of samples) {
    const key = `${s.target.kind}:${s.target.id}`;
    const entry = map.get(key) ?? { target: s.target, positions: [] };
    entry.positions.push(s);
    map.set(key, entry);
  }
  return [...map.values()];
}

const STORAGE_KEY = 'camio_gps_queue';

export function loadGpsQueue(): GpsSample[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => s && s.ts && s.target?.id) : [];
  } catch {
    return [];
  }
}

export function saveGpsQueue(queue: GpsSample[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-GPS_QUEUE_MAX)));
  } catch {
    /* quota dépassé : on garde la file en mémoire */
  }
}
