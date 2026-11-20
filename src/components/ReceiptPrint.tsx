import { Printer } from 'lucide-react';
import { formatDzd, formatDateDz } from '../domain/i18n';
import type { Locale, Ride } from '../domain/types';

/** Reçu de course imprimable (remplace PDFium côté web via window.print). */
export function ReceiptPrint({ ride, locale }: { ride: Ride; locale: Locale }) {
  const isAr = locale === 'ar';
  const print = () => {
    const content = document.getElementById(`receipt-${ride.id}`);
    if (!content) return;
    const win = window.open('', '_blank', 'width=600,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><title>CAMIO · ${ride.rideCode}</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#111;direction:${isAr ? 'rtl' : 'ltr'}}h1{color:#4c1d95}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:start}.big{font-size:22px;font-weight:bold;color:#ea580c}.foot{margin-top:32px;font-size:11px;color:#666}</style></head><body>
<h1>MOVEDZ · ${isAr ? 'إيصال الرحلة' : 'Reçu de course'}</h1>
<p><strong>${ride.rideCode}</strong> · ${formatDateDz(ride.completedAt ?? ride.createdAt, locale)}</p>
<table>
<tr><th>${isAr ? 'الخدمة' : 'Prestation'}</th><td>${ride.serviceType}</td></tr>
<tr><th>${isAr ? 'المركبة' : 'Véhicule'}</th><td>${ride.vehicleCategory}</td></tr>
<tr><th>${isAr ? 'من' : 'Départ'}</th><td>${ride.pickup.address}</td></tr>
<tr><th>${isAr ? 'إلى' : 'Arrivée'}</th><td>${ride.dropoff?.address ?? '—'}</td></tr>
<tr><th>${isAr ? 'المسافة' : 'Distance'}</th><td>${ride.distanceKm} km</td></tr>
<tr><th>${isAr ? 'السائق' : 'Chauffeur'}</th><td>${ride.driverName ?? '—'}</td></tr>
<tr><th>${isAr ? 'المبلغ المتفق عليه' : 'Prix convenu'}</th><td class="big">${formatDzd(ride.finalAgreedPriceDzd ?? ride.estimatedPriceDzd, locale)}</td></tr>
</table>
<p class="foot">${isAr ? 'الدفع نقداً مباشرة للسائق. المنصة لا تفرض عمولة.' : 'Paiement en cash direct au chauffeur. Aucune commission prélevée par la plateforme.'}</p>
</body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <button type="button" onClick={print}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
      <Printer className="w-3.5 h-3.5" />
      {isAr ? 'إيصال الطباعة' : 'Imprimer le reçu'}
      <span id={`receipt-${ride.id}`} className="hidden" />
    </button>
  );
}
