import { useRef, useState } from 'react';
import { Camera, Check, ImagePlus, X } from 'lucide-react';
import type { Locale } from '../domain/types';

interface Props {
  locale: Locale;
  onCapture: (photoDataUrl: string) => void;
  value?: string;
}

/** Capture d'une preuve de livraison (photo compressée), style Lalamove proofOfDelivery. */
export function ProofOfDeliveryCapture({ locale, onCapture, value }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(value);
  const [error, setError] = useState<string | null>(null);
  const isAr = locale === 'ar';

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(isAr ? 'صورة فقط' : 'Image uniquement');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        // Compression : max 1200 px, JPEG 0.72 -> reste sous la limite serveur.
        const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        setPreview(dataUrl);
        setError(null);
        onCapture(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  if (preview) {
    return (
      <div className="p-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30">
        <div className="flex items-center gap-3">
          <img src={preview} alt="Preuve de livraison" className="w-20 h-16 object-cover rounded-md border border-slate-200 dark:border-slate-700" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300 inline-flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              {isAr ? 'تم التقاط إثبات التسليم' : 'Preuve de livraison capturée'}
            </div>
            <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
              {isAr ? 'ستُرسل مع تأكيد إنهاء الرحلة' : 'Sera envoyée avec la confirmation de fin'}
            </div>
          </div>
          <button type="button" onClick={() => { setPreview(undefined); onCapture(''); }} aria-label="Retirer la preuve" className="p-1.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
            <X className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg border border-dashed border-orange-300 dark:border-orange-700 bg-orange-50/40 dark:bg-orange-950/20">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-md bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
      >
        <Camera className="w-4 h-4" />
        {isAr ? 'التقط صورة إثبات التسليم' : 'Prendre la photo de livraison'}
      </button>
      <button type="button" onClick={() => inputRef.current?.click()} className="w-full mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 inline-flex items-center justify-center gap-1">
        <ImagePlus className="w-3 h-3" />
        {isAr ? 'أو اختر صورة من المعرض' : 'ou choisir depuis la galerie'}
      </button>
      {error && <div className="mt-1 text-[11px] text-red-600">{error}</div>}
    </div>
  );
}
