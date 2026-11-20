import type { VehicleCategory } from '../domain/types';

/** Logos 3D MOVEDZ officiels (découpés du pack), aucun dessin tiers. */
const ICONS: Record<VehicleCategory, string> = {
  motorcycle: '/src/assets/icons/motor.png',
  tow_truck: '/src/assets/icons/tow_truck.png',
  sedan: '/src/assets/icons/sedan.png',
  mpv: '/src/assets/icons/mpv.png',
  van: '/src/assets/icons/van.png',
  pickup_bak: '/src/assets/icons/pickup_bak.png',
  pickup_box: '/src/assets/icons/pickup_box.png',
  engkel_box: '/src/assets/icons/engkel_box.png',
  engkel_bak: '/src/assets/icons/engkel_bak.png',
  cdd_bak: '/src/assets/icons/cdd_bak.png',
  cdd_box: '/src/assets/icons/cdd_box.png',
  tipper: '/src/assets/icons/engkel_bak.png',
  small_van: '/src/assets/icons/van.png',
  utility_van: '/src/assets/icons/pickup_box.png',
  medium_truck: '/src/assets/icons/engkel_box.png',
  large_truck: '/src/assets/icons/cdd_box.png',
};

interface Props {
  category: VehicleCategory;
  className?: string;
  title?: string;
}

export function VehicleIcon({ category, className = 'w-16 h-12', title }: Props) {
  return (
    <img
      src={ICONS[category] ?? ICONS.van}
      alt={title ?? category}
      aria-label={title ?? category}
      loading="lazy"
      className={`object-contain select-none ${className}`}
    />
  );
}

export default VehicleIcon;
