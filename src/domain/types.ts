export type Locale = 'fr' | 'ar';

export type WorkspaceRole = 'client' | 'driver' | 'admin';

export type ServiceType = 'moving' | 'waste_removal' | 'freight' | 'refrigerated' | 'towing';

export type VehicleCategory =
  // Sélecteur 3D MOVEDZ (8 véhicules + dépanneuse)
  | 'motorcycle'
  | 'tow_truck'
  | 'sedan'
  | 'mpv'
  | 'van'
  | 'pickup_bak'
  | 'pickup_box'
  | 'engkel_box'
  | 'engkel_bak'
  | 'cdd_bak'
  | 'cdd_box'
  // Identifiants historiques conservés pour la compatibilité des tests / domaine
  | 'small_van'
  | 'utility_van'
  | 'medium_truck'
  | 'large_truck'
  | 'tipper';

export type DriverAccountStatus =
  | 'pending_documents'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'blocked';

export type RideStatus =
  | 'draft'
  | 'searching'
  | 'assigned'
  | 'driver_arriving'
  | 'arrived_pickup'
  | 'loading'
  | 'in_transit'
  | 'arrived_dropoff'
  | 'completed'
  | 'rated'
  | 'cancelled_client'
  | 'cancelled_driver'
  | 'expired'
  | 'disputed';

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';

export type SubscriptionStatus = 'active' | 'grace' | 'expired' | 'cancelled';
export type SubscriptionKind = 'trial' | 'paid' | 'manual';
export type PaymentMethod = 'baridimob' | 'ccp' | 'voucher' | 'cash_agency';
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded';

export type DocumentType =
  | 'license'
  | 'vehicle_registration'
  | 'insurance'
  | 'vehicle_photo'
  | 'vehicle_photo_plate'
  | 'national_id';

export type DocumentStatus = 'uploaded' | 'approved' | 'rejected';

export type IntercityStatus =
  | 'draft'
  | 'collecting'
  | 'quoted'
  | 'booked'
  | 'in_progress'
  | 'completed'
  | 'rated'
  | 'cancelled_client'
  | 'cancelled_driver'
  | 'expired'
  | 'disputed';

export type IntercityQuoteStatus =
  | 'pending'
  | 'countered'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'expired';

export type DateFlexibility = 'fixed' | 'plus_minus_1' | 'plus_minus_3' | 'flexible';
export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'any';
export type DepositMethod = 'ccp' | 'baridimob' | 'none';
export type DisputeCategory = 'damage' | 'delay' | 'price' | 'no_show' | 'rudeness' | 'app_bug' | 'other';
export type DisputeStatus = 'open' | 'in_review' | 'resolved' | 'rejected';

export interface Wilaya {
  code: number;
  nameFr: string;
  nameAr: string;
  isActive: boolean;
  lat: number;
  lng: number;
  communes: Array<{ id: string; nameFr: string; nameAr: string; lat: number; lng: number }>;
}

export interface RouteMatrixEntry {
  id: string;
  fromWilaya: number;
  toWilaya: number;
  distanceKm: number;
  durationMin: number;
  isActive: boolean;
  axisCoefficient: number;
  refPrices: Record<VehicleCategory, number>;
}

export interface Vehicle {
  id: string;
  driverId: string;
  category: VehicleCategory;
  brand: string;
  model: string;
  plateNumber: string;
  year: number;
  maxLoadKg: number;
  volumeM3: number;
  hasTailgate: boolean;
  hasRamps: boolean;
  isActive: boolean;
}

export interface DriverDocument {
  id: string;
  driverId: string;
  docType: DocumentType;
  fileName: string;
  previewUrl: string;
  status: DocumentStatus;
  reviewNote?: string;
  expiresOn?: string;
  reviewedAt?: string;
}

export interface Subscription {
  id: string;
  driverId: string;
  kind: SubscriptionKind;
  status: SubscriptionStatus;
  startsOn: string;
  endsOn: string;
  graceUntil: string;
  amountDzd: number;
}

export interface SubscriptionPayment {
  id: string;
  driverId: string;
  driverName: string;
  method: PaymentMethod;
  amountDzd: number;
  status: PaymentStatus;
  reference: string;
  proofLabel: string;
  proofHash: string;
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
  periodDays: number;
}

export interface Voucher {
  code: string;
  batch: string;
  periodDays: number;
  maxUses: number;
  uses: number;
  validUntil: string;
  createdAt: string;
}

export interface AutoBidConfig {
  enabled: boolean;
  ratePerKmDzd: number;
  minFloorPriceDzd: number;
  maxDistanceKm: number;
  serviceTypes: ServiceType[];
  acceptSmallerLoads?: boolean;
  message: string;
}

export interface DriverProfile {
  id: string;
  phone: string;
  fullName: string;
  wilayaCode: number;
  status: DriverAccountStatus;
  rejectionReason?: string;
  bio: string;
  isOnline: boolean;
  lat: number;
  lng: number;
  ratingAvg: number;
  ratingsCount: number;
  ratingIntercityAvg: number;
  intercityRatingsCount: number;
  intercityCompleted: number;
  intercityPenaltyCount: number;
  ridesCompleted: number;
  ridesCancelled: number;
  acceptanceRate: number;
  requestsReceivedCount: number;
  requestsRespondedCount: number;
  ignoredRequestsStreak: number;
  responseRate: number;
  isDemotedInBroadcast: boolean;
  vehicle: Vehicle;
  documents: DriverDocument[];
  subscription: Subscription;
  coverageAxes: Array<{ fromWilaya: number; toWilaya: number | null }>;
  autoBidConfig?: AutoBidConfig;
}

/** Point de prestation structuré — calqué sur AddressInformationModel de Lalamove. */
export interface ServiceContact {
  name: string;
  phone: string;
}

export interface RideLocation {
  address: string;
  lat: number;
  lng: number;
  /** Numéro de porte / bâtiment / quartier (adressage algérien, R4 du CDC). */
  houseNumber?: string;
  districtName?: string;
  floor?: number;
  /** Note de consigne propre à ce point (pickUpNote / dropOffNote). */
  note?: string;
  /** Identifiant du lieu épinglé sur carte (placeId Lalamove). */
  placeId?: string;
  /** Contact sur place (distinct du client qui commande). */
  contact?: ServiceContact;
}

export interface PriceBreakdownItem {
  labelFr: string;
  labelAr: string;
  amountDzd: number;
}

export interface RideEstimate {
  estimatedPriceDzd: number;
  priceFloorDzd: number;
  priceCapDzd: number;
  distanceKm: number;
  durationMinEst: number;
  isApproximateDistance: boolean;
  breakdown: PriceBreakdownItem[];
}

export interface RideOffer {
  id: string;
  rideId: string;
  driverId: string;
  driverName: string;
  driverRating: number;
  driverRidesCompleted: number;
  vehicleCategory: VehicleCategory;
  vehicleLabel: string;
  plateMasked: string;
  priceDzd: number;
  etaMinutes: number;
  portersOffered: number;
  message: string;
  status: OfferStatus;
  isAutoBid?: boolean;
  retractableUntil?: string;
  createdAt: string;
}

export interface RideStatusEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actor: 'client' | 'driver' | 'admin' | 'system';
  note?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  parentType: 'ride' | 'intercity_request';
  parentId: string;
  senderRole: 'client' | 'driver' | 'system';
  senderName: string;
  kind: 'text' | 'voice' | 'photo' | 'system';
  body: string;
  durationSec?: number;
  createdAt: string;
}

export interface Ride {
  id: string;
  rideCode: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  preferredDriverId?: string;
  preferredDriverName?: string;
  vehicleCategory: VehicleCategory;
  serviceType: ServiceType;
  status: RideStatus;
  wilayaCode: number;
  pickup: RideLocation;
  dropoff: RideLocation | null;
  distanceKm: number;
  floorFrom: number;
  floorTo: number;
  hasElevatorFrom: boolean;
  hasElevatorTo: boolean;
  portersCount: number;
  hasFragileItems: boolean;
  needsDisassembly: boolean;
  volumeNote: string;
  clientComment: string;
  clientBudgetDzd?: number;
  photos: string[];
  hasVoiceNote?: boolean;
  estimatedPriceDzd: number;
  priceFloorDzd: number;
  priceCapDzd: number;
  finalAgreedPriceDzd?: number;
  notifiedDriversCount: number;
  searchExpiresAt: string;
  createdAt: string;
  loadingStartedAt?: string;
  completedAt?: string;
  cancellationReason?: string;
  cancelledBy?: 'client' | 'driver' | 'system' | 'admin';
  rating?: {
    stars: number;
    tags: string[];
    comment: string;
    ratedAt?: string;
  };
  offers: RideOffer[];
  events: RideStatusEvent[];
  driverLivePos?: { lat: number; lng: number; heading: number; speedKmh: number; ts: string };
  driverTrail?: Array<{ lat: number; lng: number; ts: string }>;
  /** Preuve de livraison (Lalamove proofOfDelivery) : photo + horodatage à l'arrivée. */
  proofOfDelivery?: {
    photoDataUrl: string;
    capturedAt: string;
    lat?: number;
    lng?: number;
    note?: string;
  };
}

export interface IntercityQuote {
  id: string;
  requestId: string;
  driverId: string;
  driverName: string;
  driverIntercityRating: number;
  driverIntercityCount: number;
  axisExperienceCount: number;
  vehicleCategory: VehicleCategory;
  vehicleLabel: string;
  plateMasked: string;
  priceDzd: number;
  availableDate: string;
  timeSlot: TimeSlot;
  portersIncluded: number;
  includesPacking: boolean;
  includesDisassembly: boolean;
  isGroupage: boolean;
  isEmptyReturn: boolean;
  message: string;
  status: IntercityQuoteStatus;
  clientCounterPriceDzd?: number;
  responseMinutes: number;
  createdAt: string;
}

export interface IntercityRequest {
  id: string;
  requestCode: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  status: IntercityStatus;
  serviceType: ServiceType;
  vehicleCategory: VehicleCategory;
  fromWilaya: number;
  toWilaya: number;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  preferredDate: string;
  dateFlexibility: DateFlexibility;
  timeSlot: TimeSlot;
  floorFrom: number;
  floorTo: number;
  hasElevatorFrom: boolean;
  hasElevatorTo: boolean;
  portersCount: number;
  needsDisassembly: boolean;
  needsPacking: boolean;
  volumeNote: string;
  clientComment: string;
  photos: string[];
  refPriceDzd: number;
  priceFloorDzd: number;
  priceCapDzd: number;
  clientBudgetDzd?: number;
  agreedPriceDzd?: number;
  depositRequiredDzd: number;
  depositDeclaredDzd: number;
  depositMethod: DepositMethod;
  depositProofLabel?: string;
  clientCommittedAt?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  preferredDriverId?: string;
  preferredDriverName?: string;
  quotesOpenUntil: string;
  checklist: {
    truckChecked: boolean;
    portersConfirmed: boolean;
    clientCalled: boolean;
  };
  priceRevision?: {
    proposedPriceDzd: number;
    reason: string;
    status: 'pending' | 'accepted' | 'rejected';
  };
  quotes: IntercityQuote[];
  events: RideStatusEvent[];
  rating?: {
    stars: number;
    tags: string[];
    comment: string;
    ratedAt?: string;
  };
  driverLivePos?: { lat: number; lng: number; heading: number; speedKmh: number; ts: string };
  driverTrail?: Array<{ lat: number; lng: number; ts: string }>;
  cancellationReason?: string;
  cancelledBy?: 'client' | 'driver' | 'system' | 'admin';
  lateClientCancellationFlag?: boolean;
  createdAt: string;
}

export interface DriverReview {
  id: string;
  driverId: string;
  driverName: string;
  clientName: string;
  tripType: 'urban' | 'intercity';
  tripCode: string;
  serviceType: ServiceType;
  routeSummary: string;
  stars: number;
  tags: string[];
  comment: string;
  pricePaidDzd?: number;
  distanceKm?: number;
  response?: string;
  responseAt?: string;
  identityVerified?: boolean;
  createdAt: string;
}

export interface FavoriteDriverEntry {
  id: string;
  clientId: string;
  driverId: string;
  note?: string;
  createdAt: string;
}

export interface RouteTemplate {
  id: string;
  clientId: string;
  name: string;
  mode: 'urban' | 'intercity';
  serviceType: ServiceType;
  vehicleCategory: VehicleCategory;
  wilayaCode: number;
  fromWilaya?: number;
  toWilaya?: number;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  portersCount: number;
  volumeNote: string;
  preferredDriverId?: string;
  usageCount: number;
  createdAt: string;
}

export interface EmptyReturnDeclaration {
  id: string;
  driverId: string;
  driverName: string;
  vehicleCategory: VehicleCategory;
  fromWilaya: number;
  toWilaya: number;
  departDate: string;
  availableM3: number;
  maxWeightKg: number;
  isActive: boolean;
  createdAt: string;
}

export interface Dispute {
  id: string;
  parentType: 'ride' | 'intercity_request';
  parentId: string;
  code: string;
  openedByRole: 'client' | 'driver';
  openedByName: string;
  category: DisputeCategory;
  description: string;
  status: DisputeStatus;
  resolutionNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
  createdAt: string;
}

export interface PricingRule {
  vehicleCategory: VehicleCategory;
  baseFareDzd: number;
  perKmDzd: number;
  perFloorDzd: number;
  porterUnitDzd: number;
  minPriceDzd: number;
  intercityBaseDzd: number;
  intercityPerKmDzd: number;
}

export interface AppSettings {
  /** Prix du tier Pro (ex-« abonnement chauffeur »). Le champ historique est conservé. */
  subscriptionPriceDzd: number;
  proPriceDzd: number;
  /** Modèle « visibilité » : le chauffeur gratuit reste toujours visible et recevable. */
  freeTierEnabled: boolean;
  /** Masquage dur des profils Pro expirés — DÉSACTIVÉ par défaut (décision admin future). */
  hideUnpaidProfiles: boolean;
  trialDays: number;
  graceDays: number;
  radiusKmDefault: number;
  searchTtlMinutes: number;
  capMultiplier: number;
  floorMultiplier: number;
  intercityFloorMultiplier: number;
  intercityCapMultiplier: number;
  intercityDepositRequiredAboveDzd: number;
  intercityRevisionCapPct: number;
  emptyReturnDiscountMaxPct: number;
  groupageDiscountMaxPct: number;
  ccpAccount: string;
  ccpHolder: string;
  supportPhone: string;
  directRequestEnabled: boolean;
  contactRevealAfter: 'assigned';
  chatEnabledBeforeAssignment: boolean;
  driverResponseRateMin: number;
  driverIgnoredRequestsMax: number;
  intercityDriverBlockHours: number;
}
