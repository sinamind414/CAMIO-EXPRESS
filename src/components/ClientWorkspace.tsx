import {
  AlertTriangle,
  ArrowRightLeft,
  Bookmark,
  BookmarkPlus,
  Camera,
  Check,
  ChevronRight,
  Clock,
  FileWarning,
  Lock,
  MapPin,
  Package,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Truck,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, ApiError } from '../api/client';
import {
  canRevealIntercityContact,
  canRevealUrbanContact,
  canSendIntercityChat,
  canSendUrbanChat,
} from '../domain/compliance';
import {
  formatDateDz,
  formatDzd,
  formatTimeDz,
  INTERCITY_STATUS_LABELS,
  RIDE_STATUS_LABELS,
  SERVICE_LABELS,
  TEXTS,
  VEHICLE_LABELS,
} from '../domain/i18n';
import { prioritizeFavoriteItems } from '../domain/favorites';
import { computeEmptyReturnDiscountPct } from '../domain/pricing';
import { rankIntercityQuotes } from '../domain/stateMachine';
import { SEED_PRICING_RULES, VEHICLE_CATEGORIES } from '../domain/seedData';
import type { ThemeMode } from '../domain/theme';
import type {
  AppSettings,
  ChatMessage,
  DateFlexibility,
  DepositMethod,
  Dispute,
  DisputeCategory,
  DriverProfile,
  DriverReview,
  FavoriteDriverEntry,
  IntercityRequest,
  Locale,
  PricingRule,
  Ride,
  RideEstimate,
  RouteMatrixEntry,
  RouteTemplate,
  ServiceType,
  TimeSlot,
  VehicleCategory,
  Wilaya,
} from '../domain/types';
import {
  getIncidentCategoryLabel,
  INCIDENT_CATEGORIES,
  validateIncidentReport,
} from '../domain/incidents';
import {
  isOngoingTrackableIntercity,
  isOngoingTrackableRide,
  resolveIntercityEndpoints,
} from '../domain/tracking';
import { ChatPanel } from './ChatPanel';
import { DriverReviewsSection } from './DriverReviewsSection';
import { DynamicPriceSimulator, type SimulatorApplyPayload } from './DynamicPriceSimulator';
import { FavoriteDriversPanel } from './FavoriteDriversPanel';
import { FavoriteToggleButton } from './FavoriteToggleButton';
import { LiveTrackingMap } from './LiveTrackingMap';
import { QuickIncidentPanel, type QuickIncidentSubmitPayload } from './QuickIncidentPanel';
import { RouteMapPreview } from './RouteMapPreview';
import { QuickRequest } from './QuickRequest';
import { ReliabilityBadge } from './ReliabilityBadge';
import { computeReliability } from '../domain/trust';
import { LocationPinPicker } from './LocationPinPicker';
import { SERVICE_VEHICLES, defaultVehicleForService, vehiclesForService } from '../domain/serviceVehicles';
import { VehicleIcon } from './VehicleIcon';
import { ServiceIcon } from './ServiceIcon';
import { TripRatingForm, type RatingPayload } from './TripRatingForm';

interface ClientWorkspaceProps {
  locale: Locale;
  theme?: ThemeMode;
  wilayas: Wilaya[];
  routeMatrix: RouteMatrixEntry[];
  pricingRules?: PricingRule[];
  settings: AppSettings;
  drivers?: DriverProfile[];
  rides: Ride[];
  intercityRequests: IntercityRequest[];
  chats: ChatMessage[];
  reviews?: DriverReview[];
  favorites?: FavoriteDriverEntry[];
  routeTemplates?: RouteTemplate[];
  disputes?: Dispute[];
  onRefresh: () => Promise<void>;
}

const URBAN_PHOTOS_LIBRARY = [
  'salon_meubles_oran.jpg',
  'electromenager_cuisine.jpg',
  'cartons_chambre_01.jpg',
  'gravats_chantier_sac.jpg',
];

const INTERCITY_PHOTOS_LIBRARY = [
  'f3_salon_complet.jpg',
  'chambre_armoire_lit.jpg',
  'cuisine_frigo_machine.jpg',
  'cartons_emballes.jpg',
];

export function ClientWorkspace({
  locale,
  theme = 'light',
  wilayas,
  routeMatrix,
  pricingRules = SEED_PRICING_RULES,
  settings,
  drivers = [],
  rides,
  intercityRequests,
  chats,
  reviews = [],
  favorites = [],
  routeTemplates = [],
  disputes = [],
  onRefresh,
}: ClientWorkspaceProps) {
  const isAr = locale === 'ar';
  const t = TEXTS[locale];

  const [mode, setMode] = useState<'urban' | 'intercity'>('urban');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [tplNameInput, setTplNameInput] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);

  // OTP Verification drawer state (§5.2)
  const [otpOpen, setOtpOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState('+213551889900');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('00000');
  const [verifiedPhone, setVerifiedPhone] = useState('+213551889900');

  // --- URBAN 4-STEP TUNNEL STATE ---
  const [urbanStep, setUrbanStep] = useState<1 | 2 | 3 | 4>(1);
  const [serviceType, setServiceType] = useState<ServiceType>('moving');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('medium_truck');
  const [selectedWilayaCode, setSelectedWilayaCode] = useState<number>(31);
  const [pickupAddress, setPickupAddress] = useState('Rue Larbi Ben M’hidi, Oran Centre');
  const [pickupCoords, setPickupCoords] = useState({ lat: 35.6971, lng: -0.6308 });
  const [dropoffAddress, setDropoffAddress] = useState('Es Senia, Oran');
  const [dropoffCoords, setDropoffCoords] = useState({ lat: 35.6479, lng: -0.6217 });
  // Architecture Lalamove : contacts distincts, adressage structuré, consignes par point.
  const [pickupContact, setPickupContact] = useState({ name: '', phone: '' });
  const [dropoffContact, setDropoffContact] = useState({ name: '', phone: '' });
  const [pickupNote, setPickupNote] = useState('');
  const [dropoffNote, setDropoffNote] = useState('');
  const [pickupHouse, setPickupHouse] = useState('');
  const [dropoffHouse, setDropoffHouse] = useState('');
  const [floorFrom, setFloorFrom] = useState(3);
  const [floorTo, setFloorTo] = useState(0);
  const [hasElevatorFrom, setHasElevatorFrom] = useState(false);
  const [hasElevatorTo, setHasElevatorTo] = useState(true);
  const [portersCount, setPortersCount] = useState(2);
  const [hasFragileItems, setHasFragileItems] = useState(true);
  const [needsDisassembly, setNeedsDisassembly] = useState(true);
  const [volumeNote, setVolumeNote] = useState('Salon + 1 chambre');
  const [clientComment, setClientComment] = useState('Accès camion OK devant l’entrée.');
  const [clientBudget, setClientBudget] = useState('');
  const [urbanPhotos, setUrbanPhotos] = useState<string[]>(['salon_meubles_oran.jpg']);
  const [estimate, setEstimate] = useState<RideEstimate | null>(null);
  const [submittingRide, setSubmittingRide] = useState(false);

  // Active Ride selection, favorites & rating/offers state
  const [selectedRideId, setSelectedRideId] = useState<string>(rides[0]?.id ?? '');
  const [offerSort, setOfferSort] = useState<'price' | 'rating' | 'favorites'>('price');
  const [reviewDriverFilter, setReviewDriverFilter] = useState<string>('all');
  const [preferredDriverId, setPreferredDriverId] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState<DisputeCategory>('damage');
  const [disputeDesc, setDisputeDesc] = useState('');

  // --- INTERCITY TUNNEL STATE ---
  const [icFromWilaya, setIcFromWilaya] = useState(31);
  const [icToWilaya, setIcToWilaya] = useState(16);
  const [icPickupAddr, setIcPickupAddr] = useState('Cité El Othmania, Es Senia, Oran');
  const [icDropoffAddr, setIcDropoffAddr] = useState('Quartier Soumam, Bab Ezzouar, Alger');
  const [icDate, setIcDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [icFlexibility, setIcFlexibility] = useState<DateFlexibility>('plus_minus_1');
  const [icTimeSlot, setIcTimeSlot] = useState<TimeSlot>('morning');
  const [icServiceType, setIcServiceType] = useState<ServiceType>('moving');
  const [icVehicle, setIcVehicle] = useState<VehicleCategory>('medium_truck');
  const [icPorters, setIcPorters] = useState(2);
  const [icFloorFrom, setIcFloorFrom] = useState(2);
  const [icFloorTo, setIcFloorTo] = useState(3);
  const [icElevFrom, setIcElevFrom] = useState(false);
  const [icElevTo, setIcElevTo] = useState(true);
  const [icDisassembly, setIcDisassembly] = useState(true);
  const [icPacking, setIcPacking] = useState(false);
  const [icVolumeNote, setIcVolumeNote] = useState('F3 complet · salon, 2 chambres, cuisine');
  const [icBudget, setIcBudget] = useState('35000');
  const [icPhotos, setIcPhotos] = useState<string[]>(['f3_salon_complet.jpg', 'chambre_armoire_lit.jpg']);
  const [icEstimate, setIcEstimate] = useState<{
    refPriceDzd: number;
    priceFloorDzd: number;
    priceCapDzd: number;
    distanceKm: number;
    durationMin: number;
    breakdown: Array<{ labelFr: string; labelAr: string; amountDzd: number }>;
  } | null>(null);

  // Intercity comparison & acceptance state
  const [selectedIcId, setSelectedIcId] = useState<string>(intercityRequests[0]?.id ?? '');
  const [icQuoteSort, setIcQuoteSort] = useState<'best' | 'price'>('best');
  const [counterDrafts, setCounterDrafts] = useState<Record<string, string>>({});
  const [acceptQuoteId, setAcceptQuoteId] = useState<string | null>(null);
  const [clientCommitted, setClientCommitted] = useState(false);
  const [depositMethod, setDepositMethod] = useState<DepositMethod>('baridimob');
  const [depositAmount, setDepositAmount] = useState('10000');
  const [depositProof, setDepositProof] = useState('recu_acompte_baridimob.jpg');

  useEffect(() => {
    if (!rides.some((r) => r.id === selectedRideId) && rides.length > 0) {
      setSelectedRideId(rides[0].id);
    }
  }, [rides, selectedRideId]);

  useEffect(() => {
    if (!intercityRequests.some((r) => r.id === selectedIcId) && intercityRequests.length > 0) {
      setSelectedIcId(intercityRequests[0].id);
    }
  }, [intercityRequests, selectedIcId]);

  const activeRide = useMemo(() => rides.find((r) => r.id === selectedRideId) ?? rides[0] ?? null, [rides, selectedRideId]);
  const activeIc = useMemo(
    () => intercityRequests.find((r) => r.id === selectedIcId) ?? intercityRequests[0] ?? null,
    [intercityRequests, selectedIcId]
  );

  const selectedWilaya = wilayas.find((w) => w.code === selectedWilayaCode) ?? wilayas[0];

  const notifyError = (err: unknown) => {
    if (err instanceof ApiError) {
      setErrorBanner(isAr ? err.messageAr : err.message);
    } else if (err instanceof Error) {
      setErrorBanner(err.message);
    } else {
      setErrorBanner(isAr ? 'حدث خطأ غير متوقع' : 'Une erreur est survenue.');
    }
  };

  // --- OTP Handlers ---
  const handleRequestOtp = async () => {
    setErrorBanner(null);
    try {
      await apiRequest('/api/v1/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneInput, purpose: 'login' }),
      });
      setOtpSent(true);
    } catch (e) {
      notifyError(e);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorBanner(null);
    try {
      await apiRequest('/api/v1/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneInput, code: otpCode, role: 'client' }),
      });
      setVerifiedPhone(phoneInput);
      setOtpOpen(false);
      setOtpSent(false);
      setSuccessBanner(isAr ? `تم التحقق من الرقم ${phoneInput}` : `Numéro ${phoneInput} vérifié par OTP.`);
    } catch (e) {
      notifyError(e);
    }
  };

  // --- Urban Estimate & Publish ---
  const fetchUrbanEstimate = async () => {
    setErrorBanner(null);
    try {
      const est = await apiRequest<RideEstimate>('/api/v1/rides/estimate', {
        method: 'POST',
        body: JSON.stringify({
          serviceType,
          vehicleCategory,
          pickupLat: pickupCoords.lat,
          pickupLng: pickupCoords.lng,
          dropoffLat: serviceType === 'waste_removal' ? null : dropoffCoords.lat,
          dropoffLng: serviceType === 'waste_removal' ? null : dropoffCoords.lng,
          floorFrom,
          floorTo,
          hasElevatorFrom,
          hasElevatorTo,
          portersCount,
        }),
      });
      setEstimate(est);
      setUrbanStep(4);
    } catch (e) {
      notifyError(e);
    }
  };

  /** Publication rapide : pré-remplit le formulaire complet puis publie via le flux éprouvé. */
  const handleQuickPublish = async (q: {
    service: ServiceType;
    vehicle: VehicleCategory;
    porters: number;
    wilayaCode: number;
    pickupAddress: string;
    dropoffAddress: string;
  }) => {
    setServiceType(q.service);
    setVehicleCategory(q.vehicle);
    setPortersCount(q.porters);
    setSelectedWilayaCode(q.wilayaCode);
    setPickupAddress(q.pickupAddress);
    setDropoffAddress(q.dropoffAddress);
    const w = wilayas.find((x) => x.code === q.wilayaCode);
    const commune = w?.communes?.[0];
    if (commune) {
      setPickupCoords({ lat: commune.lat, lng: commune.lng });
      setDropoffCoords({ lat: commune.lat, lng: commune.lng });
    }
    setFloorFrom(0);
    setFloorTo(0);
    setHasElevatorFrom(false);
    setHasElevatorTo(false);
    setVolumeNote(isAr ? 'حسب الطلب' : 'Selon le volume réel');
    setUrbanPhotos([q.service === 'waste_removal' ? 'gravats_oran.jpg' : 'salon_meubles_oran.jpg']);
    setAdvancedMode(false);
    setErrorBanner(null);
    setSubmittingRide(true);
    try {
      const created = await apiRequest<Ride>('/api/v1/rides', {
        method: 'POST',
        body: JSON.stringify({
          clientPhone: verifiedPhone,
          serviceType: q.service,
          vehicleCategory: q.vehicle,
          wilayaCode: q.wilayaCode,
          pickup: {
            address: q.pickupAddress,
            ...(commune ? { lat: commune.lat, lng: commune.lng } : { lat: 35.6971, lng: -0.6308 }),
            placeId: `quick-${q.wilayaCode}`,
          },
          dropoff: q.service === 'waste_removal' ? null : {
            address: q.dropoffAddress || q.pickupAddress,
            ...(commune ? { lat: commune.lat, lng: commune.lng } : { lat: 35.6971, lng: -0.6308 }),
            placeId: `quick-${q.wilayaCode}`,
          },
          floorFrom: 0,
          floorTo: 0,
          hasElevatorFrom: false,
          hasElevatorTo: false,
          portersCount: q.porters,
          hasFragileItems: false,
          needsDisassembly: false,
          volumeNote: isAr ? 'حسب الطلب' : 'Selon le volume réel',
          clientComment: '',
          photos: [q.service === 'waste_removal' ? 'gravats_oran.jpg' : 'salon_meubles_oran.jpg'],
        }),
      });
      setSelectedRideId(created.id);
      setUrbanStep(1);
      setEstimate(null);
      setSuccessBanner(
        isAr
          ? `تم إرسال الطلب ${created.rideCode} إلى ${created.notifiedDriversCount} سائقين.`
          : `Demande ${created.rideCode} envoyée à ${created.notifiedDriversCount} chauffeurs.`
      );
      await onRefresh();
    } catch (e) {
      notifyError(e);
    } finally {
      setSubmittingRide(false);
    }
  };

  const handlePublishUrbanRide = async () => {
    setErrorBanner(null);
    setSubmittingRide(true);
    try {
      const created = await apiRequest<Ride>('/api/v1/rides', {
        method: 'POST',
        body: JSON.stringify({
          clientPhone: verifiedPhone,
          serviceType,
          vehicleCategory,
          wilayaCode: selectedWilayaCode,
          pickup: {
            address: pickupAddress,
            ...pickupCoords,
            houseNumber: pickupHouse || undefined,
            floor: floorFrom,
            note: pickupNote || undefined,
            contact: pickupContact.name || pickupContact.phone ? pickupContact : undefined,
            placeId: `pin-${pickupCoords.lat.toFixed(4)}-${pickupCoords.lng.toFixed(4)}`,
          },
          dropoff: serviceType === 'waste_removal' ? null : {
            address: dropoffAddress,
            ...dropoffCoords,
            houseNumber: dropoffHouse || undefined,
            floor: floorTo,
            note: dropoffNote || undefined,
            contact: dropoffContact.name || dropoffContact.phone ? dropoffContact : undefined,
            placeId: `pin-${dropoffCoords.lat.toFixed(4)}-${dropoffCoords.lng.toFixed(4)}`,
          },
          floorFrom,
          floorTo,
          hasElevatorFrom,
          hasElevatorTo,
          portersCount,
          hasFragileItems,
          needsDisassembly,
          volumeNote,
          clientComment,
          clientBudgetDzd: clientBudget ? Number(clientBudget) : undefined,
          photos: urbanPhotos,
          preferredDriverId: settings.directRequestEnabled ? (preferredDriverId ?? undefined) : undefined,
        }),
      });
      setSelectedRideId(created.id);
      setPreferredDriverId(null);
      setUrbanStep(1);
      setEstimate(null);
      setSuccessBanner(
        isAr
          ? `تم نشر الطلب ${created.rideCode} إلى ${created.notifiedDriversCount} سائقين.`
          : `Demande ${created.rideCode} publiée auprès de ${created.notifiedDriversCount} chauffeurs.`
      );
      await onRefresh();
    } catch (e) {
      notifyError(e);
    } finally {
      setSubmittingRide(false);
    }
  };

  const handleAcceptUrbanBid = async (rideId: string, offerId: string) => {
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/rides/${rideId}/accept-bid`, {
        method: 'POST',
        body: JSON.stringify({ offerId }),
      });
      setSuccessBanner(isAr ? 'تم اختيار العرض وتأكيد السائق.' : 'Offre acceptée. Le chauffeur est assigné.');
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleCancelUrbanRide = async (rideId: string) => {
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/rides/${rideId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Annulation depuis l’application client' }),
      });
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleSubmitUrbanRating = async (rideId: string, payload: RatingPayload) => {
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/rides/${rideId}/rating`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccessBanner(
        isAr
          ? 'شكراً على تقييمك! تم نشر رأيك في مجتمع السائقين.'
          : 'Merci pour votre avis ! Votre évaluation a été publiée dans la communauté.'
      );
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const submitIncidentReport = async (payload: QuickIncidentSubmitPayload) => {
    setErrorBanner(null);
    await apiRequest('/api/v1/disputes', {
      method: 'POST',
      body: JSON.stringify({
        parentType: payload.parentType,
        parentId: payload.parentId,
        code: payload.code,
        openedByRole: 'client',
        openedByName: 'Amine Boudiaf',
        category: payload.category,
        description: payload.description,
      }),
    });
    const catLabel = getIncidentCategoryLabel(payload.category, locale);
    setSuccessBanner(
      isAr
        ? `تم تسجيل البلاغ (${catLabel}) للرحلة ${payload.code} وإرساله إلى فريق الدعم.`
        : `Signalement (${catLabel}) enregistré pour le trajet ${payload.code}. Notre équipe support intervient.`
    );
    await onRefresh();
  };

  const handleOpenDispute = async (parentType: 'ride' | 'intercity_request', parentId: string, code: string) => {
    const check = validateIncidentReport({
      parentId,
      parentType,
      category: disputeCategory,
      description: disputeDesc,
    });
    if (!check.valid) {
      setErrorBanner(isAr ? check.reasonAr || 'بيانات البلاغ غير صالحة.' : check.reasonFr || 'Signalement incomplet.');
      return;
    }
    try {
      await submitIncidentReport({
        parentType,
        parentId,
        code,
        category: check.category,
        description: check.description,
      });
      setDisputeOpen(false);
      setDisputeDesc('');
    } catch (e) {
      notifyError(e);
    }
  };

  const handleInspectHistoryTrip = (parentType: 'ride' | 'intercity_request', tripId: string) => {
    if (parentType === 'ride') {
      setMode('urban');
      setSelectedRideId(tripId);
    } else {
      setMode('intercity');
      setSelectedIcId(tripId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Intercity Handlers ---
  const fetchIntercityEstimate = async () => {
    setErrorBanner(null);
    try {
      const est = await apiRequest<NonNullable<typeof icEstimate>>('/api/v1/intercity/estimate', {
        method: 'POST',
        body: JSON.stringify({
          serviceType: icServiceType,
          fromWilaya: icFromWilaya,
          toWilaya: icToWilaya,
          vehicleCategory: icVehicle,
          portersCount: icPorters,
          floorFrom: icFloorFrom,
          floorTo: icFloorTo,
          hasElevatorFrom: icElevFrom,
          hasElevatorTo: icElevTo,
          needsDisassembly: icDisassembly,
          needsPacking: icPacking,
        }),
      });
      setIcEstimate(est);
    } catch (e) {
      setIcEstimate(null);
      notifyError(e);
    }
  };

  const handlePublishIntercity = async () => {
    setErrorBanner(null);
    try {
      const created = await apiRequest<IntercityRequest>('/api/v1/intercity/requests', {
        method: 'POST',
        body: JSON.stringify({
          clientPhone: verifiedPhone,
          serviceType: icServiceType,
          vehicleCategory: icVehicle,
          fromWilaya: icFromWilaya,
          toWilaya: icToWilaya,
          pickupAddress: icPickupAddr,
          dropoffAddress: icDropoffAddr,
          preferredDate: icDate,
          dateFlexibility: icFlexibility,
          timeSlot: icTimeSlot,
          floorFrom: icFloorFrom,
          floorTo: icFloorTo,
          hasElevatorFrom: icElevFrom,
          hasElevatorTo: icElevTo,
          portersCount: icPorters,
          needsDisassembly: icDisassembly,
          needsPacking: icPacking,
          volumeNote: icVolumeNote,
          clientBudgetDzd: icBudget ? Number(icBudget) : undefined,
          photos: icPhotos,
          preferredDriverId: settings.directRequestEnabled ? (preferredDriverId ?? undefined) : undefined,
        }),
      });
      setSelectedIcId(created.id);
      setPreferredDriverId(null);
      setIcEstimate(null);
      setSuccessBanner(
        isAr
          ? `تم نشر طلب بين الولايات ${created.requestCode}. ستتلقى العروض خلال 48 ساعة.`
          : `Demande ${created.requestCode} publiée. Collecte de devis ouverte 48 h.`
      );
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleCounterQuote = async (quoteId: string) => {
    const val = Number(counterDrafts[quoteId]);
    if (!val) return;
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/intercity/quotes/${quoteId}/counter`, {
        method: 'POST',
        body: JSON.stringify({ priceDzd: val }),
      });
      setSuccessBanner(isAr ? 'تم إرسال العرض المضاد للسائق.' : 'Contre-proposition envoyée au chauffeur.');
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleAcceptIntercityQuote = async (quoteId: string) => {
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/intercity/quotes/${quoteId}/accept`, {
        method: 'POST',
        body: JSON.stringify({
          clientCommitted,
          depositMethod,
          depositDeclaredDzd: depositMethod === 'none' ? 0 : Number(depositAmount || 0),
          depositProofLabel: depositMethod === 'none' ? undefined : depositProof,
        }),
      });
      setAcceptQuoteId(null);
      setClientCommitted(false);
      setSuccessBanner(isAr ? 'تم تأكيد الحجز بين الولايات.' : 'Devis retenu et engagement horodaté. Trajet réservé.');
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleRespondRevision = async (icId: string, accept: boolean) => {
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/intercity/requests/${icId}/price-revision/respond`, {
        method: 'POST',
        body: JSON.stringify({ accept }),
      });
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleCancelIntercityRequest = async (icId: string) => {
    setErrorBanner(null);
    try {
      const res = await apiRequest<{ lateCancellationWarning?: boolean }>(
        `/api/v1/intercity/requests/${icId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({
            cancelledBy: 'client',
            reason: isAr ? 'إلغاء من تطبيق الزبون' : 'Annulation depuis l’application client',
          }),
        }
      );
      if (res.lateCancellationWarning) {
        setSuccessBanner(
          isAr
            ? 'تم إلغاء الطلب. تنبيه: الإلغاء قبل أقل من 48 ساعة مسجل على ملف حسابك (§5.14).'
            : 'Demande annulée. Attention : annulation à moins de 48 h signalée sur votre historique réputationnel (§5.14).'
        );
      } else {
        setSuccessBanner(
          isAr ? 'تم إلغاء الطلب بين الولايات بنجاح.' : 'Demande inter-wilayas annulée.'
        );
      }
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleIntercityRating = async (icId: string, payload: RatingPayload) => {
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/intercity/requests/${icId}/rating`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccessBanner(
        isAr
          ? 'تم حفظ تقييم الرحلة ونشره.'
          : 'Avis longue distance publié dans la communauté.'
      );
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const reviewCountByDriver = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of reviews) {
      counts.set(r.driverId, (counts.get(r.driverId) ?? 0) + 1);
    }
    return counts;
  }, [reviews]);

  const favoriteDriverIds = useMemo(
    () => new Set(favorites.filter((f) => f.clientId === 'client-amine').map((f) => f.driverId)),
    [favorites]
  );

  const favoriteDriversList = useMemo(
    () => drivers.filter((d) => favoriteDriverIds.has(d.id)),
    [drivers, favoriteDriverIds]
  );

  const preferredDriver = useMemo(
    () => (preferredDriverId ? drivers.find((d) => d.id === preferredDriverId) ?? null : null),
    [drivers, preferredDriverId]
  );

  const handleToggleFavorite = async (driverId: string) => {
    setErrorBanner(null);
    try {
      const res = await apiRequest<{ added: boolean }>('/api/v1/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ driverId }),
      });
      const driverObj = drivers.find((d) => d.id === driverId);
      const name = driverObj?.fullName ?? '';
      if (!res.added && preferredDriverId === driverId) {
        setPreferredDriverId(null);
      }
      setSuccessBanner(
        res.added
          ? isAr
            ? `تمت إضافة ${name} إلى المفضلة.`
            : `${name} enregistré dans vos chauffeurs favoris.`
          : isAr
          ? `تمت إزالة ${name} من المفضلة.`
          : `${name} retiré de vos favoris.`
      );
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleUpdateFavoriteNote = async (driverId: string, note: string) => {
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/favorites/${driverId}/note`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
      });
      setSuccessBanner(isAr ? 'تم تحديث الملاحظة الشخصية.' : 'Mémo personnel mis à jour.');
      await onRefresh();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleRequestFavoriteDriver = (driver: DriverProfile) => {
    if (settings.directRequestEnabled) {
      setPreferredDriverId(driver.id);
    } else {
      setPreferredDriverId(null);
    }
    setVehicleCategory(driver.vehicle.category);
    setIcVehicle(driver.vehicle.category);
    if (wilayas.some((w) => w.code === driver.wilayaCode && w.isActive)) {
      setSelectedWilayaCode(driver.wilayaCode);
    }
    setEstimate(null);
    setIcEstimate(null);
    setUrbanStep(1);
    setSuccessBanner(
      settings.directRequestEnabled
        ? isAr
          ? `تم تحديد ${driver.fullName} (${VEHICLE_LABELS[driver.vehicle.category].ar}) لطلبك القادم.`
          : `${driver.fullName} (${VEHICLE_LABELS[driver.vehicle.category].fr}) présélectionné pour votre prochaine demande.`
        : isAr
        ? `تمت تعبئة نوع المركبة (${VEHICLE_LABELS[driver.vehicle.category].ar}) والولاية. يُنشر الطلب تلقائياً لكل السائقين المتاحين (النموذج A).`
        : `Véhicule (${VEHICLE_LABELS[driver.vehicle.category].fr}) et wilaya préremplis. La demande est diffusée à tous les chauffeurs disponibles (Modèle A).`
    );
    const target = document.getElementById(
      mode === 'urban' ? 'client-request-builder' : 'client-intercity-builder'
    );
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const focusDriverReviews = (driverId: string) => {
    setReviewDriverFilter(driverId);
    const target = document.getElementById('driver-community-reviews');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sortedUrbanOffers = useMemo(() => {
    if (!activeRide) return [];
    const list = [...activeRide.offers].filter((o) => o.status !== 'withdrawn');
    if (offerSort === 'favorites') {
      const byPrice = [...list].sort((a, b) => a.priceDzd - b.priceDzd);
      return prioritizeFavoriteItems(byPrice, favoriteDriverIds);
    }
    if (offerSort === 'price') return list.sort((a, b) => a.priceDzd - b.priceDzd);
    return list.sort((a, b) => b.driverRating - a.driverRating);
  }, [activeRide, offerSort, favoriteDriverIds]);

  const rankedIcQuotes = useMemo(() => {
    if (!activeIc) return [];
    const activeQuotes = activeIc.quotes.filter((q) => q.status !== 'withdrawn');
    const ranked = rankIntercityQuotes(activeQuotes, activeIc.refPriceDzd);
    if (icQuoteSort === 'price') {
      return [...ranked].sort((a, b) => a.priceDzd - b.priceDzd);
    }
    return ranked;
  }, [activeIc, icQuoteSort]);

  const wilayaName = (code: number) => {
    const w = wilayas.find((x) => x.code === code);
    return w ? `${String(w.code).padStart(2, '0')} · ${isAr ? w.nameAr : w.nameFr}` : String(code);
  };

  const activeChatMessages = useMemo(() => {
    if (mode === 'urban' && activeRide) {
      return chats.filter((c) => c.parentType === 'ride' && c.parentId === activeRide.id);
    }
    if (mode === 'intercity' && activeIc) {
      return chats.filter((c) => c.parentType === 'intercity_request' && c.parentId === activeIc.id);
    }
    return [];
  }, [chats, mode, activeRide, activeIc]);

  const handleApplySimulation = (payload: SimulatorApplyPayload) => {
    setMode(payload.mode);
    if (payload.mode === 'urban') {
      setServiceType(payload.serviceType);
      setVehicleCategory(payload.vehicleCategory);
      setPortersCount(payload.portersCount);
      setFloorFrom(payload.floorsNoElevator);
      setHasElevatorFrom(payload.floorsNoElevator === 0);
      setVolumeNote(
        isAr
          ? `حوالي ${payload.volumeM3} م³ · ${payload.distanceKm} كم`
          : `~${payload.volumeM3} m³ estimés (${payload.distanceKm} km)`
      );
      setEstimate(null);
      setUrbanStep(1);
    } else {
      if (payload.fromWilaya) setIcFromWilaya(payload.fromWilaya);
      if (payload.toWilaya) setIcToWilaya(payload.toWilaya);
      setIcServiceType(payload.serviceType);
      setIcVehicle(payload.vehicleCategory);
      setIcPorters(payload.portersCount);
      setIcFloorFrom(payload.floorsNoElevator);
      setIcElevFrom(payload.floorsNoElevator === 0);
      setIcVolumeNote(
        isAr
          ? `حوالي ${payload.volumeM3} م³`
          : `Volume simulé : ~${payload.volumeM3} m³`
      );
      setIcEstimate(null);
    }
    setSuccessBanner(
      isAr
        ? 'تم تطبيق معطيات محاكي السعر على نموذج الطلب.'
        : 'Paramètres du simulateur appliqués au formulaire de demande.'
    );
  };

  const handleApplyRouteTemplate = async (tpl: RouteTemplate) => {
    setErrorBanner(null);
    setMode(tpl.mode);
    setPreferredDriverId(settings.directRequestEnabled ? (tpl.preferredDriverId ?? null) : null);
    if (tpl.mode === 'urban') {
      setServiceType(tpl.serviceType);
      setVehicleCategory(tpl.vehicleCategory);
      setSelectedWilayaCode(tpl.wilayaCode);
      setPickupAddress(tpl.pickupAddress);
      setDropoffAddress(tpl.dropoffAddress);
      if (tpl.pickupLat != null && tpl.pickupLng != null) {
        setPickupCoords({ lat: tpl.pickupLat, lng: tpl.pickupLng });
      }
      if (tpl.dropoffLat != null && tpl.dropoffLng != null) {
        setDropoffCoords({ lat: tpl.dropoffLat, lng: tpl.dropoffLng });
      }
      setPortersCount(tpl.portersCount);
      setVolumeNote(tpl.volumeNote);
      setEstimate(null);
      setUrbanStep(1);
    } else {
      setIcServiceType(tpl.serviceType);
      setIcVehicle(tpl.vehicleCategory);
      if (tpl.fromWilaya) setIcFromWilaya(tpl.fromWilaya);
      if (tpl.toWilaya) setIcToWilaya(tpl.toWilaya);
      setIcPickupAddr(tpl.pickupAddress);
      setIcDropoffAddr(tpl.dropoffAddress);
      setIcPorters(tpl.portersCount);
      setIcVolumeNote(tpl.volumeNote);
      setIcEstimate(null);
    }
    setSuccessBanner(
      isAr
        ? `تم تطبيق نموذج « ${tpl.name} » بنقرة واحدة.`
        : `Modèle « ${tpl.name} » appliqué en 1 clic.`
    );
    try {
      await apiRequest(`/api/v1/route-templates/${tpl.id}/use`, { method: 'POST' });
      await onRefresh();
    } catch {
      // Usage increment failure is non-blocking after form hydration
    }
  };

  const handleSaveCurrentAsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setSavingTpl(true);
    try {
      const payload =
        mode === 'urban'
          ? {
              name: tplNameInput,
              mode: 'urban' as const,
              serviceType,
              vehicleCategory,
              wilayaCode: selectedWilayaCode,
              pickupAddress,
              dropoffAddress: serviceType === 'waste_removal' ? 'Décharge agréée' : dropoffAddress,
              pickupLat: pickupCoords.lat,
              pickupLng: pickupCoords.lng,
              dropoffLat: dropoffCoords.lat,
              dropoffLng: dropoffCoords.lng,
              portersCount,
              volumeNote,
              preferredDriverId: preferredDriverId ?? undefined,
            }
          : {
              name: tplNameInput,
              mode: 'intercity' as const,
              serviceType: icServiceType,
              vehicleCategory: icVehicle,
              wilayaCode: icFromWilaya,
              fromWilaya: icFromWilaya,
              toWilaya: icToWilaya,
              pickupAddress: icPickupAddr,
              dropoffAddress: icDropoffAddr,
              portersCount: icPorters,
              volumeNote: icVolumeNote,
              preferredDriverId: preferredDriverId ?? undefined,
            };

      const created = await apiRequest<{ template: RouteTemplate }>('/api/v1/route-templates', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setTplNameInput('');
      setSaveTplOpen(false);
      setSuccessBanner(
        isAr
          ? `تم حفظ نموذج المسار « ${created.template.name} ».`
          : `Modèle « ${created.template.name} » enregistré pour vos prochains trajets.`
      );
      await onRefresh();
    } catch (err) {
      notifyError(err);
    } finally {
      setSavingTpl(false);
    }
  };

  const handleDeleteRouteTemplate = async (templateId: string) => {
    setErrorBanner(null);
    try {
      await apiRequest(`/api/v1/route-templates/${templateId}`, { method: 'DELETE' });
      await onRefresh();
    } catch (err) {
      notifyError(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher Bar + Account OTP Trigger (below top header per Top Bar Contract) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setMode('urban')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
              mode === 'urban'
                ? 'bg-brand-700 dark:bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-200'
            }`}
          >
            {t.urbanMode}
          </button>
          <button
            type="button"
            onClick={() => setMode('intercity')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
              mode === 'intercity'
                ? 'bg-brand-700 dark:bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-200'
            }`}
          >
            {t.intercityMode}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <span>
            {isAr ? 'الزبون:' : 'Compte:'}{' '}
            <strong className="text-slate-900 dark:text-slate-100 font-medium">Amine Boudiaf</strong>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{verifiedPhone}</span>
          </span>
          <button
            type="button"
            data-testid="jump-ride-history-btn"
            onClick={() =>
              document.getElementById('client-ride-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap shrink-0 tabular-nums"
          >
            {isAr
              ? `السجل والحوادث (${rides.length + intercityRequests.length})`
              : `Historique & incidents (${rides.length + intercityRequests.length})`}
          </button>
          <button
            type="button"
            onClick={() =>
              document.getElementById('client-favorite-drivers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="px-3 py-1.5 rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-800 dark:text-rose-200 font-medium whitespace-nowrap shrink-0 tabular-nums"
          >
            {isAr ? `المفضلة (${favoriteDriversList.length})` : `Favoris (${favoriteDriversList.length})`}
          </button>
          <button
            type="button"
            onClick={() => setOtpOpen((v) => !v)}
            className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap shrink-0"
          >
            {isAr ? 'تحقق OTP' : 'Vérifier téléphone OTP'}
          </button>
        </div>
      </div>

      {/* Inline OTP Modal/Panel */}
      {otpOpen && (
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="otp-phone" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? 'رقم الهاتف الجزائري (+213)' : 'Téléphone (+213)'}
            </label>
            <input
              id="otp-phone"
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono w-48"
            />
          </div>
          {!otpSent ? (
            <button
              type="button"
              onClick={handleRequestOtp}
              className="h-10 px-4 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-800 dark:hover:bg-white whitespace-nowrap"
            >
              {isAr ? 'إرسال الرمز' : 'Envoyer le code SMS'}
            </button>
          ) : (
            <>
              <div>
                <label htmlFor="otp-code" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.otpHint}
                </label>
                <input
                  id="otp-code"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono w-32"
                />
              </div>
              <button
                type="button"
                onClick={handleVerifyOtp}
                className="h-10 px-4 rounded-md bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 whitespace-nowrap"
              >
                {isAr ? 'تأكيد' : 'Valider OTP'}
              </button>
            </>
          )}
        </div>
      )}

      {errorBanner && (
        <div role="alert" className="p-3.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/45 text-red-800 dark:text-red-200 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button type="button" onClick={() => setErrorBanner(null)} className="text-xs underline">
            {isAr ? 'إغلاق' : 'Fermer'}
          </button>
        </div>
      )}

      {successBanner && (
        <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-900 dark:text-emerald-200 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button type="button" onClick={() => setSuccessBanner(null)} className="text-xs underline">
            {isAr ? 'إغلاق' : 'Fermer'}
          </button>
        </div>
      )}

      {/* Dynamic Pre-Submission Price Simulator */}
      <DynamicPriceSimulator
        locale={locale}
        activeMode={mode}
        wilayas={wilayas}
        routeMatrix={routeMatrix}
        pricingRules={pricingRules}
        settings={settings}
        onApply={handleApplySimulation}
      />

      {/* Saved Route Templates Bar (1-click repeatable B2B / personal routes) */}
      <section
        data-testid="route-templates-panel"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-orange-600" />
              <span>
                {isAr ? 'نماذج المسارات المحفوظة (طلب بنقرة واحدة)' : 'Modèles de trajets enregistrés (1 clic)'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr
                ? 'أعد تعبئة المسار والمركبة والسائق المفضل فوراً للخطوط المتكررة.'
                : 'Réappliquez instantanément un axe départ → destination, le véhicule et votre chauffeur favori.'}
            </p>
          </div>
          <button
            type="button"
            data-testid="save-route-template-toggle"
            onClick={() => setSaveTplOpen((v) => !v)}
            className="h-8 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-orange-600" />
            <span>{isAr ? 'حفظ المسار الحالي كنموذج' : 'Sauvegarder comme modèle'}</span>
          </button>
        </div>

        {saveTplOpen && (
          <form
            onSubmit={handleSaveCurrentAsTemplate}
            className="p-3 rounded-md border border-orange-200 dark:border-orange-900/70 bg-orange-50/40 dark:bg-orange-950/25 flex flex-wrap items-end gap-2.5"
          >
            <div className="flex-1 min-w-[200px]">
              <label
                htmlFor="route-template-name"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {isAr ? 'اسم النموذج' : 'Nom du modèle (ex: Dépôt Es Senia → Centre)'}
              </label>
              <input
                id="route-template-name"
                data-testid="route-template-name-input"
                type="text"
                required
                value={tplNameInput}
                onChange={(e) => setTplNameInput(e.target.value)}
                placeholder={
                  mode === 'urban'
                    ? `${pickupAddress.slice(0, 18)} → ${dropoffAddress.slice(0, 18)}`
                    : `${wilayaName(icFromWilaya)} → ${wilayaName(icToWilaya)}`
                }
                className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
              />
            </div>
            <button
              type="submit"
              data-testid="route-template-save-submit"
              disabled={savingTpl}
              className="h-9 px-4 rounded-md bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 disabled:opacity-50"
            >
              {savingTpl ? (isAr ? 'جاري الحفظ...' : 'Enregistrement...') : isAr ? 'حفظ النموذج' : 'Enregistrer le modèle'}
            </button>
          </form>
        )}

        {routeTemplates.length === 0 ? (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'لا توجد نماذج مسجلة بعد. اضغط على « حفظ المسار الحالي كنموذج ».'
              : 'Aucun modèle enregistré. Cliquez sur « Sauvegarder comme modèle » pour mémoriser ce trajet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {routeTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{tpl.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRouteTemplate(tpl.id)}
                      aria-label={isAr ? `حذف ${tpl.name}` : `Supprimer ${tpl.name}`}
                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                    {tpl.pickupAddress} → {tpl.dropoffAddress}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    {tpl.mode === 'intercity' ? (isAr ? 'بين الولايات' : 'Inter-wilaya') : isAr ? 'داخل المدينة' : 'Urbain'} ·{' '}
                    {isAr ? SERVICE_LABELS[tpl.serviceType].ar : SERVICE_LABELS[tpl.serviceType].fr} ·{' '}
                    {isAr ? VEHICLE_LABELS[tpl.vehicleCategory].ar : VEHICLE_LABELS[tpl.vehicleCategory].fr}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {tpl.usageCount}× {isAr ? 'استخدام' : 'utilisé(s)'}
                  </span>
                  <button
                    type="button"
                    data-testid="apply-route-template-btn"
                    onClick={() => handleApplyRouteTemplate(tpl)}
                    className="h-7 px-2.5 rounded bg-slate-900 dark:bg-orange-600 text-white text-[11px] font-semibold hover:bg-slate-800 dark:hover:bg-orange-700"
                  >
                    {isAr ? 'تطبيق بنقرة' : 'Appliquer en 1 clic'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ==================== PARCOURS 1 : EN VILLE ==================== */}
      {mode === 'urban' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* PAR DÉFAUT : assistant 3 questions. Le formulaire détaillé reste disponible. */}
          {!advancedMode && (
            <div className="lg:col-span-12">
              <QuickRequest
                locale={locale}
                wilayas={wilayas}
                onPublish={handleQuickPublish}
                onAdvanced={() => setAdvancedMode(true)}
              />
            </div>
          )}

          {advancedMode && (
          <>
          {/* Left Column: 4-Step Urban Wizard */}
          <section
            id="client-request-builder"
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.urbanMode}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.urbanSub}</p>
              </div>
              <button type="button" onClick={() => setAdvancedMode(false)}
                className="text-[11px] font-semibold text-orange-700 dark:text-orange-400 hover:underline whitespace-nowrap">
                {isAr ? '← الوضع البسيط' : '← Mode simple'}
              </button>
            </div>

            {settings.directRequestEnabled && favoriteDriversList.length > 0 ? (
              <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/30 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="urban-preferred-driver" className="text-xs font-semibold text-rose-950 dark:text-rose-200">
                    {isAr ? 'تفضيل سائق محفوظ (اختياري)' : 'Prioriser un chauffeur favori (optionnel)'}
                  </label>
                  {preferredDriver && (
                    <button
                      type="button"
                      onClick={() => setPreferredDriverId(null)}
                      className="text-[11px] font-medium text-rose-800 dark:text-rose-300 hover:underline"
                    >
                      {isAr ? 'إلغاء التحديد' : 'Effacer'}
                    </button>
                  )}
                </div>
                <select
                  id="urban-preferred-driver"
                  value={preferredDriverId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setPreferredDriverId(id);
                    const picked = drivers.find((d) => d.id === id);
                    if (picked) {
                      setVehicleCategory(picked.vehicle.category);
                      setEstimate(null);
                    }
                  }}
                  className="w-full h-9 px-2.5 rounded-md border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">
                    {isAr ? 'إرسال الطلب لجميع السائقين المتاحين' : 'Tous les chauffeurs disponibles à proximité'}
                  </option>
                  {favoriteDriversList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} · {isAr ? VEHICLE_LABELS[d.vehicle.category].ar : VEHICLE_LABELS[d.vehicle.category].fr}
                    </option>
                  ))}
                </select>
                {preferredDriver && (
                  <div className="space-y-1.5">
                    <p data-testid="urban-preferred-driver-banner" className="text-[11px] text-rose-900 dark:text-rose-200">
                      {isAr
                        ? `سيتم إبراز هذا الطلب للسائق المفضل ${preferredDriver.fullName}.`
                        : `Demande marquée prioritaire pour votre favori ${preferredDriver.fullName}.`}
                    </p>
                    <ReliabilityBadge
                      info={computeReliability({
                        ratingAvg: preferredDriver.ratingAvg,
                        ratingsCount: preferredDriver.ratingsCount,
                        responseRate: preferredDriver.responseRate ?? 1,
                        ridesCompleted: preferredDriver.ridesCompleted,
                      })}
                      locale={locale}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div
                data-testid="model-a-broadcast-banner"
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <span>{t.modelABroadcastNotice}</span>
              </div>
            )}

            {/* Step Progress Indicator */}
            <div className="grid grid-cols-4 gap-1.5">
              {([1, 2, 3, 4] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => (s < 4 || estimate ? setUrbanStep(s) : null)}
                  className={`py-2 px-2 rounded-md text-xs font-medium border text-center transition-colors ${
                    urbanStep === s
                      ? 'bg-brand-700 dark:bg-brand-600 text-white border-brand-700 dark:border-brand-600'
                      : urbanStep > s
                      ? 'bg-orange-50 dark:bg-orange-950/35 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {s === 1 && (isAr ? '1. الخدمة' : '1. Service')}
                  {s === 2 && (isAr ? '2. المسار' : '2. Trajet')}
                  {s === 3 && (isAr ? '3. التفاصيل' : '3. Détails')}
                  {s === 4 && (isAr ? '4. التقدير' : '4. Prix')}
                </button>
              ))}
            </div>

            {/* E1: Service & Vehicle */}
            {urbanStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      {isAr ? 'نوع الخدمة (اختيار واحد)' : 'Type de prestation (choix unique)'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((st) => {
                        const info = SERVICE_LABELS[st];
                        const active = serviceType === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            data-testid={`service-option-${st}`}
                            aria-pressed={active}
                            onClick={() => {
                              setServiceType(st);
                              setEstimate(null);
                              setVehicleCategory(defaultVehicleForService(st));
                              if (st === 'waste_removal' || st === 'towing') setPortersCount(0);
                            }}
                            className={`w-full text-start p-2.5 rounded-lg border transition-colors flex items-center gap-3 ${
                              active
                                ? 'border-orange-600 bg-orange-50/60 dark:bg-orange-950/35 ring-1 ring-orange-500'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <ServiceIcon service={st} title={isAr ? info.ar : info.fr} className="w-16 h-12 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                                {isAr ? info.ar : info.fr}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                                {isAr ? 'ابتداءً من' : 'Dès'} {formatDzd(info.fromPrice, locale)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isAr ? 'المركبات المناسبة' : 'Véhicules adaptés à votre prestation'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                      {isAr ? 'اختيار تلقائي' : 'Sélection auto'} : {VEHICLE_LABELS[vehicleCategory]?.fr ?? ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {vehiclesForService(serviceType).map((vc, idx) => {
                      const vInfo = VEHICLE_LABELS[vc];
                      const active = vehicleCategory === vc;
                      return (
                        <button
                          key={vc}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setVehicleCategory(vc);
                            if (vc === 'motorcycle') setPortersCount(0);
                          }}
                          className={`text-start p-2.5 rounded-lg border transition-colors flex flex-col gap-1.5 ${
                            active
                              ? 'border-orange-600 bg-orange-50/60 dark:bg-orange-950/35 ring-1 ring-orange-500'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="relative">
                            <VehicleIcon category={vc} title={isAr ? vInfo.ar : vInfo.fr} className="w-full h-20" />
                            {idx === 0 && (
                              <span className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-600 text-white">
                                {isAr ? 'الأفضل' : 'Recommandé'}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                              {isAr ? vInfo.ar : vInfo.fr}
                            </div>
                            <div className="text-[11px] font-semibold text-orange-700 dark:text-orange-400 tabular-nums">
                              {vInfo.towCapacityT
                                ? `Capacité de remorquage ${vInfo.towCapacityT.toLocaleString(locale === 'ar' ? 'ar-DZ' : 'fr-FR')} t`
                                : vInfo.maxKg >= 1000
                                ? `${(vInfo.maxKg / 1000).toLocaleString(locale === 'ar' ? 'ar-DZ' : 'fr-FR')} t · ${vInfo.volM3} m³`
                                : `${vInfo.maxKg} kg · ${vInfo.volM3} m³`}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setUrbanStep(2)}
                  className="w-full h-11 rounded-md bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 flex items-center justify-center gap-2"
                >
                  <span>{isAr ? 'متابعة: العناوين' : 'Continuer : Adresses'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* E2: Addresses & Map */}
            {urbanStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="urban-wilaya" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'الولاية' : 'Wilaya'}
                  </label>
                  <select
                    id="urban-wilaya"
                    value={selectedWilayaCode}
                    onChange={(e) => {
                      const code = Number(e.target.value);
                      setSelectedWilayaCode(code);
                      const w = wilayas.find((x) => x.code === code);
                      if (w && w.communes[0]) {
                        setPickupAddress(w.communes[0].nameFr);
                        setPickupCoords({ lat: w.communes[0].lat, lng: w.communes[0].lng });
                        const dest = w.communes[1] ?? w.communes[0];
                        setDropoffAddress(dest.nameFr);
                        setDropoffCoords({ lat: dest.lat, lng: dest.lng });
                      }
                    }}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    {/* Les 69 wilayas (Loi 26-06) ; les non actives sont signalées mais sélectionnables */}
                    {wilayas.map((w) => (
                      <option key={w.code} value={w.code}>
                        {String(w.code).padStart(2, '0')} — {isAr ? w.nameAr : w.nameFr}
                        {!w.isActive ? (isAr ? ' (قيد الفتح)' : ' (à ouvrir)') : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="urban-pickup" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'عنوان الانطلاق' : 'Adresse de départ'}
                  </label>
                  <input
                    id="urban-pickup"
                    type="text"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm"
                  />
                  {selectedWilaya && selectedWilaya.communes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {selectedWilaya.communes.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setPickupAddress(isAr ? c.nameAr : c.nameFr);
                            setPickupCoords({ lat: c.lat, lng: c.lng });
                          }}
                          className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                          {isAr ? c.nameAr : c.nameFr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {serviceType === 'waste_removal' ? (
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-700 dark:text-slate-300">
                    {isAr
                      ? 'الوجهة: المفرغة العمومية أو مكان يتم الاتفاق عليه مع السائق.'
                      : 'Destination : décharge agréée / lieu à convenir avec le chauffeur (optionnelle pour gravats).'}
                  </div>
                ) : (
                  <div>
                    <label htmlFor="urban-dropoff" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'عنوان الوصول' : 'Adresse d’arrivée'}
                    </label>
                    <input
                      id="urban-dropoff"
                      type="text"
                      value={dropoffAddress}
                      onChange={(e) => setDropoffAddress(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm"
                    />
                  </div>
                )}

                {/* Épinglage précis + adressage structuré (Lalamove) */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="pickup-house" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'رقم الباب / الحي' : 'N° de porte / quartier'}
                    </label>
                    <input id="pickup-house" type="text" value={pickupHouse}
                      onChange={(e) => setPickupHouse(e.target.value)} placeholder="ex. 12, Hay Ennasr"
                      className="w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="dropoff-house" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'رقم الباب (الوصول)' : 'N° de porte (arrivée)'}
                    </label>
                    <input id="dropoff-house" type="text" value={dropoffHouse}
                      onChange={(e) => setDropoffHouse(e.target.value)} placeholder="ex. 7, Bloc B"
                      disabled={serviceType === 'waste_removal'}
                      className="w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <LocationPinPicker
                    label={isAr ? 'نقطة الانطلاق (اضغط للتحديد)' : 'Point de départ (épingler)'}
                    lat={pickupCoords.lat} lng={pickupCoords.lng}
                    onChange={(lat, lng) => setPickupCoords({ lat, lng })} locale={locale} accent="orange" />
                  {serviceType !== 'waste_removal' && (
                    <LocationPinPicker
                      label={isAr ? 'نقطة الوصول (اضغط للتحديد)' : "Point d'arrivée (épingler)"}
                      lat={dropoffCoords.lat} lng={dropoffCoords.lng}
                      onChange={(lat, lng) => setDropoffCoords({ lat, lng })} locale={locale} accent="brand" />
                  )}
                </div>

                {/* Contacts sur place — Lalamove contactsName / contactsPhoneNo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      {isAr ? 'شخص الاتصال عند الانطلاق' : 'Contact au départ'}
                    </span>
                    <div className="space-y-2">
                      <input aria-label="Nom du contact départ" type="text" value={pickupContact.name}
                        onChange={(e) => setPickupContact((c) => ({ ...c, name: e.target.value }))}
                        placeholder={isAr ? 'الاسم' : 'Nom'} className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm" />
                      <input aria-label="Téléphone du contact départ" type="tel" value={pickupContact.phone}
                        onChange={(e) => setPickupContact((c) => ({ ...c, phone: e.target.value }))}
                        placeholder="+213…" className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm" />
                      <input aria-label="Consigne au départ" type="text" value={pickupNote}
                        onChange={(e) => setPickupNote(e.target.value)}
                        placeholder={isAr ? 'تعليمات للسائق' : 'Consigne pour le chauffeur'} className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm" />
                    </div>
                  </div>
                  {serviceType !== 'waste_removal' && (
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        {isAr ? 'شخص الاتصال عند الوصول' : 'Contact à l’arrivée'}
                      </span>
                      <div className="space-y-2">
                        <input aria-label="Nom du contact arrivée" type="text" value={dropoffContact.name}
                          onChange={(e) => setDropoffContact((c) => ({ ...c, name: e.target.value }))}
                          placeholder={isAr ? 'الاسم' : 'Nom'} className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm" />
                        <input aria-label="Téléphone du contact arrivée" type="tel" value={dropoffContact.phone}
                          onChange={(e) => setDropoffContact((c) => ({ ...c, phone: e.target.value }))}
                          placeholder="+213…" className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm" />
                        <input aria-label="Consigne à l’arrivée" type="text" value={dropoffNote}
                          onChange={(e) => setDropoffNote(e.target.value)}
                          placeholder={isAr ? 'تعليمات للسائق' : 'Consigne pour le chauffeur'} className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm" />
                      </div>
                    </div>
                  )}
                </div>

                <RouteMapPreview
                  pickup={{ address: pickupAddress, ...pickupCoords }}
                  dropoff={serviceType === 'waste_removal' ? null : { address: dropoffAddress, ...dropoffCoords }}
                  distanceKm={8.4}
                  isWasteRemoval={serviceType === 'waste_removal'}
                  locale={locale}
                  theme={theme}
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUrbanStep(1)}
                    className="h-11 px-4 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {isAr ? 'رجوع' : 'Retour'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrbanStep(3)}
                    className="flex-1 h-11 rounded-md bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700"
                  >
                    {isAr ? 'متابعة: التفاصيل والصور' : 'Continuer : Détails & photos'}
                  </button>
                </div>
              </div>
            )}

            {/* E3: Dynamic Details */}
            {urbanStep === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="floor-from" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'الطابق (الانطلاق)' : 'Étage départ'}
                    </label>
                    <input
                      id="floor-from"
                      type="number"
                      min={0}
                      max={20}
                      value={floorFrom}
                      onChange={(e) => setFloorFrom(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm tabular-nums"
                    />
                    <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={hasElevatorFrom}
                        onChange={(e) => setHasElevatorFrom(e.target.checked)}
                      />
                      <span>{isAr ? 'يوجد مصعد' : 'Ascenseur'}</span>
                    </label>
                  </div>

                  {serviceType !== 'waste_removal' && (
                    <div>
                      <label htmlFor="floor-to" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {isAr ? 'الطابق (الوصول)' : 'Étage arrivée'}
                      </label>
                      <input
                        id="floor-to"
                        type="number"
                        min={0}
                        max={20}
                        value={floorTo}
                        onChange={(e) => setFloorTo(Number(e.target.value))}
                        className="w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm tabular-nums"
                      />
                      <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={hasElevatorTo}
                          onChange={(e) => setHasElevatorTo(e.target.checked)}
                        />
                        <span>{isAr ? 'يوجد مصعد' : 'Ascenseur'}</span>
                      </label>
                    </div>
                  )}
                </div>

                {serviceType !== 'freight' && (
                  <div>
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isAr ? 'عدد عمال الشحن (البرا)' : 'Nombre de manutentionnaires (bras)'}
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPortersCount(n)}
                          className={`h-10 rounded-md border text-sm font-medium tabular-nums ${
                            portersCount === n
                              ? 'bg-slate-900 dark:bg-orange-600 text-white border-slate-900 dark:border-orange-600'
                              : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {n === 3 ? '3+' : n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {serviceType === 'moving' && (
                  <div className="flex flex-wrap gap-4 text-xs text-slate-700 dark:text-slate-300">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={hasFragileItems}
                        onChange={(e) => setHasFragileItems(e.target.checked)}
                      />
                      <span>{isAr ? 'أغراض قابلة للكسر' : 'Objets fragiles'}</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={needsDisassembly}
                        onChange={(e) => setNeedsDisassembly(e.target.checked)}
                      />
                      <span>{isAr ? 'فك وتركيب الأثاث' : 'Démontage / remontage'}</span>
                    </label>
                  </div>
                )}

                {/* Photos upload / selection (mandatory >=1 for moving/waste_removal) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isAr ? 'الصور (إلزامية للنقل والردوم)' : 'Photos du chargement (≤ 300 Ko)'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{urbanPhotos.length}/6</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    {isAr
                      ? 'أضف صورة لتلقي عروض أسعار أدق بثلاث مرات.'
                      : 'Ajoutez au moins 1 photo : vous recevez des offres 3× plus précises.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {URBAN_PHOTOS_LIBRARY.map((p) => {
                      const added = urbanPhotos.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            setUrbanPhotos((prev) =>
                              added ? prev.filter((x) => x !== p) : [...prev, p].slice(0, 6)
                            )
                          }
                          className={`px-2.5 py-1.5 rounded-md border text-xs flex items-center gap-1.5 ${
                            added
                              ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/35 text-orange-900 dark:text-orange-200 font-medium'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{p}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="vol-note" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'الحجم المقدر' : 'Volume estimé'}
                    </label>
                    <input
                      id="vol-note"
                      type="text"
                      value={volumeNote}
                      onChange={(e) => setVolumeNote(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="client-budget" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'ميزانيتك (اختياري - دج)' : 'Budget souhaité (optionnel, DA)'}
                    </label>
                    <input
                      id="client-budget"
                      type="number"
                      value={clientBudget}
                      onChange={(e) => setClientBudget(e.target.value)}
                      placeholder="ex: 15500"
                      className="w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="client-comment" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'ملاحظة للسائق' : 'Commentaire (ex: rue étroite, horaire)'}
                  </label>
                  <textarea
                    id="client-comment"
                    rows={2}
                    value={clientComment}
                    onChange={(e) => setClientComment(e.target.value)}
                    className="w-full p-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUrbanStep(2)}
                    className="h-11 px-4 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {isAr ? 'رجوع' : 'Retour'}
                  </button>
                  <button
                    type="button"
                    onClick={fetchUrbanEstimate}
                    className="flex-1 h-11 rounded-md bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700"
                  >
                    {isAr ? 'حساب التقدير' : 'Estimer le prix'}
                  </button>
                </div>
              </div>
            )}

            {/* E4: Estimation & Publish */}
            {urbanStep === 4 && estimate && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {isAr ? 'السعر التقديري' : 'Prix estimé indicatif'}
                    </span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                      {formatDzd(estimate.estimatedPriceDzd, locale)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                    {isAr ? 'النطاق المسموح للعروض:' : 'Fourchette d’offres autorisée :'}{' '}
                    <strong className="text-slate-900 dark:text-slate-100">
                      {formatDzd(estimate.priceFloorDzd, locale)} – {formatDzd(estimate.priceCapDzd, locale)}
                    </strong>
                    <span className="mx-1.5">·</span>
                    <span>{estimate.distanceKm.toFixed(1)} km</span>
                    <span className="mx-1.5">·</span>
                    <span>~{estimate.durationMinEst} min</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                    {estimate.breakdown.map((b, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                        <span>{isAr ? b.labelAr : b.labelFr}</span>
                        <span className="font-mono tabular-nums">{formatDzd(b.amountDzd, locale)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/45 text-xs text-amber-900 dark:text-amber-200">
                  {t.cashDisclaimer}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUrbanStep(3)}
                    className="h-11 px-4 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {isAr ? 'تعديل' : 'Modifier'}
                  </button>
                  <button
                    type="button"
                    disabled={submittingRide}
                    onClick={handlePublishUrbanRide}
                    className="flex-1 h-11 rounded-md bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
                  >
                    {submittingRide
                      ? isAr
                        ? 'جاري النشر...'
                        : 'Publication...'
                      : isAr
                      ? 'نشر الطلب الآن'
                      : 'Publier la demande'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Right Column: Live Urban Ride Tracking, Bidding & Chat */}
          <section className="lg:col-span-7 space-y-5">
            {/* Ride selector strip if multiple rides */}
            {rides.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {rides.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRideId(r.id)}
                    className={`px-3 py-2 rounded-md border text-xs font-medium whitespace-nowrap shrink-0 ${
                      activeRide?.id === r.id
                        ? 'bg-brand-700 dark:bg-brand-600 text-white border-brand-700 dark:border-brand-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700'
                    }`}
                  >
                    <span className="font-mono">{r.rideCode}</span>
                    <span className="mx-1.5">·</span>
                    <span>{isAr ? RIDE_STATUS_LABELS[r.status].ar : RIDE_STATUS_LABELS[r.status].fr}</span>
                  </button>
                ))}
              </div>
            )}

            {!activeRide ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                {isAr ? 'لا توجد رحلات حالية. أنشئ طلبك الأول.' : 'Aucune course active. Publiez une demande à gauche.'}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {activeRide.rideCode} · {isAr ? SERVICE_LABELS[activeRide.serviceType].ar : SERVICE_LABELS[activeRide.serviceType].fr} ·{' '}
                      {isAr ? VEHICLE_LABELS[activeRide.vehicleCategory].ar : VEHICLE_LABELS[activeRide.vehicleCategory].fr}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {isAr ? RIDE_STATUS_LABELS[activeRide.status].ar : RIDE_STATUS_LABELS[activeRide.status].fr}
                    </h3>
                    {activeRide.preferredDriverName && (
                      <div className="text-xs font-medium text-rose-800 dark:text-rose-300 mt-0.5">
                        {isAr ? 'السائق المفضل المطلوب:' : 'Chauffeur favori demandé :'}{' '}
                        <strong>{activeRide.preferredDriverName}</strong>
                      </div>
                    )}
                  </div>

                  <div className="text-end">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {activeRide.finalAgreedPriceDzd
                        ? isAr
                          ? 'السعر المتفق عليه (نقداً)'
                          : 'Prix convenu (cash)'
                        : isAr
                        ? 'التقدير الأولي'
                        : 'Estimation'}
                    </div>
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                      {formatDzd(activeRide.finalAgreedPriceDzd ?? activeRide.estimatedPriceDzd, locale)}
                    </div>
                  </div>
                </div>

                {/* Live Map: dedicated WebSocket real-time tracker for ongoing trips */}
                {isOngoingTrackableRide(activeRide.status) ? (
                  <LiveTrackingMap ride={activeRide} locale={locale} theme={theme} />
                ) : (
                  <RouteMapPreview
                    pickup={activeRide.pickup}
                    dropoff={activeRide.dropoff}
                    driverPos={activeRide.driverLivePos}
                    distanceKm={activeRide.distanceKm}
                    isWasteRemoval={activeRide.serviceType === 'waste_removal'}
                    locale={locale}
                    theme={theme}
                  />
                )}

                {/* Searching State: Incoming Bids */}
                {activeRide.status === 'searching' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-600" />
                        <span>
                          {sortedUrbanOffers.length} {isAr ? 'عروض مستلمة' : 'offre(s) reçue(s)'} ·{' '}
                          {activeRide.notifiedDriversCount} {isAr ? 'سائقين منبهين' : 'chauffeurs notifiés'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-md border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setOfferSort('price')}
                          className={`px-2.5 py-1 text-xs font-medium rounded ${
                            offerSort === 'price'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isAr ? 'السعر' : 'Prix croissant'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferSort('rating')}
                          className={`px-2.5 py-1 text-xs font-medium rounded ${
                            offerSort === 'rating'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isAr ? 'التقييم' : 'Note'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferSort('favorites')}
                          className={`px-2.5 py-1 text-xs font-medium rounded ${
                            offerSort === 'favorites'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isAr ? 'المفضلون أولاً' : 'Favoris'}
                        </button>
                      </div>
                    </div>

                    {sortedUrbanOffers.length === 0 ? (
                      <div className="p-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-600 dark:text-slate-400">
                        {isAr
                          ? 'في انتظار عروض السائقين القريبين (انتقل إلى فضاء السائق لتقديم عرض)...'
                          : 'En attente des offres des chauffeurs à proximité (basculez vers « Espace Chauffeur » pour répondre)...'}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {sortedUrbanOffers.map((offer) => {
                          const verifiedCount = reviewCountByDriver.get(offer.driverId) ?? 0;
                          const isFav = favoriteDriverIds.has(offer.driverId);
                          return (
                            <div
                              key={offer.id}
                              className={`p-3.5 rounded-lg border flex flex-wrap items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 ${
                                isFav
                                  ? 'border-rose-200 dark:border-rose-800 bg-rose-50/25 dark:bg-rose-950/25'
                                  : 'border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  <span>{offer.driverName}</span>
                                  {offer.isAutoBid && (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 dark:text-orange-400">
                                      <Zap className="w-3 h-3" />
                                      <span>{isAr ? 'مزايدة تلقائية' : 'Enchère auto'}</span>
                                    </span>
                                  )}
                                  {isFav && (
                                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                                      · {isAr ? 'مفضل' : 'Favori'}
                                    </span>
                                  )}
                                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 tabular-nums">
                                    ★ {offer.driverRating > 0 ? offer.driverRating.toFixed(1) : 'Nouveau'} · {offer.driverRidesCompleted}{' '}
                                    {isAr ? 'رحلة' : 'courses'}
                                  </span>
                                  {verifiedCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => focusDriverReviews(offer.driverId)}
                                      className="text-xs font-medium text-orange-700 dark:text-orange-400 hover:underline tabular-nums"
                                    >
                                      {isAr ? `عرض ${verifiedCount} تقييمات` : `Voir les ${verifiedCount} avis`}
                                    </button>
                                  )}
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-300">
                                  {offer.vehicleLabel} ({offer.plateMasked}) · ETA {offer.etaMinutes} min · {offer.portersOffered}{' '}
                                  {isAr ? 'عمال' : 'bras'}
                                </div>
                                {offer.message && <p className="text-xs text-slate-500 dark:text-slate-400 italic">« {offer.message} »</p>}
                              </div>

                              <div className="flex flex-wrap items-center gap-2.5">
                                <FavoriteToggleButton
                                  locale={locale}
                                  driverName={offer.driverName}
                                  isFavorite={isFav}
                                  onToggle={() => handleToggleFavorite(offer.driverId)}
                                  compact
                                />
                                <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                                  {formatDzd(offer.priceDzd, locale)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAcceptUrbanBid(activeRide.id, offer.id)}
                                  className="h-9 px-4 rounded-md bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 whitespace-nowrap"
                                >
                                  {isAr ? 'قبول العرض' : 'Accepter'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div
                      data-testid="urban-contact-chat-locked"
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-600 dark:text-slate-300 space-y-1"
                    >
                      <div className="flex items-start gap-2 font-medium text-slate-800 dark:text-slate-200">
                        <Lock className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                        <span>{t.contactLockedNotice}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 ps-5">
                        {t.antiBypassPriceNotice}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCancelUrbanRide(activeRide.id)}
                      className="text-xs text-red-700 dark:text-red-400 hover:underline font-medium"
                    >
                      {isAr ? 'إلغاء الطلب' : 'Annuler cette demande'}
                    </button>
                  </div>
                )}

                {/* Preuve de livraison (Lalamove proofOfDelivery) */}
                {activeRide.proofOfDelivery && (
                  <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/25">
                    <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2 inline-flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      {isAr ? 'إثبات التسليم' : 'Preuve de livraison'}
                    </div>
                    <div className="flex items-start gap-3">
                      <img
                        src={activeRide.proofOfDelivery.photoDataUrl}
                        alt="Preuve de livraison"
                        className="w-28 h-20 object-cover rounded-md border border-slate-200 dark:border-slate-700"
                      />
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                        <div>{isAr ? 'التقاط الصورة عند التسليم' : 'Photo prise à la livraison'}</div>
                        <div className="font-mono tabular-nums">
                          {formatDateDz(activeRide.proofOfDelivery.capturedAt, locale)} · {formatTimeDz(activeRide.proofOfDelivery.capturedAt, locale)}
                        </div>
                        {activeRide.proofOfDelivery.note && <div>« {activeRide.proofOfDelivery.note} »</div>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Assigned / Active Execution State */}
                {activeRide.driverName && activeRide.status !== 'searching' && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{activeRide.driverName}</span>
                        {canRevealUrbanContact(activeRide.status) && activeRide.driverPhone ? (
                          <>
                            <span className="text-slate-400 dark:text-slate-500">·</span>
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                              {activeRide.driverPhone}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-400 dark:text-slate-500">·</span>
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              <Lock className="w-3 h-3" />
                              <span>{isAr ? 'الرقم محمي' : 'Numéro masqué'}</span>
                            </span>
                          </>
                        )}
                        {activeRide.driverId && (reviewCountByDriver.get(activeRide.driverId) ?? 0) > 0 && (
                          <>
                            <span className="text-slate-400 dark:text-slate-500">·</span>
                            <button
                              type="button"
                              onClick={() => focusDriverReviews(activeRide.driverId!)}
                              className="text-xs font-medium text-orange-700 dark:text-orange-400 hover:underline tabular-nums"
                            >
                              {isAr
                                ? `${reviewCountByDriver.get(activeRide.driverId)} تقييمات موثّقة`
                                : `${reviewCountByDriver.get(activeRide.driverId)} avis vérifiés`}
                            </button>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {activeRide.driverId && (
                          <FavoriteToggleButton
                            locale={locale}
                            driverName={activeRide.driverName}
                            isFavorite={favoriteDriverIds.has(activeRide.driverId)}
                            onToggle={() => handleToggleFavorite(activeRide.driverId!)}
                          />
                        )}
                        {canRevealUrbanContact(activeRide.status) && activeRide.driverPhone && (
                          <a
                            href={`tel:${activeRide.driverPhone}`}
                            className="h-8 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{isAr ? 'اتصال' : 'Appeler'}</span>
                          </a>
                        )}
                        {(activeRide.status === 'assigned' || activeRide.status === 'driver_arriving' || activeRide.status === 'arrived_pickup') && (
                          <button
                            type="button"
                            onClick={() => handleCancelUrbanRide(activeRide.id)}
                            className="h-8 px-3 rounded-md border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            {isAr ? 'إلغاء' : 'Annuler'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDisputeOpen((v) => !v)}
                          className="h-8 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                        >
                          <FileWarning className="w-3.5 h-3.5" />
                          <span>{isAr ? 'بلاغ / نزاع' : 'Litige'}</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{t.antiBypassPriceNotice}</span>
                    </p>

                    {disputeOpen && (
                      <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/40 space-y-2.5">
                        <div className="text-xs font-semibold text-red-900 dark:text-red-200">
                          {isAr ? 'نوع الحادث والموضوع' : 'Nature de l’incident (tracé avec historique GPS & chat)'}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {INCIDENT_CATEGORIES.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setDisputeCategory(cat.id)}
                              className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                                disputeCategory === cat.id
                                  ? 'bg-red-700 border-red-700 text-white'
                                  : 'bg-white dark:bg-slate-900 border-red-200 dark:border-red-800 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {isAr ? cat.labelAr : cat.labelFr}
                            </button>
                          ))}
                        </div>
                        <label htmlFor="dispute-desc" className="block text-xs font-medium text-red-900 dark:text-red-200">
                          {isAr ? 'وصف المشكلة (8 أحرف على الأقل)' : 'Détails constatés (min. 8 caractères)'}
                        </label>
                        <textarea
                          id="dispute-desc"
                          rows={2}
                          value={disputeDesc}
                          onChange={(e) => setDisputeDesc(e.target.value)}
                          placeholder={isAr ? 'اشرح ما حدث بدقة...' : 'Précisez le dommage, le retard ou l’écart constaté...'}
                          className="w-full p-2 rounded border border-red-200 dark:border-red-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleOpenDispute('ride', activeRide.id, activeRide.rideCode)}
                          className="h-8 px-3 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-medium"
                        >
                          {isAr ? 'فتح النزاع' : 'Envoyer le signalement'}
                        </button>
                      </div>
                    )}

                    {/* Status Timeline */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isAr ? 'سير الرحلة' : 'Journal d’exécution'}
                      </span>
                      <div className="space-y-1">
                        {activeRide.events.map((ev) => (
                          <div key={ev.id} className="text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                            <span>
                              <strong className="text-slate-900 dark:text-slate-100">
                                {isAr
                                  ? RIDE_STATUS_LABELS[ev.toStatus as keyof typeof RIDE_STATUS_LABELS]?.ar ?? ev.toStatus
                                  : RIDE_STATUS_LABELS[ev.toStatus as keyof typeof RIDE_STATUS_LABELS]?.fr ?? ev.toStatus}
                              </strong>
                              {ev.note ? ` — ${ev.note}` : ''}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                              {new Date(ev.createdAt).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Post-trip Rating Form or Published Review Receipt */}
                    <TripRatingForm
                      locale={locale}
                      status={activeRide.status}
                      driverName={activeRide.driverName}
                      tripLabel="urban"
                      existingRating={activeRide.rating}
                      onSubmit={(payload) => handleSubmitUrbanRating(activeRide.id, payload)}
                    />

                    {/* Chat Panel (unlocked only after assignment per C11) */}
                    {canSendUrbanChat(activeRide.status, settings) ? (
                      <ChatPanel
                        messages={activeChatMessages}
                        senderRole="client"
                        senderName="Amine Boudiaf"
                        locale={locale}
                        onSend={async (body, kind) => {
                          await apiRequest('/api/v1/chats', {
                            method: 'POST',
                            body: JSON.stringify({
                              parentType: 'ride',
                              parentId: activeRide.id,
                              senderRole: 'client',
                              senderName: 'Amine Boudiaf',
                              kind,
                              body,
                            }),
                          });
                          await onRefresh();
                        }}
                      />
                    ) : (
                      <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{t.contactLockedNotice}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
          </>
          )}
        </div>
      )}

      {/* ==================== PARCOURS 2 : ENTRE WILAYAS ==================== */}
      {mode === 'intercity' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: W1-W4 Intercity Request Form */}
          <section
            id="client-intercity-builder"
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
          >
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.intercityMode}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.intercitySub}</p>
            </div>

            {settings.directRequestEnabled && favoriteDriversList.length > 0 ? (
              <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/30 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="ic-preferred-driver" className="text-xs font-semibold text-rose-950 dark:text-rose-200">
                    {isAr ? 'تفضيل سائق محفوظ (اختياري)' : 'Prioriser un chauffeur favori (optionnel)'}
                  </label>
                  {preferredDriver && (
                    <button
                      type="button"
                      onClick={() => setPreferredDriverId(null)}
                      className="text-[11px] font-medium text-rose-800 dark:text-rose-300 hover:underline"
                    >
                      {isAr ? 'إلغاء التحديد' : 'Effacer'}
                    </button>
                  )}
                </div>
                <select
                  id="ic-preferred-driver"
                  value={preferredDriverId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setPreferredDriverId(id);
                    const picked = drivers.find((d) => d.id === id);
                    if (picked) {
                      setIcVehicle(picked.vehicle.category);
                      setIcEstimate(null);
                    }
                  }}
                  className="w-full h-9 px-2.5 rounded-md border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">
                    {isAr ? 'مفتوح لجميع السائقين على هذا المحور' : 'Tous les chauffeurs couvrant cet axe'}
                  </option>
                  {favoriteDriversList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} · {isAr ? VEHICLE_LABELS[d.vehicle.category].ar : VEHICLE_LABELS[d.vehicle.category].fr}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div
                data-testid="intercity-model-a-broadcast-banner"
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <span>{t.modelABroadcastNotice}</span>
              </div>
            )}

            {/* W1: Axis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ic-from" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'ولاية الانطلاق' : 'Wilaya de départ'}
                </label>
                <select
                  id="ic-from"
                  value={icFromWilaya}
                  onChange={(e) => {
                    setIcFromWilaya(Number(e.target.value));
                    setIcEstimate(null);
                  }}
                  className="w-full h-10 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {wilayas.map((w) => (
                    <option key={w.code} value={w.code}>
                      {String(w.code).padStart(2, '0')} · {isAr ? w.nameAr : w.nameFr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ic-to" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'ولاية الوصول' : 'Wilaya d’arrivée'}
                </label>
                <select
                  id="ic-to"
                  value={icToWilaya}
                  onChange={(e) => {
                    setIcToWilaya(Number(e.target.value));
                    setIcEstimate(null);
                  }}
                  className="w-full h-10 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {wilayas.map((w) => (
                    <option key={w.code} value={w.code}>
                      {String(w.code).padStart(2, '0')} · {isAr ? w.nameAr : w.nameFr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => {
                  const tmp = icFromWilaya;
                  setIcFromWilaya(icToWilaya);
                  setIcToWilaya(tmp);
                  setIcEstimate(null);
                }}
                className="inline-flex items-center gap-1.5 text-orange-700 dark:text-orange-400 hover:underline font-medium"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>{isAr ? 'عكس المسار' : 'Inverser l’axe'}</span>
              </button>
              <span className="tabular-nums">
                {routeMatrix.find((r) => r.fromWilaya === icFromWilaya && r.toWilaya === icToWilaya)?.isActive
                  ? `${routeMatrix.find((r) => r.fromWilaya === icFromWilaya && r.toWilaya === icToWilaya)?.distanceKm} km`
                  : isAr
                  ? 'محور قيد الفتح'
                  : 'Vérifiez l’ouverture'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ic-pickup-addr" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'عنوان التحميل' : 'Adresse chargement'}
                </label>
                <input
                  id="ic-pickup-addr"
                  type="text"
                  value={icPickupAddr}
                  onChange={(e) => setIcPickupAddr(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>
              <div>
                <label htmlFor="ic-drop-addr" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'عنوان التسليم' : 'Adresse livraison'}
                </label>
                <input
                  id="ic-drop-addr"
                  type="text"
                  value={icDropoffAddr}
                  onChange={(e) => setIcDropoffAddr(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>
            </div>

            {/* W2: Date & Flexibility */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="ic-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'التاريخ المفضل (J+1)' : 'Date (min J+1)'}
                </label>
                <input
                  id="ic-date"
                  type="date"
                  value={icDate}
                  onChange={(e) => setIcDate(e.target.value)}
                  className="w-full h-9 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="ic-flex" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'المرونة' : 'Souplesse'}
                </label>
                <select
                  id="ic-flex"
                  value={icFlexibility}
                  onChange={(e) => setIcFlexibility(e.target.value as DateFlexibility)}
                  className="w-full h-9 px-2 rounded-md border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="fixed">{isAr ? 'تاريخ محدد' : 'Date fixe'}</option>
                  <option value="plus_minus_1">± 1 jour</option>
                  <option value="plus_minus_3">± 3 jours</option>
                  <option value="flexible">{isAr ? 'مرن' : 'Flexible'}</option>
                </select>
              </div>
              <div>
                <label htmlFor="ic-slot" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'الفترة' : 'Créneau'}
                </label>
                <select
                  id="ic-slot"
                  value={icTimeSlot}
                  onChange={(e) => setIcTimeSlot(e.target.value as TimeSlot)}
                  className="w-full h-9 px-2 rounded-md border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="morning">{isAr ? 'صباحاً' : 'Matin'}</option>
                  <option value="afternoon">{isAr ? 'مساءً' : 'Après-midi'}</option>
                  <option value="any">{isAr ? 'أي وقت' : 'Indifférent'}</option>
                </select>
              </div>
            </div>

            {/* W3: Service, Vehicle, Options & >=2 Photos */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="ic-svc" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'الخدمة' : 'Service'}
                  </label>
                  <select
                    id="ic-svc"
                    value={icServiceType}
                    onChange={(e) => {
                      const next = e.target.value as ServiceType;
                      setIcServiceType(next);
                      setIcEstimate(null);
                      if (next === 'towing') {
                        setIcPorters(0);
                        if (icVehicle === 'tipper' || icVehicle === 'small_van') {
                          setIcVehicle('large_truck');
                        }
                      }
                    }}
                    className="w-full h-9 px-2 rounded-md border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <optgroup label={isAr ? 'الخدمات الأساسية' : 'Transport standard'}>
                      <option value="moving">{isAr ? SERVICE_LABELS.moving.ar : SERVICE_LABELS.moving.fr}</option>
                      <option value="freight">{isAr ? SERVICE_LABELS.freight.ar : SERVICE_LABELS.freight.fr}</option>
                    </optgroup>
                    <optgroup label={isAr ? 'النقل المتخصص' : 'Transport spécialisé'}>
                      <option value="refrigerated">{isAr ? SERVICE_LABELS.refrigerated.ar : SERVICE_LABELS.refrigerated.fr}</option>
                      <option value="towing">{isAr ? SERVICE_LABELS.towing.ar : SERVICE_LABELS.towing.fr}</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label htmlFor="ic-veh" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'الشاحنة' : 'Véhicule'}
                  </label>
                  <select
                    id="ic-veh"
                    value={icVehicle}
                    onChange={(e) => {
                      setIcVehicle(e.target.value as VehicleCategory);
                      setIcEstimate(null);
                    }}
                    className="w-full h-9 px-2 rounded-md border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    {(['small_van', 'utility_van', 'medium_truck', 'large_truck', 'tipper'] as VehicleCategory[]).map((vc) => (
                      <option key={vc} value={vc}>
                        {isAr ? VEHICLE_LABELS[vc].ar : VEHICLE_LABELS[vc].fr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(icServiceType === 'refrigerated' || icServiceType === 'towing') && (
                <div
                  data-testid="ic-specialized-preview"
                  className="p-2.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center gap-3"
                >
                  <ServiceIcon
                    service={icServiceType}
                    title={isAr ? SERVICE_LABELS[icServiceType].ar : SERVICE_LABELS[icServiceType].fr}
                    className="w-16 h-11 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {isAr ? SERVICE_LABELS[icServiceType].ar : SERVICE_LABELS[icServiceType].fr}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {isAr ? SERVICE_LABELS[icServiceType].descAr : SERVICE_LABELS[icServiceType].descFr}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="ic-porters" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'عمال الشحن' : 'Bras'}
                </label>
                <input
                  id="ic-porters"
                  type="number"
                  min={0}
                  max={6}
                  value={icPorters}
                  onChange={(e) => setIcPorters(Number(e.target.value))}
                  className="w-full h-9 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="ic-ff" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'طابق الانطلاق' : 'Étage dép.'}
                </label>
                <input
                  id="ic-ff"
                  type="number"
                  min={0}
                  max={15}
                  value={icFloorFrom}
                  onChange={(e) => setIcFloorFrom(Number(e.target.value))}
                  className="w-full h-9 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="ic-ft" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'طابق الوصول' : 'Étage arr.'}
                </label>
                <input
                  id="ic-ft"
                  type="number"
                  min={0}
                  max={15}
                  value={icFloorTo}
                  onChange={(e) => setIcFloorTo(Number(e.target.value))}
                  className="w-full h-9 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs tabular-nums"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-700 dark:text-slate-300">
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={icDisassembly} onChange={(e) => setIcDisassembly(e.target.checked)} />
                <span>{isAr ? 'فك وتركيب' : 'Démontage'}</span>
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={icPacking} onChange={(e) => setIcPacking(e.target.checked)} />
                <span>{isAr ? 'تغليف' : 'Emballage'}</span>
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={icElevFrom} onChange={(e) => setIcElevFrom(e.target.checked)} />
                <span>{isAr ? 'مصعد انطلاق' : 'Asc. départ'}</span>
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={icElevTo} onChange={(e) => setIcElevTo(e.target.checked)} />
                <span>{isAr ? 'مصعد وصول' : 'Asc. arrivée'}</span>
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isAr ? 'الصور (2 على الأقل)' : 'Photos obligatoires (min 2, max 8)'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{icPhotos.length}/8</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {INTERCITY_PHOTOS_LIBRARY.map((p) => {
                  const added = icPhotos.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setIcPhotos((prev) => (added ? prev.filter((x) => x !== p) : [...prev, p]))
                      }
                      className={`px-2 py-1 rounded border text-xs flex items-center gap-1 ${
                        added
                          ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/35 text-orange-900 dark:text-orange-200 font-medium'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Camera className="w-3 h-3" />
                      <span>{p}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="ic-vol" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'وصف الحمولة' : 'Volume / détails'}
                </label>
                <input
                  id="ic-vol"
                  type="text"
                  value={icVolumeNote}
                  onChange={(e) => setIcVolumeNote(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>
              <div>
                <label htmlFor="ic-budget" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'الميزانية المقترحة (دج)' : 'Budget indicatif (DA)'}
                </label>
                <input
                  id="ic-budget"
                  type="number"
                  value={icBudget}
                  onChange={(e) => setIcBudget(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs tabular-nums"
                />
              </div>
            </div>

            {/* W4: Reference Price & Publish */}
            {!icEstimate ? (
              <button
                type="button"
                onClick={fetchIntercityEstimate}
                className="w-full h-11 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white"
              >
                {isAr ? 'عرض السعر المرجعي للخط' : 'Calculer le prix de référence'}
              </button>
            ) : (
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isAr ? 'السعر المرجعي الرسمي' : 'Prix conseillé pour cet axe'}
                  </span>
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                    {formatDzd(icEstimate.refPriceDzd, locale)}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                  {icEstimate.distanceKm} km · {isAr ? 'الحدود:' : 'Fourchette devis :'}{' '}
                  {formatDzd(icEstimate.priceFloorDzd, locale)} – {formatDzd(icEstimate.priceCapDzd, locale)}
                </div>
                <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {icEstimate.breakdown.map((b, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span>{isAr ? b.labelAr : b.labelFr}</span>
                      <span className="font-mono tabular-nums">{formatDzd(b.amountDzd, locale)}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handlePublishIntercity}
                  className="w-full h-11 rounded-md bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700"
                >
                  {isAr ? 'نشر طلب عروض الأسعار (48 ساعة)' : 'Publier la demande de devis (48 h)'}
                </button>
              </div>
            )}
          </section>

          {/* Right Column: W5-W8 Quote Comparison, Commitment & Milestones */}
          <section className="lg:col-span-7 space-y-5">
            {intercityRequests.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {intercityRequests.map((ic) => (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => setSelectedIcId(ic.id)}
                    className={`px-3 py-2 rounded-md border text-xs font-medium whitespace-nowrap shrink-0 ${
                      activeIc?.id === ic.id
                        ? 'bg-brand-700 dark:bg-brand-600 text-white border-brand-700 dark:border-brand-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700'
                    }`}
                  >
                    <span className="font-mono">{ic.requestCode}</span>
                    <span className="mx-1.5">·</span>
                    <span>
                      {wilayaName(ic.fromWilaya)} → {wilayaName(ic.toWilaya)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {activeIc && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {activeIc.requestCode} · {activeIc.distanceKm} km · {formatDateDz(activeIc.preferredDate, locale)}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {wilayaName(activeIc.fromWilaya)} → {wilayaName(activeIc.toWilaya)}
                    </h3>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      {isAr ? INTERCITY_STATUS_LABELS[activeIc.status].ar : INTERCITY_STATUS_LABELS[activeIc.status].fr}
                      <span className="mx-1.5">·</span>
                      <span>{activeIc.volumeNote}</span>
                    </div>
                  </div>

                  <div className="text-end">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {activeIc.agreedPriceDzd
                        ? isAr
                          ? 'السعر المؤكد'
                          : 'Prix engagé'
                        : isAr
                        ? 'السعر المرجعي'
                        : 'Prix de référence'}
                    </div>
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                      {formatDzd(activeIc.agreedPriceDzd ?? activeIc.refPriceDzd, locale)}
                    </div>
                  </div>
                </div>

                {/* Live Intercity Geolocation Map or Route Preview */}
                {(() => {
                  const icEndpoints = resolveIntercityEndpoints(activeIc, wilayas);
                  return isOngoingTrackableIntercity(activeIc.status) ? (
                    <LiveTrackingMap
                      intercity={activeIc}
                      wilayas={wilayas}
                      locale={locale}
                      theme={theme}
                    />
                  ) : (
                    <RouteMapPreview
                      pickup={icEndpoints.pickup}
                      dropoff={icEndpoints.dropoff}
                      driverPos={activeIc.driverLivePos}
                      distanceKm={activeIc.distanceKm}
                      locale={locale}
                      theme={theme}
                    />
                  );
                })()}

                {/* W6: Quotes Comparison */}
                {(activeIc.status === 'collecting' || activeIc.status === 'quoted') && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {rankedIcQuotes.length} {isAr ? 'عروض أسعار مستلمة' : 'devis reçu(s)'}
                      </h4>
                      <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-md border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setIcQuoteSort('best')}
                          className={`px-2.5 py-1 text-xs font-medium rounded ${
                            icQuoteSort === 'best'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isAr ? 'أفضل عرض' : 'Meilleure offre'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIcQuoteSort('price')}
                          className={`px-2.5 py-1 text-xs font-medium rounded ${
                            icQuoteSort === 'price'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isAr ? 'أقل سعر' : 'Prix le plus bas'}
                        </button>
                      </div>
                    </div>

                    {rankedIcQuotes.length === 0 ? (
                      <div className="p-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-600 dark:text-slate-400">
                        {isAr
                          ? 'في انتظار عروض السائقين على هذا المحور (حتى 48 ساعة).'
                          : 'Collecte en cours : vous recevrez des devis sous 48 h (répondez depuis « Espace Chauffeur »).'}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {rankedIcQuotes.map((q) => (
                          <div key={q.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                            {q.isLowPriceWarning && (
                              <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/45 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>
                                  {isAr
                                    ? 'سعر منخفض جداً مقارنة بالمرجع — تحقق مما يشمله العرض (العمال، التجميع).'
                                    : 'Prix très bas pour cet axe — vérifiez ce qui est inclus (bras, étages, groupage).'}
                                </span>
                              </div>
                            )}

                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                                  <span>{q.driverName}</span>
                                  {favoriteDriverIds.has(q.driverId) && (
                                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                                      · {isAr ? 'مفضل' : 'Favori'}
                                    </span>
                                  )}
                                  <span className="text-xs font-normal text-slate-600 dark:text-slate-300">
                                    {q.driverIntercityCount > 0
                                      ? `★ ${q.driverIntercityRating.toFixed(1)} (${q.driverIntercityCount} trajets)`
                                      : isAr
                                      ? 'جديد في هذا النوع من الرحلات'
                                      : 'Nouveau sur ce type de trajet'}
                                  </span>
                                  {(reviewCountByDriver.get(q.driverId) ?? 0) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => focusDriverReviews(q.driverId)}
                                      className="text-xs font-medium text-orange-700 dark:text-orange-400 hover:underline tabular-nums"
                                    >
                                      {isAr
                                        ? `عرض ${reviewCountByDriver.get(q.driverId)} تقييمات`
                                        : `Voir les ${reviewCountByDriver.get(q.driverId)} avis`}
                                    </button>
                                  )}
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                  {q.vehicleLabel} ({q.plateMasked}) · {formatDateDz(q.availableDate, locale)} · {q.portersIncluded} bras
                                  {q.includesDisassembly ? ' · Démontage inclus' : ''}
                                  {q.includesPacking ? ' · Emballage inclus' : ''}
                                </div>
                                {(q.isEmptyReturn || q.isGroupage) && (
                                  <div className="text-xs font-semibold text-orange-700 dark:text-orange-400 mt-1">
                                    {q.isEmptyReturn &&
                                      (isAr
                                        ? `عودة فارغة معلنة (-${computeEmptyReturnDiscountPct(q.priceDzd, activeIc?.refPriceDzd ?? 0)}%) `
                                        : `Retour à vide déclaré (−${computeEmptyReturnDiscountPct(q.priceDzd, activeIc?.refPriceDzd ?? 0)} %) `)}
                                    {q.isEmptyReturn && q.isGroupage ? '· ' : ''}
                                    {q.isGroupage &&
                                      (isAr
                                        ? 'شحن مشترك (يتم التأكيد عند امتلاء الشاحنة)'
                                        : 'Groupage (départ confirmé si camion complet)')}
                                  </div>
                                )}
                                {q.message && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">« {q.message} »</p>}
                              </div>

                              <div className="text-end space-y-1.5">
                                <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                                  {formatDzd(q.priceDzd, locale)}
                                </div>
                                <FavoriteToggleButton
                                  locale={locale}
                                  driverName={q.driverName}
                                  isFavorite={favoriteDriverIds.has(q.driverId)}
                                  onToggle={() => handleToggleFavorite(q.driverId)}
                                  compact
                                />
                                {q.status === 'countered' && q.clientCounterPriceDzd && (
                                  <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                    {isAr ? 'عرضك المضاد:' : 'Contre-offre :'} {formatDzd(q.clientCounterPriceDzd, locale)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Counter-offer + Accept */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              {q.clientCounterPriceDzd == null ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    placeholder={isAr ? 'سعر مقترح' : 'Contre-offre DA'}
                                    value={counterDrafts[q.id] ?? ''}
                                    onChange={(e) =>
                                      setCounterDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                                    }
                                    className="h-9 w-36 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs tabular-nums"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleCounterQuote(q.id)}
                                    className="h-9 px-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                  >
                                    {isAr ? 'تفاوض (مرة واحدة)' : 'Négocier (1 tour)'}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {isAr ? 'تم استخدام جولة التفاوض الوحيدة' : 'Tour de négociation unique utilisé'}
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => setAcceptQuoteId(q.id)}
                                className="h-9 px-4 rounded-md bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700"
                              >
                                {isAr ? 'اختيار هذا العرض' : 'Retenir ce devis'}
                              </button>
                            </div>

                            {/* W7: Commitment & Deposit Declaration Panel */}
                            {acceptQuoteId === q.id && (
                              <div className="p-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 space-y-3 mt-2">
                                <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                  {isAr ? 'الالتزام والتصريح بالتسبيق' : 'Engagement horodaté & acompte déclaré'}
                                </h5>
                                <div className="p-2.5 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/45 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                  <span>{t.intercityInsuranceDisclaimer}</span>
                                </div>

                                {q.priceDzd >= settings.intercityDepositRequiredAboveDzd && (
                                  <div className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                      {isAr
                                        ? `تصريح بالتسبيق إلزامي للرحلات ≥ ${formatDzd(settings.intercityDepositRequiredAboveDzd, locale)}`
                                        : `Acompte recommandé / requis (≥ ${formatDzd(settings.intercityDepositRequiredAboveDzd, locale)}) — constaté uniquement, non encaissé par la plateforme`}
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                      <select
                                        value={depositMethod}
                                        onChange={(e) => setDepositMethod(e.target.value as DepositMethod)}
                                        className="h-9 px-2 rounded border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                                      >
                                        <option value="baridimob">BaridiMob</option>
                                        <option value="ccp">CCP</option>
                                      </select>
                                      <input
                                        type="number"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        placeholder="Montant DA"
                                        className="h-9 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs tabular-nums"
                                      />
                                      <input
                                        type="text"
                                        value={depositProof}
                                        onChange={(e) => setDepositProof(e.target.value)}
                                        placeholder="Reçu photo"
                                        className="h-9 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
                                      />
                                    </div>
                                  </div>
                                )}

                                <label className="flex items-start gap-2 text-xs text-slate-800 dark:text-slate-200">
                                  <input
                                    type="checkbox"
                                    checked={clientCommitted}
                                    onChange={(e) => setClientCommitted(e.target.checked)}
                                    className="mt-0.5"
                                  />
                                  <span>
                                    {isAr
                                      ? 'ألتزم بهذا السعر وهذا الموعد؛ في حال الإلغاء قبل أقل من 48 ساعة يتم تسجيل إشعار على حسابي.'
                                      : 'Je m’engage sur ce prix et cette date ; en cas de désistement à moins de 48 h, mon compte sera signalé.'}
                                  </span>
                                </label>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setAcceptQuoteId(null)}
                                    className="h-9 px-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-medium"
                                  >
                                    {isAr ? 'إلغاء' : 'Annuler'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptIntercityQuote(q.id)}
                                    className="h-9 px-4 rounded bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700"
                                  >
                                    {isAr ? 'تأكيد الحجز النهائي' : 'Confirmer et réserver'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div
                      data-testid="intercity-contact-chat-locked"
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-600 dark:text-slate-300 space-y-1"
                    >
                      <div className="flex items-start gap-2 font-medium text-slate-800 dark:text-slate-200">
                        <Lock className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                        <span>{t.contactLockedNotice}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 ps-5">
                        {t.antiBypassPriceNotice}
                      </p>
                    </div>

                    <button
                      type="button"
                      data-testid="cancel-intercity-button"
                      onClick={() => handleCancelIntercityRequest(activeIc.id)}
                      className="text-xs text-red-700 dark:text-red-400 hover:underline font-medium"
                    >
                      {isAr ? 'إلغاء طلب عروض الأسعار' : 'Annuler cette demande'}
                    </button>
                  </div>
                )}

                {/* W8: Booked / In Progress / Completed Intercity */}
                {(activeIc.status === 'booked' ||
                  activeIc.status === 'in_progress' ||
                  activeIc.status === 'completed' ||
                  activeIc.status === 'rated') && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{activeIc.driverName}</span>
                        {canRevealIntercityContact(activeIc.status) && activeIc.driverPhone ? (
                          <>
                            <span className="mx-2 text-slate-400 dark:text-slate-500">·</span>
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                              {activeIc.driverPhone}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="mx-2 text-slate-400 dark:text-slate-500">·</span>
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              <Lock className="w-3 h-3" />
                              <span>{isAr ? 'الرقم محمي' : 'Numéro masqué'}</span>
                            </span>
                          </>
                        )}
                        {activeIc.depositDeclaredDzd > 0 && (
                          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                            {isAr ? 'تسبيق مصرح به:' : 'Acompte déclaré :'} {formatDzd(activeIc.depositDeclaredDzd, locale)} (
                            {activeIc.depositMethod.toUpperCase()})
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {activeIc.driverId && activeIc.driverName && (
                          <FavoriteToggleButton
                            locale={locale}
                            driverName={activeIc.driverName}
                            isFavorite={favoriteDriverIds.has(activeIc.driverId)}
                            onToggle={() => handleToggleFavorite(activeIc.driverId!)}
                          />
                        )}
                        {canRevealIntercityContact(activeIc.status) && activeIc.driverPhone && (
                          <a
                            href={`tel:${activeIc.driverPhone}`}
                            className="h-9 px-3.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{isAr ? 'اتصال' : 'Appeler'}</span>
                          </a>
                        )}
                        {activeIc.status === 'booked' && (
                          <button
                            type="button"
                            data-testid="cancel-booked-intercity-button"
                            onClick={() => handleCancelIntercityRequest(activeIc.id)}
                            className="h-9 px-3 rounded-md border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            {isAr ? 'إلغاء الحجز' : 'Annuler la réservation'}
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{t.antiBypassPriceNotice}</span>
                    </p>

                    {/* Price revision approval if pending */}
                    {activeIc.priceRevision && activeIc.priceRevision.status === 'pending' && (
                      <div className="p-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/45 space-y-2">
                        <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
                          {isAr ? 'طلب مراجعة السعر في عين المكان' : 'Demande de révision de prix sur place'}
                        </div>
                        <p className="text-xs text-amber-900 dark:text-amber-200">
                          {activeIc.priceRevision.reason} · {isAr ? 'السعر المقترح:' : 'Nouveau total proposé :'}{' '}
                          <strong className="font-mono">{formatDzd(activeIc.priceRevision.proposedPriceDzd, locale)}</strong>
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleRespondRevision(activeIc.id, true)}
                            className="h-8 px-3 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-medium"
                          >
                            {isAr ? 'موافقة' : 'Accepter la révision'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondRevision(activeIc.id, false)}
                            className="h-8 px-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-medium"
                          >
                            {isAr ? 'رفض' : 'Refuser'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Milestone Events */}
                    <div className="space-y-1">
                      {activeIc.events.map((ev) => (
                        <div key={ev.id} className="text-xs text-slate-600 dark:text-slate-300 flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span>
                            <strong className="text-slate-900 dark:text-slate-100">{ev.toStatus}</strong>
                            {ev.note ? ` — ${ev.note}` : ''}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                            {formatDateDz(ev.createdAt, locale)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <TripRatingForm
                      locale={locale}
                      status={activeIc.status}
                      driverName={activeIc.driverName}
                      tripLabel="intercity"
                      existingRating={activeIc.rating}
                      onSubmit={(payload) => handleIntercityRating(activeIc.id, payload)}
                    />

                    {canSendIntercityChat(activeIc.status, settings) ? (
                      <ChatPanel
                        messages={activeChatMessages}
                        senderRole="client"
                        senderName="Amine Boudiaf"
                        locale={locale}
                        onSend={async (body, kind) => {
                          await apiRequest('/api/v1/chats', {
                            method: 'POST',
                            body: JSON.stringify({
                              parentType: 'intercity_request',
                              parentId: activeIc.id,
                              senderRole: 'client',
                              senderName: 'Amine Boudiaf',
                              kind,
                              body,
                            }),
                          });
                          await onRefresh();
                        }}
                      />
                    ) : (
                      <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{t.contactLockedNotice}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Ride History & Quick Incident Reporting */}
      <QuickIncidentPanel
        id="client-ride-history"
        locale={locale}
        rides={rides}
        intercityRequests={intercityRequests}
        disputes={disputes}
        wilayas={wilayas}
        onInspectTrip={handleInspectHistoryTrip}
        onSubmitIncident={submitIncidentReport}
      />

      {/* Saved Favorite Drivers Panel */}
      <FavoriteDriversPanel
        id="client-favorite-drivers"
        locale={locale}
        favorites={favorites}
        drivers={drivers}
        reviews={reviews}
        preferredDriverId={preferredDriverId}
        directRequestEnabled={settings.directRequestEnabled}
        onToggleFavorite={handleToggleFavorite}
        onUpdateNote={handleUpdateFavoriteNote}
        onRequestDriver={handleRequestFavoriteDriver}
        onInspectReviews={focusDriverReviews}
      />

      {/* Community Driver Reviews & Trust Section */}
      <DriverReviewsSection
        id="driver-community-reviews"
        locale={locale}
        drivers={drivers}
        reviews={reviews}
        selectedDriverId={reviewDriverFilter}
        onSelectDriverId={setReviewDriverFilter}
        favoriteDriverIds={favoriteDriverIds}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}
