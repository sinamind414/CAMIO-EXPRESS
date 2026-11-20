import { useEffect, useState } from 'react';
import type { Locale } from '../domain/types';

/**
 * Splash screen animé MOVEDZ — extrait de l'animation fournie
 * (cran_de_d_marrage_anim_movedz.html), sans le studio ni l'accueil.
 *
 * Chorégraphie : roue qui roule (540°) → lapin qui bondit → lettres M V E D Z
 * → shimmer → slogan + barre de progression bicolore (60% violet / 40% orange).
 */
export function SplashScreen({ locale, onDone }: { locale: Locale; onDone: () => void }) {
  const [exiting, setExiting] = useState(false);
  const isAr = locale === 'ar';

  useEffect(() => {
    // 2,6 s d'animation + 0,38 s de sortie.
    const out = window.setTimeout(() => setExiting(true), 2600);
    const done = window.setTimeout(onDone, 3000);
    return () => { window.clearTimeout(out); window.clearTimeout(done); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden bg-white ${exiting ? 'splash-exit' : ''}`}
      role="status"
      aria-label="Chargement MOVEDZ"
      data-testid="movedz-splash"
    >
      <style>{SPLASH_CSS}</style>
      {/* halos d'ambiance */}
      <span className="splash-halo splash-halo-purple" />
      <span className="splash-halo splash-halo-orange" />

      <div className="splash-stage">
        <div className="splash-logo-box">
          <svg className="splash-logo-svg" viewBox="0 0 384 146" fill="none" aria-label="Logo MOVEDZ" role="img">
            <g className="logo-whole-group">
              <g className="layered-speed-lines" aria-hidden="true">
                <line x1="22" y1="80" x2="72" y2="80" stroke="#FF5A00" strokeWidth="4.2" strokeLinecap="round" />
                <line x1="8" y1="96" x2="70" y2="96" className="mz-primary-stroke" strokeWidth="4.5" strokeLinecap="round" />
                <line x1="28" y1="112" x2="74" y2="112" stroke="#FF5A00" strokeWidth="3.8" strokeLinecap="round" />
              </g>

              <g className="letter-m-g">
                <path d="M 14 128 V 64 H 31 L 49 101 L 67 64 H 84 V 128 H 69 V 90 L 53 118 H 45 L 29 90 V 128 Z" className="mz-primary" strokeWidth="6.5" strokeLinejoin="round" />
              </g>
              <g className="letter-v-g">
                <path d="M 157 64 H 173 L 185 110 L 197 64 H 213 L 194 128 H 176 Z" className="mz-primary" strokeWidth="6.5" strokeLinejoin="round" />
              </g>
              <g className="letter-e-g">
                <path d="M 229 64 H 264 V 77 H 236 V 90 H 259 V 102 H 236 V 115 H 264 V 128 H 229 C 221 128 218 123 218 115 V 77 C 218 69 221 64 229 64 Z" className="mz-primary" strokeWidth="5.5" strokeLinejoin="round" />
              </g>
              <g className="letter-d-g">
                <path d="M 274 64 H 299 C 314 64 322 74 322 96 C 322 118 314 128 299 128 H 274 Z M 289 77 V 115 H 298 C 305 115 308 109 308 96 C 308 83 305 77 298 77 Z" fill="#FF5A00" fillRule="evenodd" stroke="#FF5A00" strokeWidth="5" strokeLinejoin="round" />
              </g>
              <g className="letter-z-g">
                <path d="M 330 64 H 374 V 77 L 348 115 H 374 V 128 H 330 V 115 L 356 77 H 330 Z" fill="#FF5A00" stroke="#FF5A00" strokeWidth="5.5" strokeLinejoin="round" />
              </g>

              {/* roue qui remplace le "O" */}
              <g className="wheel-move-g">
                <g className="wheel-bounce-g">
                  <g className="wheel-spin-g">
                    <g transform="translate(122, 96)">
                      <circle cx="0" cy="0" r="37.5" className="mz-cutout" />
                      <circle cx="0" cy="0" r="35.6" className="mz-primary" />
                      <g className="mz-cutout-stroke">
                        {Array.from({ length: 36 }, (_, i) => {
                          const a = (i * 10 * Math.PI) / 180;
                          return <line key={i} x1={Math.cos(a) * 31} y1={Math.sin(a) * 31} x2={Math.cos(a) * 35} y2={Math.sin(a) * 35} strokeWidth="1.8" />;
                        })}
                      </g>
                      <circle cx="0" cy="0" r="30.2" fill="none" className="mz-cutout-stroke" strokeWidth="1.65" />
                      <circle cx="0" cy="0" r="24.2" fill="none" className="mz-cutout-stroke" strokeWidth="2.3" />
                      <g className="mz-cutout">
                        <ellipse cx="10.4" cy="-10.4" rx="4.4" ry="6.2" transform="rotate(-45 10.4 -10.4)" />
                        <ellipse cx="10.4" cy="10.4" rx="4.4" ry="6.2" transform="rotate(45 10.4 10.4)" />
                        <ellipse cx="-10.4" cy="10.4" rx="4.4" ry="6.2" transform="rotate(-45 -10.4 10.4)" />
                        <ellipse cx="-10.4" cy="-10.4" rx="4.4" ry="6.2" transform="rotate(45 -10.4 -10.4)" />
                      </g>
                      <circle cx="0" cy="0" r="3.6" className="mz-cutout" />
                      <g className="mz-cutout">
                        <circle cx="0" cy="-8.6" r="1.65" /><circle cx="8.6" cy="0" r="1.65" />
                        <circle cx="0" cy="8.6" r="1.65" /><circle cx="-8.6" cy="0" r="1.65" />
                      </g>
                    </g>
                  </g>
                </g>
              </g>

              {/* lapin orange bondissant */}
              <g className="rabbit-g">
                <g className="mz-rabbit-halo">
                  <circle cx="94" cy="54" r="5.3" />
                  <path d="M 140.5 39.2 C 132.5 26.8, 118.2 15.2, 106.5 13.5 C 101.8 12.8, 101.5 17.6, 106.2 22.0 C 114.2 29.8, 125.8 36.2, 134.2 40.4 Z" />
                  <path d="M 134.8 41.2 C 122.2 33.0, 106.4 25.5, 94.8 25.3 C 90.0 25.2, 89.8 30.0, 95.0 34.0 C 104.8 40.2, 119.2 43.2, 131.2 44.6 Z" />
                  <path d="M 88.0 76.2 C 86.2 74.4, 88.8 62.6, 98.4 53.6 C 107.8 44.8, 121.0 40.2, 133.2 41.2 C 139.2 38.4, 147.8 39.8, 152.8 44.8 C 157.5 49.4, 157.5 54.8, 153.2 57.2 C 149.4 59.4, 143.6 58.6, 139.6 56.8 C 148.2 60.8, 155.4 67.2, 157.8 74.2 C 158.5 76.2, 157.2 77.4, 156.2 76.2 A 39.2 39.2 0 0 0 88.0 76.2 Z" />
                </g>
                <g fill="#FF5A00">
                  <circle cx="94" cy="54" r="5.3" />
                  <path d="M 140.5 39.2 C 132.5 26.8, 118.2 15.2, 106.5 13.5 C 101.8 12.8, 101.5 17.6, 106.2 22.0 C 114.2 29.8, 125.8 36.2, 134.2 40.4 Z" />
                  <path d="M 134.8 41.2 C 122.2 33.0, 106.4 25.5, 94.8 25.3 C 90.0 25.2, 89.8 30.0, 95.0 34.0 C 104.8 40.2, 119.2 43.2, 131.2 44.6 Z" />
                  <path d="M 88.0 76.2 C 86.2 74.4, 88.8 62.6, 98.4 53.6 C 107.8 44.8, 121.0 40.2, 133.2 41.2 C 139.2 38.4, 147.8 39.8, 152.8 44.8 C 157.5 49.4, 157.5 54.8, 153.2 57.2 C 149.4 59.4, 143.6 58.6, 139.6 56.8 C 148.2 60.8, 155.4 67.2, 157.8 74.2 C 158.5 76.2, 157.2 77.4, 156.2 76.2 A 39.2 39.2 0 0 0 88.0 76.2 Z" />
                </g>
                <circle cx="145.5" cy="47.8" r="2.55" fill="#FFFFFF" />
              </g>
            </g>
          </svg>
          <div className="splash-shimmer" />
        </div>
        <p className="splash-tagline">
          {isAr ? 'النقل عند الطلب، في كل الجزائر' : 'Le transport à la demande, partout en Algérie'}
        </p>
      </div>

      <div className="splash-footer">
        <div className="splash-progress"><div className="splash-progress-fill" /></div>
        <span className="splash-badge">69 WILAYAS • ALGÉRIE</span>
      </div>
    </div>
  );
}

const SPLASH_CSS = `
.splash-exit { animation: splashOut .38s cubic-bezier(.4,0,1,1) forwards; }
@keyframes splashOut { to { opacity: 0; transform: scale(1.05); visibility: hidden; } }
.splash-layer, .fixed { --splash-primary:#520096; --splash-cutout:#fff; --splash-shimmer: rgba(255,255,255,.65); }
.mz-primary { fill: var(--splash-primary); stroke: var(--splash-primary); }
.mz-primary-stroke { stroke: var(--splash-primary); }
.mz-cutout { fill: var(--splash-cutout); }
.mz-cutout-stroke { stroke: var(--splash-cutout); }
.mz-rabbit-halo { fill: var(--splash-cutout); stroke: var(--splash-cutout); stroke-width:6.2; stroke-linejoin:round; stroke-linecap:round; }
.splash-halo { position:absolute; border-radius:50%; opacity:0; pointer-events:none; animation: haloReveal .65s cubic-bezier(.22,1,.36,1) .08s forwards; }
.splash-halo-purple { width:260px; height:260px; top:-100px; left:-85px; background: rgba(82,0,150,.065); }
.splash-halo-orange { width:245px; height:245px; bottom:-95px; right:-75px; background: rgba(255,90,0,.075); }
@keyframes haloReveal { from { opacity:0; transform:scale(.7); } to { opacity:1; transform:scale(1); } }
.splash-stage { flex:1; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; }
.splash-logo-box { position:relative; width:316px; max-width:90vw; height:124px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
.splash-logo-svg { width:312px; max-width:100%; height:auto; overflow:visible; }
.splash-shimmer { position:absolute; top:-36px; left:-100px; width:62px; height:200px; background:linear-gradient(90deg,transparent,var(--splash-shimmer),transparent); transform:translateX(-120px) rotate(22deg); opacity:0; pointer-events:none; animation: shimmerSweep .66s cubic-bezier(.45,0,.2,1) 1.44s forwards; }
@keyframes shimmerSweep { 0%{opacity:0;transform:translateX(-110px) rotate(22deg);} 18%{opacity:1;} 82%{opacity:1;} 100%{opacity:0;transform:translateX(460px) rotate(22deg);} }
.layered-speed-lines { opacity:0; transform:translateX(-195px); animation: speedTrail .64s cubic-bezier(.22,1,.36,1) forwards; }
@keyframes speedTrail { 0%{opacity:0;transform:translateX(-195px);} 28%{opacity:.92;transform:translateX(-75px);} 100%{opacity:0;transform:translateX(0);} }
.wheel-move-g { opacity:0; transform:translateX(-195px); animation: wheelRoll .68s cubic-bezier(.22,1,.36,1) forwards; }
@keyframes wheelRoll { 0%{opacity:0;transform:translateX(-195px);} 20%{opacity:1;} 100%{opacity:1;transform:translateX(0);} }
.wheel-spin-g { transform-origin:122px 96px; transform:rotate(-540deg); animation: wheelSpin .68s cubic-bezier(.22,1,.36,1) forwards; }
@keyframes wheelSpin { to { transform:rotate(0deg); } }
.wheel-bounce-g { transform-origin:122px 132px; animation: wheelBounce .42s cubic-bezier(.34,1.56,.64,1) .84s forwards; }
@keyframes wheelBounce { 0%{transform:translateY(0) scaleX(1) scaleY(1);} 30%{transform:translateY(4px) scaleX(1.04) scaleY(.95);} 68%{transform:translateY(-1px) scaleX(.985) scaleY(1.015);} 100%{transform:translateY(0) scaleX(1) scaleY(1);} }
.rabbit-g { transform-origin:122px 58px; opacity:0; transform:translate(-54px,-46px) scale(.62) rotate(-18deg); animation: rabbitLeap .44s cubic-bezier(.22,1,.36,1) .68s forwards; }
@keyframes rabbitLeap { 0%{opacity:0;transform:translate(-54px,-46px) scale(.62) rotate(-18deg);} 24%{opacity:1;transform:translate(-24px,-30px) scale(.95) rotate(-8deg);} 62%{opacity:1;transform:translate(-3px,-10px) scale(1.04) rotate(5deg);} 84%{opacity:1;transform:translate(1px,3px) scale(1.02,.97) rotate(-1deg);} 100%{opacity:1;transform:translate(0,0) scale(1) rotate(0deg);} }
.letter-m-g { transform-origin:48px 95px; opacity:0; transform:translateX(20px) scale(.86); animation: letterL .38s cubic-bezier(.34,1.56,.64,1) 1.10s forwards; }
.letter-v-g { transform-origin:184px 95px; opacity:0; transform:translateX(-18px) scale(.86); animation: letterR .38s cubic-bezier(.34,1.56,.64,1) 1.15s forwards; }
.letter-e-g { transform-origin:238px 95px; opacity:0; transform:translateX(-18px) scale(.86); animation: letterR .38s cubic-bezier(.34,1.56,.64,1) 1.21s forwards; }
.letter-d-g { transform-origin:294px 95px; opacity:0; transform:translateX(-18px) scale(.86); animation: letterR .38s cubic-bezier(.34,1.56,.64,1) 1.27s forwards; }
.letter-z-g { transform-origin:348px 95px; opacity:0; transform:translateX(-18px) scale(.86); animation: letterR .38s cubic-bezier(.34,1.56,.64,1) 1.33s forwards; }
@keyframes letterL { to { opacity:1; transform:translateX(0) scale(1); } }
@keyframes letterR { to { opacity:1; transform:translateX(0) scale(1); } }
.splash-tagline { margin-top:14px; font-size:13.5px; font-weight:600; color:#635B73; text-align:center; max-width:280px; opacity:0; transform:translateY(12px); animation: taglineRise .42s cubic-bezier(.22,1,.36,1) 1.52s forwards; }
@keyframes taglineRise { to { opacity:1; transform:translateY(0); } }
.splash-footer { width:100%; display:flex; flex-direction:column; align-items:center; padding:0 0 6px; }
.splash-progress { width:176px; height:4.5px; border-radius:999px; background:#EFEAF6; overflow:hidden; }
.splash-progress-fill { width:176px; height:100%; display:flex; border-radius:999px; overflow:hidden; transform:translateX(-176px); animation: progressSlide 2.25s cubic-bezier(.45,0,.2,1) .22s forwards; background:linear-gradient(90deg,#520096 0 60%,#FF5A00 60% 100%); }
@keyframes progressSlide { to { transform:translateX(0); } }
.splash-badge { margin-top:11px; font-size:10.5px; font-weight:800; letter-spacing:1.7px; color:rgba(82,0,150,.68); }
@media (prefers-reduced-motion: reduce) { * { animation-duration:.01ms !important; animation-delay:0ms !important; } }
`;
