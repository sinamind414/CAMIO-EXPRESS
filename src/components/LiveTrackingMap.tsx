import { LocateFixed, MapPin, Navigation, Route, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { wsClient, type WsConnectionStatus } from '../api/wsClient';
import { formatTimeDz } from '../domain/i18n';
import {
  appendTrailPoint,
  computeIntercityLiveTelemetry,
  computeLiveTripTelemetry,
  computeMapBounds,
  findCorridorWilayas,
  formatEtaDuration,
  projectLatLng,
  resolveIntercityEndpoints,
  type TrailPoint,
} from '../domain/tracking';
import type { ThemeMode } from '../domain/theme';
import type { IntercityRequest, Locale, Ride, Wilaya } from '../domain/types';

interface LiveTrackingMapProps {
  ride?: Ride;
  intercity?: IntercityRequest;
  wilayas?: Wilaya[];
  locale: Locale;
  theme?: ThemeMode;
  compact?: boolean;
}

interface DriverPositionPayload {
  rideId?: string;
  intercityId?: string;
  pos: {
    lat: number;
    lng: number;
    heading: number;
    speedKmh: number;
    ts: string;
  };
  trail?: TrailPoint[];
}

export function LiveTrackingMap({
  ride,
  intercity,
  wilayas = [],
  locale,
  theme = 'light',
  compact = false,
}: LiveTrackingMapProps) {
  const isAr = locale === 'ar';
  const isDark = theme === 'dark';
  const isIntercity = Boolean(intercity);

  const entityId = intercity?.id ?? ride?.id ?? 'unknown';
  const initialLivePos = intercity ? intercity.driverLivePos ?? null : ride?.driverLivePos ?? null;
  const initialTrail = intercity ? intercity.driverTrail : ride?.driverTrail;

  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>(() => wsClient.getStatus());
  const [livePos, setLivePos] = useState(initialLivePos);
  const [trail, setTrail] = useState<TrailPoint[]>(() => {
    if (initialTrail && initialTrail.length > 0) return initialTrail;
    return initialLivePos
      ? [{ lat: initialLivePos.lat, lng: initialLivePos.lng, ts: initialLivePos.ts }]
      : [];
  });
  const [showTrail, setShowTrail] = useState(true);
  const [focusVehicle, setFocusVehicle] = useState(false);
  const [wsUpdatesCount, setWsUpdatesCount] = useState(0);

  // Sync when switching selected trip or receiving fresh state
  useEffect(() => {
    setLivePos(initialLivePos);
    if (initialTrail && initialTrail.length > 0) {
      setTrail(initialTrail);
    } else if (initialLivePos) {
      setTrail((prev) =>
        appendTrailPoint(prev, {
          lat: initialLivePos.lat,
          lng: initialLivePos.lng,
          ts: initialLivePos.ts,
        })
      );
    } else {
      setTrail([]);
    }
  }, [entityId, initialLivePos, initialTrail]);

  // Direct WebSocket listener for real-time vehicle GPS coordinates
  useEffect(() => {
    const unsubStatus = wsClient.subscribeStatus(setWsStatus);
    const unsubEvents = wsClient.subscribeEvents((envelope) => {
      if (isIntercity && intercity && envelope.event === 'intercity.position') {
        const data = envelope.payload as DriverPositionPayload;
        if (data?.intercityId === intercity.id && data.pos) {
          setLivePos(data.pos);
          setWsUpdatesCount((c) => c + 1);
          setTrail((prev) =>
            data.trail && data.trail.length > 0
              ? data.trail
              : appendTrailPoint(prev, {
                  lat: data.pos.lat,
                  lng: data.pos.lng,
                  ts: data.pos.ts,
                })
          );
        }
      } else if (!isIntercity && ride && envelope.event === 'driver.position') {
        const data = envelope.payload as DriverPositionPayload;
        if (data?.rideId === ride.id && data.pos) {
          setLivePos(data.pos);
          setWsUpdatesCount((c) => c + 1);
          setTrail((prev) =>
            data.trail && data.trail.length > 0
              ? data.trail
              : appendTrailPoint(prev, {
                  lat: data.pos.lat,
                  lng: data.pos.lng,
                  ts: data.pos.ts,
                })
          );
        }
      }
    });

    return () => {
      unsubStatus();
      unsubEvents();
    };
  }, [isIntercity, intercity?.id, ride?.id]);

  const icEndpoints = useMemo(
    () => (intercity ? resolveIntercityEndpoints(intercity, wilayas) : null),
    [intercity, wilayas]
  );

  const corridorWilayas = useMemo(
    () =>
      intercity ? findCorridorWilayas(intercity.fromWilaya, intercity.toWilaya, wilayas) : [],
    [intercity, wilayas]
  );

  const pickup = icEndpoints?.pickup ?? ride?.pickup ?? { address: '—', lat: 35.6971, lng: -0.6308 };
  const dropoff = icEndpoints?.dropoff ?? ride?.dropoff ?? null;
  const distanceKm = intercity?.distanceKm ?? ride?.distanceKm ?? 0;
  const driverName = intercity?.driverName ?? ride?.driverName;

  const telemetry = useMemo(() => {
    if (intercity && icEndpoints) {
      return computeIntercityLiveTelemetry({
        status: intercity.status,
        pickup: icEndpoints.pickup,
        dropoff: icEndpoints.dropoff,
        driverPos: livePos,
        routeDistanceKm: intercity.distanceKm,
      });
    }
    return computeLiveTripTelemetry({
      status: ride?.status ?? 'assigned',
      pickup,
      dropoff,
      driverPos: livePos,
      routeDistanceKm: distanceKm,
    });
  }, [intercity, icEndpoints, ride?.status, pickup, dropoff, livePos, distanceKm]);

  const bounds = useMemo(() => {
    const headingToDropoff = intercity
      ? intercity.status === 'in_progress'
      : ride?.status === 'in_transit';

    if (focusVehicle && livePos) {
      const target = headingToDropoff && dropoff ? dropoff : pickup;
      return computeMapBounds(
        [
          { lat: livePos.lat, lng: livePos.lng },
          { lat: target.lat, lng: target.lng },
        ],
        0.35
      );
    }

    const pts = [
      { lat: pickup.lat, lng: pickup.lng },
      ...(dropoff ? [{ lat: dropoff.lat, lng: dropoff.lng }] : []),
      ...corridorWilayas.map((w) => ({ lat: w.lat, lng: w.lng })),
      ...(livePos ? [{ lat: livePos.lat, lng: livePos.lng }] : []),
      ...trail.map((p) => ({ lat: p.lat, lng: p.lng })),
    ];
    return computeMapBounds(pts, isIntercity ? 0.22 : 0.25);
  }, [
    focusVehicle,
    livePos,
    intercity,
    ride?.status,
    pickup,
    dropoff,
    corridorWilayas,
    trail,
    isIntercity,
  ]);

  if (!ride && !intercity) return null;

  const p1 = projectLatLng(pickup, bounds);
  const p2 = dropoff ? projectLatLng(dropoff, bounds) : { x: 82, y: 26 };
  const drv = livePos ? projectLatLng(livePos, bounds) : null;
  const trailProjected = trail.map((pt) => projectLatLng(pt, bounds));
  const polylinePoints = trailProjected.map((pt) => `${pt.x},${pt.y}`).join(' ');

  const activeLineTarget =
    (intercity ? intercity.status === 'in_progress' : ride?.status === 'in_transit') ? p2 : p1;

  const phaseTitle = (() => {
    if (intercity && icEndpoints) {
      const fromName = isAr
        ? icEndpoints.fromWilaya?.nameAr ?? pickup.address
        : icEndpoints.fromWilaya?.nameFr ?? pickup.address;
      const toName = isAr
        ? icEndpoints.toWilaya?.nameAr ?? dropoff?.address ?? ''
        : icEndpoints.toWilaya?.nameFr ?? dropoff?.address ?? '';
      if (telemetry.phase === 'at_pickup') {
        return isAr
          ? `في نقطة الانطلاق · ${fromName}`
          : `Véhicule réservé au départ · ${fromName}`;
      }
      if (telemetry.phase === 'to_dropoff') {
        return isAr
          ? `على المحور الوطني نحو ${toName}`
          : `En transit inter-wilaya vers ${toName}`;
      }
      return isAr
        ? `وصلت الشاحنة إلى ${toName}`
        : `Livraison arrivée à ${toName}`;
    }

    if (telemetry.phase === 'to_pickup') {
      return isAr ? 'السائق متجه نحو نقطة الانطلاق' : 'En route vers le point de départ';
    }
    if (telemetry.phase === 'at_pickup') {
      return ride?.status === 'loading'
        ? isAr
          ? 'الشاحنة في الموقع · جاري الشحن'
          : 'Véhicule sur place · Chargement en cours'
        : isAr
        ? 'وصل السائق إلى نقطة الانطلاق'
        : 'Chauffeur arrivé au point de départ';
    }
    if (telemetry.phase === 'to_dropoff') {
      return isAr ? 'في الطريق إلى الوجهة' : 'En transit vers la destination';
    }
    return isAr ? 'وصلت الشاحنة إلى الوجهة' : 'Véhicule arrivé à destination';
  })();

  const fromLabel =
    isIntercity && icEndpoints?.fromWilaya
      ? `${isAr ? icEndpoints.fromWilaya.nameAr : icEndpoints.fromWilaya.nameFr} (${icEndpoints.fromWilaya.code})`
      : isAr
      ? 'الانطلاق'
      : 'Départ';

  const toLabel =
    isIntercity && icEndpoints?.toWilaya
      ? `${isAr ? icEndpoints.toWilaya.nameAr : icEndpoints.toWilaya.nameFr} (${icEndpoints.toWilaya.code})`
      : dropoff
      ? isAr
        ? 'الوصول'
        : 'Arrivée'
      : ride?.serviceType === 'waste_removal'
      ? isAr
        ? 'المفرغة'
        : 'Décharge'
      : '—';

  const etaDisplay = formatEtaDuration(telemetry.etaMinutes, locale);

  return (
    <div
      data-testid={isIntercity ? 'intercity-live-tracking-map' : 'live-tracking-map'}
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
    >
      {/* Live WebSocket Telemetry Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <span
            aria-hidden="true"
            className={`w-2 h-2 rounded-full shrink-0 ${
              wsStatus === 'connected'
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-amber-500'
            }`}
          />
          <span>
            {wsStatus === 'connected'
              ? isIntercity
                ? isAr
                  ? 'تتبع مباشر بين الولايات · WebSocket'
                  : 'Suivi GPS inter-wilaya · WebSocket'
                : isAr
                ? 'تتبع مباشر عبر WebSocket'
                : 'Suivi GPS temps réel · WebSocket'
              : isAr
              ? 'إعادة الاتصال بالبث المباشر...'
              : 'Reconnexion WebSocket...'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300 font-mono tabular-nums">
          {livePos && (
            <>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{livePos.speedKmh} km/h</span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
            </>
          )}
          {telemetry.remainingKm > 0 && (
            <>
              <span>
                {isIntercity ? Math.round(telemetry.remainingKm) : telemetry.remainingKm.toFixed(1)} km{' '}
                {isAr ? 'متبقية' : 'restants'}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span className="font-semibold text-orange-700 dark:text-orange-400">
                ETA {etaDisplay}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
            </>
          )}
          <span>
            {livePos?.ts
              ? `${isAr ? 'تحديث' : 'MàJ'} ${formatTimeDz(livePos.ts, locale)}`
              : '—'}
          </span>
          {wsUpdatesCount > 0 && (
            <>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span className="text-emerald-700 dark:text-emerald-400">
                {wsUpdatesCount} {isAr ? 'إشارة' : 'paquet(s) WS'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Interactive Map Canvas */}
      <div
        className={`relative w-full ${
          compact ? 'h-56' : 'h-64 sm:h-72'
        } bg-slate-100 dark:bg-slate-950 overflow-hidden select-none`}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <pattern id={`live-grid-${entityId}`} width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke={isDark ? '#241c38' : '#e5dfef'}
                strokeWidth="0.4"
              />
            </pattern>
          </defs>
          <rect width="100" height="100" fill={isDark ? '#120c22' : '#f9f8fc'} />
          <rect width="100" height="100" fill={`url(#live-grid-${entityId})`} />

          {/* Road / highway arterial backdrop */}
          <path d="M 0 68 Q 38 56 100 74" fill="none" stroke={isDark ? '#261c3d' : '#e5dfef'} strokeWidth="2.2" />
          <path d="M 26 0 Q 34 52 20 100" fill="none" stroke={isDark ? '#261c3d' : '#e5dfef'} strokeWidth="1.8" />
          <path d="M 0 26 Q 58 34 100 16" fill="none" stroke={isDark ? '#261c3d' : '#e5dfef'} strokeWidth="1.6" />
          <path d="M 65 0 Q 72 45 78 100" fill="none" stroke={isDark ? '#261c3d' : '#e5dfef'} strokeWidth="1.5" />

          {/* Planned route corridor */}
          <path
            d={`M ${p1.x} ${p1.y} Q ${(p1.x + p2.x) / 2} ${Math.min(p1.y, p2.y) - 10} ${p2.x} ${p2.y}`}
            fill="none"
            stroke={isDark ? '#5a4a78' : '#c6b9db'}
            strokeWidth="1.5"
            strokeDasharray="2.5 2"
          />

          {/* Active line from vehicle to active target */}
          {drv && (
            <line
              x1={drv.x}
              y1={drv.y}
              x2={activeLineTarget.x}
              y2={activeLineTarget.y}
              stroke="#fe5601"
              strokeWidth="1.3"
              strokeDasharray="2 1.5"
              opacity="0.85"
            />
          )}

          {/* Live GPS trail polyline */}
          {showTrail && trailProjected.length > 1 && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={isDark ? '#bc84ff' : '#530391'}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {/* Map Controls */}
        <div className="absolute top-2.5 end-2.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowTrail((v) => !v)}
            className={`px-2.5 py-1.5 rounded-md border text-[11px] font-medium shadow-xs transition-colors inline-flex items-center gap-1 ${
              showTrail
                ? 'bg-brand-700 dark:bg-brand-600 text-white border-brand-700 dark:border-brand-600'
                : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            <Route className="w-3 h-3" />
            <span>{isAr ? 'المسار' : 'Tracé GPS'}</span>
          </button>

          {livePos && (
            <button
              type="button"
              onClick={() => setFocusVehicle((v) => !v)}
              className={`px-2.5 py-1.5 rounded-md border text-[11px] font-medium shadow-xs transition-colors inline-flex items-center gap-1 ${
                focusVehicle
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              <LocateFixed className="w-3 h-3" />
              <span>
                {focusVehicle
                  ? isAr
                    ? 'كل المسار'
                    : 'Vue globale'
                  : isAr
                  ? 'تتبع الشاحنة'
                  : 'Centrer véhicule'}
              </span>
            </button>
          )}
        </div>

        {/* Intermediate Corridor Wilayas (Intercity Highway Relays) */}
        {isIntercity &&
          !focusVehicle &&
          corridorWilayas.map((w) => {
            const wp = projectLatLng(w, bounds);
            return (
              <div
                key={w.code}
                style={{ left: `${wp.x}%`, top: `${wp.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-500 shadow-xs" />
                <span className="mt-0.5 px-1 py-0.5 rounded bg-white/85 dark:bg-slate-900/85 text-[10px] text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                  {isAr ? w.nameAr : w.nameFr}
                </span>
              </div>
            );
          })}

        {/* Pickup / Origin Marker */}
        <div
          style={{ left: `${p1.x}%`, top: `${p1.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
        >
          <div className="w-7 h-7 rounded-md bg-brand-700 dark:bg-brand-500 text-white flex items-center justify-center shadow-sm">
            <MapPin className="w-4 h-4" />
          </div>
          <span className="mt-1 px-1.5 py-0.5 rounded bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap shadow-xs">
            {fromLabel}
          </span>
        </div>

        {/* Dropoff / Destination Marker */}
        <div
          style={{ left: `${p2.x}%`, top: `${p2.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
        >
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center shadow-sm ${
              dropoff ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white'
            }`}
          >
            <Navigation className="w-4 h-4" />
          </div>
          <span className="mt-1 px-1.5 py-0.5 rounded bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap shadow-xs">
            {toLabel}
          </span>
        </div>

        {/* Live Vehicle Marker */}
        {drv && livePos && (
          <div
            data-testid="live-vehicle-marker"
            data-lat={livePos.lat}
            data-lng={livePos.lng}
            style={{ left: `${drv.x}%`, top: `${drv.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out flex flex-col items-center z-10 pointer-events-none"
          >
            <div className="relative w-9 h-9 rounded-md bg-orange-500 text-white border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-md">
              <Truck className="w-4 h-4" />
              <span
                aria-hidden="true"
                style={{ transform: `rotate(${livePos.heading}deg)` }}
                className="absolute -top-1.5 -end-1.5 w-4 h-4 rounded-full bg-brand-700 text-white text-[9px] flex items-center justify-center shadow-xs"
              >
                ▲
              </span>
            </div>
            <span className="mt-0.5 px-1.5 py-0.5 rounded bg-brand-900 dark:bg-brand-800 border border-brand-700 text-white text-[10px] font-mono tabular-nums whitespace-nowrap shadow-xs">
              {driverName?.split(' ')[0] ?? (isAr ? 'الشاحنة' : 'Camion')} · {livePos.speedKmh} km/h
            </span>
          </div>
        )}

        {/* Bottom Route & Progress Bar */}
        <div className="absolute bottom-2.5 inset-x-2.5 px-3 py-2 rounded-md bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{phaseTitle}</span>
            <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
              {livePos
                ? `${livePos.lat.toFixed(4)}, ${livePos.lng.toFixed(4)}`
                : `${distanceKm.toFixed(1)} km`}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-orange-600 rounded-full transition-all duration-500"
              style={{ width: `${telemetry.progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
