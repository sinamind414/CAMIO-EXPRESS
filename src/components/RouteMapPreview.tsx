import { MapPin, Navigation, Truck } from 'lucide-react';
import type { ThemeMode } from '../domain/theme';
import type { Locale, RideLocation } from '../domain/types';

interface RouteMapPreviewProps {
  pickup: RideLocation;
  dropoff: RideLocation | null;
  driverPos?: { lat: number; lng: number; speedKmh?: number } | null;
  distanceKm: number;
  isWasteRemoval?: boolean;
  locale: Locale;
  theme?: ThemeMode;
}

export function RouteMapPreview({
  pickup,
  dropoff,
  driverPos,
  distanceKm,
  isWasteRemoval,
  locale,
  theme = 'light',
}: RouteMapPreviewProps) {
  const isAr = locale === 'ar';
  const isDark = theme === 'dark';

  // Project lat/lng into a normalized 0..100 SVG box
  const points = [
    { lat: pickup.lat, lng: pickup.lng },
    ...(dropoff ? [{ lat: dropoff.lat, lng: dropoff.lng }] : []),
    ...(driverPos ? [{ lat: driverPos.lat, lng: driverPos.lng }] : []),
  ];

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats) - 0.012;
  const maxLat = Math.max(...lats) + 0.012;
  const minLng = Math.min(...lngs) - 0.015;
  const maxLng = Math.max(...lngs) + 0.015;

  const project = (lat: number, lng: number) => {
    const x = 18 + ((lng - minLng) / Math.max(0.001, maxLng - minLng)) * 64;
    const y = 80 - ((lat - minLat) / Math.max(0.001, maxLat - minLat)) * 60;
    return { x, y };
  };

  const p1 = project(pickup.lat, pickup.lng);
  const p2 = dropoff ? project(dropoff.lat, dropoff.lng) : { x: 82, y: 26 };
  const drv = driverPos ? project(driverPos.lat, driverPos.lng) : null;

  return (
    <div className="relative w-full h-56 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 overflow-hidden select-none">
      {/* Subtle Algerian road-grid vector backdrop */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke={isDark ? '#241c38' : '#e5dfef'} strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={isDark ? '#120c22' : '#f9f8fc'} />
        <rect width="100" height="100" fill="url(#grid)" />

        {/* Decorative arterial roads */}
        <path d="M 0 65 Q 35 55 100 72" fill="none" stroke={isDark ? '#261c3d' : '#e5dfef'} strokeWidth="2.2" />
        <path d="M 28 0 Q 32 50 22 100" fill="none" stroke={isDark ? '#261c3d' : '#e5dfef'} strokeWidth="1.8" />
        <path d="M 0 28 Q 55 34 100 18" fill="none" stroke={isDark ? '#261c3d' : '#e5dfef'} strokeWidth="1.6" />

        {/* Active route path */}
        <path
          d={`M ${p1.x} ${p1.y} Q ${(p1.x + p2.x) / 2} ${Math.min(p1.y, p2.y) - 10} ${p2.x} ${p2.y}`}
          fill="none"
          stroke={dropoff ? '#fe5601' : isDark ? '#7a6899' : '#9c8db8'}
          strokeWidth="1.6"
          strokeDasharray={dropoff ? '3 1.5' : '2 2'}
        />
      </svg>

      {/* Pickup pin */}
      <div
        style={{ left: `${p1.x}%`, top: `${p1.y}%` }}
        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
      >
        <div className="w-7 h-7 rounded-md bg-brand-700 dark:bg-brand-500 text-white flex items-center justify-center shadow-sm">
          <MapPin className="w-4 h-4" />
        </div>
        <span className="mt-1 px-1.5 py-0.5 rounded bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap shadow-xs">
          {isAr ? 'الانطلاق' : 'Départ'}
        </span>
      </div>

      {/* Dropoff pin */}
      <div
        style={{ left: `${p2.x}%`, top: `${p2.y}%` }}
        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
      >
        <div
          className={`w-7 h-7 rounded-md flex items-center justify-center shadow-sm ${
            dropoff ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white'
          }`}
        >
          <Navigation className="w-4 h-4" />
        </div>
        <span className="mt-1 px-1.5 py-0.5 rounded bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap shadow-xs">
          {dropoff
            ? isAr
              ? 'الوصول'
              : 'Arrivée'
            : isWasteRemoval
            ? isAr
              ? 'المفرغة'
              : 'Décharge'
            : '—'}
        </span>
      </div>

      {/* Live Driver truck marker */}
      {drv && (
        <div
          style={{ left: `${drv.x}%`, top: `${drv.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500 flex flex-col items-center"
        >
          <div className="w-8 h-8 rounded-md bg-orange-500 text-white border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-md">
            <Truck className="w-4 h-4" />
          </div>
          {driverPos?.speedKmh != null && (
            <span className="mt-0.5 px-1.5 py-0.5 rounded bg-brand-900 dark:bg-brand-800 border border-brand-700 text-white text-[10px] font-mono tabular-nums whitespace-nowrap">
              {driverPos.speedKmh} km/h
            </span>
          )}
        </div>
      )}

      {/* Map legend / distance strip */}
      <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between gap-3 px-3 py-1.5 rounded-md bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
        <span className="truncate font-medium">
          {pickup.address}
          {dropoff ? ` → ${dropoff.address}` : ''}
        </span>
        <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 shrink-0">
          {distanceKm.toFixed(1)} km
        </span>
      </div>
    </div>
  );
}
