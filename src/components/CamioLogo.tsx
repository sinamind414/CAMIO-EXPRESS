import { useState } from 'react';

interface CamioLogoProps {
  className?: string;
  height?: number;
}

export function CamioLogo({ className = '', height }: CamioLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="inline-flex items-baseline gap-0.5 font-extrabold tracking-tight select-none font-display text-xl">
        <span className="text-brand-700 dark:text-brand-300">MOVE</span>
        <span className="text-orange-500">DZ</span>
      </span>
    );
  }

  const sizeStyle = height ? { height, width: 'auto' } : { width: 'auto' };
  const baseClass = `object-contain select-none ${className || (height ? '' : 'h-[36px]')}`;

  return (
    <span className="inline-flex items-center shrink-0">
      <img
        src="/assets/movedz-logo-clean.png"
        alt="MOVEDZ"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={sizeStyle}
        className={`block dark:hidden ${baseClass}`}
      />
      <img
        src="/assets/movedz-logo-dark.png"
        alt="MOVEDZ"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={sizeStyle}
        className={`hidden dark:block ${baseClass}`}
      />
    </span>
  );
}
