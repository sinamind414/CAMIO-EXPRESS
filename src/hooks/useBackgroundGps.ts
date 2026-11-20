import { useCallback, useEffect, useRef, useState } from 'react';
import { wsClient, type WsConnectionStatus } from '../api/wsClient';
import {
  dequeueGps,
  enqueueGps,
  groupByTarget,
  loadGpsQueue,
  saveGpsQueue,
  type GpsSample,
} from '../domain/gpsQueue';

export type GpsStatus = 'idle' | 'active' | 'queued' | 'offline' | 'denied';

interface Options {
  enabled: boolean;
  target: GpsSample['target'] | null;
  /** Envoi d'un lot. Retourne true si transmis (WS ou REST). */
  sendBatch: (positions: GpsSample[]) => Promise<boolean> | boolean;
  intervalMs?: number;
}

/**
 * Suivi GPS résilient (inspiré de transistorsoft + BACKGROUND_LOCATION de CAMIO).
 * - géolocalisation native du navigateur (watchPosition)
 * - file locale persistante si le réseau tombe
 * - reprise automatique au retour du WebSocket / de la connexion / de l'onglet
 */
export function useBackgroundGps({ enabled, target, sendBatch, intervalMs = 10_000 }: Options) {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [queued, setQueued] = useState(0);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const queueRef = useRef<GpsSample[]>(loadGpsQueue());
  const flushing = useRef(false);
  const enabledRef = useRef(enabled);
  const targetRef = useRef(target);
  const sendRef = useRef(sendBatch);
  enabledRef.current = enabled;
  targetRef.current = target;
  sendRef.current = sendBatch;

  const persist = useCallback(() => {
    saveGpsQueue(queueRef.current);
    setQueued(queueRef.current.length);
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current || queueRef.current.length === 0) return;
    flushing.current = true;
    try {
      while (queueRef.current.length > 0) {
        const { sent, remaining } = dequeueGps(queueRef.current, 20);
        const ok = await sendRef.current(sent);
        if (!ok) {
          queueRef.current = [...sent, ...remaining];
          persist();
          break;
        }
        queueRef.current = remaining;
        persist();
      }
      setStatus((s) => (s === 'queued' ? (navigator.onLine ? 'active' : 'offline') : s));
    } finally {
      flushing.current = false;
    }
  }, [persist]);

  const record = useCallback((lat: number, lng: number, heading?: number, speedKmh?: number) => {
    const t = targetRef.current;
    if (!t || !enabledRef.current) return;
    queueRef.current = enqueueGps(queueRef.current, {
      lat, lng, heading, speedKmh, ts: new Date().toISOString(), target: t,
    });
    persist();
    setLastAt(new Date().toISOString());
    if (navigator.onLine && wsClient.getStatus() === 'connected') void flush();
    else setStatus('queued');
  }, [flush, persist]);

  // 1) Géolocalisation native (temps réel, précision élevée).
  useEffect(() => {
    if (!enabled || !target || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let watchId: number | null = null;
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          record(pos.coords.latitude, pos.coords.longitude, pos.coords.heading ?? undefined, pos.coords.speed ?? undefined);
          setStatus('active');
        },
        () => setStatus('denied'),
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
      );
    } catch {
      setStatus('denied');
    }
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, [enabled, target?.id, target?.kind, record]);

  // 2) Renouvellement périodique (même si watchPosition est throttlé en arrière-plan).
  useEffect(() => {
    if (!enabled || !target) return;
    const timer = window.setInterval(() => {
      if (document.hidden) setStatus((s) => (queueRef.current.length ? 'queued' : s));
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, target?.id, intervalMs]);

  // 3) Reprise automatique : reconnexion WS, retour en ligne, retour de l'onglet.
  useEffect(() => {
    const unsubStatus = wsClient.subscribeStatus((s: WsConnectionStatus) => {
      if (s === 'connected') void flush();
      else if (s === 'reconnecting' && !navigator.onLine) setStatus('offline');
    });
    const onOnline = () => { void flush(); };
    const onOffline = () => setStatus('offline');
    const onVisible = () => { if (!document.hidden) void flush(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubStatus();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [flush]);

  // 4) Tentative initiale au montage (file persistée d'une session précédente).
  useEffect(() => { if (queueRef.current.length) void flush(); }, [flush]);

  return { status, queued, lastAt, record, flush };
}
