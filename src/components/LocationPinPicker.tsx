import { useState } from 'react';
import { Crosshair, MapPin } from 'lucide-react';
import type { Locale } from '../domain/types';

interface Props {
  label: string;
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  locale: Locale;
  accent?: 'orange' | 'brand';
}

/**
 * Mini-carte interactive : un clic épingle le point exact (remplace le décalage
 * fictif). Calqué sur le comportement `location` + `placeId` de Lalamove.
 * La projection reste locale (pas de tuiles externes) mais les coordonnées
 * renvoyées sont de vraies lat/lng exploitables par le chauffeur.
 */
export function LocationPinPicker({ label, lat, lng, onChange, locale, accent = 'orange' }: Props) {
  const [pin, setPin] = useState({ lat, lng });
  const isAr = locale === 'ar';
  const color = accent === 'orange' ? '#fe5601' : '#4c1d95';

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;   // 0..1
    const ry = (e.clientY - rect.top) / rect.height;   // 0..1
    // Fenêtre autour du point initial (~±0.02° ≈ 2 km) : l'utilisateur affine.
    const nextLat = lat + (0.5 - ry) * 0.04;
    const nextLng = lng + (rx - 0.5) * 0.05;
    setPin({ lat: nextLat, lng: nextLng });
    onChange(Number(nextLat.toFixed(6)), Number(nextLng.toFixed(6)));
  };

  const pinX = 50 + ((pin.lng - lng) / 0.05) * 100;
  const pinY = 50 - ((pin.lat - lat) / 0.04) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" style={{ color }} />
          {label}
        </span>
        <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
          {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
        </span>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={isAr ? 'انقر لتحديد الموقع بدقة' : 'Cliquer pour épingler le point exact'}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { setPin({ lat, lng }); onChange(lat, lng); }
        }}
        className="relative w-full h-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 overflow-hidden cursor-crosshair select-none"
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full pointer-events-none">
          <defs>
            <pattern id={`pin-grid-${accent}`} width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#d9d2e6" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="#f7f5fb" />
          <rect width="100" height="100" fill={`url(#pin-grid-${accent})`} />
          <path d="M 0 55 Q 50 45 100 60" fill="none" stroke="#e0d9ec" strokeWidth="2" />
          <path d="M 45 0 Q 50 50 40 100" fill="none" stroke="#e0d9ec" strokeWidth="1.6" />
          {/* cible */}
          <circle cx="50" cy="50" r="18" fill="none" stroke={color} strokeWidth="0.6" opacity="0.25" />
        </svg>
        {/* épingle positionnée à l'endroit cliqué */}
        <div
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none transition-all"
          style={{ left: `${Math.max(4, Math.min(96, pinX))}%`, top: `${Math.max(8, Math.min(96, pinY))}%` }}
        >
          <MapPin className="w-7 h-7 drop-shadow" style={{ color }} fill={color} stroke="white" strokeWidth={1.2} />
        </div>
        <div className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/85 dark:bg-slate-900/85 text-slate-600 dark:text-slate-300 pointer-events-none">
          <Crosshair className="w-3 h-3" />
          {isAr ? 'اضغط لتحديد النقطة' : 'Clic pour épingler'}
        </div>
      </div>
    </div>
  );
}
