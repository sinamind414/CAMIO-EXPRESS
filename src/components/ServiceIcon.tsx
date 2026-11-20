import type { ServiceType } from '../domain/types';

/** Illustrations 3D MOVEDZ des prestations (fond transparent), une par service. */
const IMAGES: Record<ServiceType, string> = {
  moving: '/src/assets/icons/services/moving.png',
  freight: '/src/assets/icons/services/freight.png',
  waste_removal: '/src/assets/icons/services/waste_removal.png',
  refrigerated: '/src/assets/icons/services/refrigerated.png',
  towing: '/src/assets/icons/services/towing.png',
};

interface Props {
  service: ServiceType;
  className?: string;
  title?: string;
}

export function ServiceIcon({ service, className = 'w-14 h-10', title }: Props) {
  return (
    <img
      src={IMAGES[service]}
      alt={title ?? service}
      aria-label={title ?? service}
      loading="lazy"
      className={`object-contain select-none ${className}`}
    />
  );
}

export default ServiceIcon;
