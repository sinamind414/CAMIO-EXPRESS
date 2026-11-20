import express from 'express';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  SESSION_COOKIE_NAME,
  createIdempotencyGuard,
  createRateLimiter,
  createSessionToken,
  getDemoOtpCode,
  getSessionFromRequest,
  parseCookies,
  verifySessionToken,
  sessionCookieHeader,
  type SessionIdentity,
} from './src/domain/security';
import { buildDriverProfile } from './src/domain/driverOnboarding';
import { canDriverReceiveRides, rankDirectory } from './src/domain/visibility';
import {
  estimateIntercityReference,
  estimateUrbanRide,
  haversineKm,
  validateIntercityQuotePrice,
  validatePriceRevision,
  validateUrbanOfferPrice,
} from './src/domain/pricing';
import {
  canTransitionUrbanRide,
  computeSubscriptionExtension,
  computeSubscriptionStatus,
  isQuoteDateCompatible,
  validateIntercityDate,
} from './src/domain/stateMachine';
import { validateReviewSubmission } from './src/domain/reviews';
import { toggleFavoriteDriver, updateFavoriteNote } from './src/domain/favorites';
import {
  AUTO_BID_RETRACT_WINDOW_MS,
  DEFAULT_AUTO_BID_CONFIG,
  evaluateAutoBidForRide,
  getOfferRetractStatus,
} from './src/domain/autoBid';
import {
  createRouteTemplate,
  incrementTemplateUsage,
  removeRouteTemplate,
  validateRouteTemplateInput,
} from './src/domain/routeTemplates';
import { computeBearingDeg } from './src/domain/tracking';
import { validateIncidentReport } from './src/domain/incidents';
import {
  canRevealIntercityContact,
  canRevealUrbanContact,
  canSendIntercityChat,
  canSendUrbanChat,
  computeDriverReactivity,
  isDriverBlockedByIntercity,
  isDriverEligibleForIntercity,
  isLateIntercityCancellation,
  recordDriverIgnoredRequest,
  recordDriverOfferResponse,
  sanitizeIntercityForApi,
  sanitizeIntercityQuoteForApi,
  sanitizeRideForApi,
  sanitizeRideOfferForApi,
} from './src/domain/compliance';
import {
  SEED_AUDIT_LOGS,
  SEED_CHATS,
  SEED_DISPUTES,
  SEED_DRIVERS,
  SEED_EMPTY_RETURNS,
  SEED_FAVORITES,
  SEED_INTERCITY,
  SEED_PAYMENTS,
  SEED_PRICING_RULES,
  SEED_REVIEWS,
  SEED_RIDES,
  SEED_ROUTE_MATRIX,
  SEED_ROUTE_TEMPLATES,
  SEED_SETTINGS,
  SEED_VOUCHERS,
  SEED_WILAYAS,
} from './src/domain/seedData';
import type {
  AppSettings,
  AuditLog,
  ChatMessage,
  Dispute,
  DriverProfile,
  DriverReview,
  EmptyReturnDeclaration,
  FavoriteDriverEntry,
  IntercityRequest,
  PricingRule,
  Ride,
  RouteMatrixEntry,
  RouteTemplate,
  ServiceType,
  SubscriptionPayment,
  VehicleCategory,
  Voucher,
  Wilaya,
} from './src/domain/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'camio-state.json');

// --- Convergences sécurité (modèle Lalamove / CDC §12) ---
const rateLimiter = createRateLimiter(60_000, 120);
const mutationLimiter = createRateLimiter(60_000, 40);
const idempotencyGuard = createIdempotencyGuard(10 * 60_000);
/** Comptes vérifiés côté serveur : le rôle n'est plus une donnée de confiance du client. */
const verifiedPhones = new Map<string, { role: 'client' | 'driver' | 'admin'; name: string }>();
const pendingOtps = new Map<string, { code: string; expiresAt: number }>();

interface AppState {
  wilayas: Wilaya[];
  routeMatrix: RouteMatrixEntry[];
  pricingRules: PricingRule[];
  settings: AppSettings;
  drivers: DriverProfile[];
  rides: Ride[];
  intercityRequests: IntercityRequest[];
  emptyReturns: EmptyReturnDeclaration[];
  payments: SubscriptionPayment[];
  vouchers: Voucher[];
  chats: ChatMessage[];
  disputes: Dispute[];
  reviews: DriverReview[];
  favorites: FavoriteDriverEntry[];
  routeTemplates: RouteTemplate[];
  auditLogs: AuditLog[];
  rideCounter: number;
  intercityCounter: number;
}

function getInitialState(): AppState {
  return {
    wilayas: structuredClone(SEED_WILAYAS),
    routeMatrix: structuredClone(SEED_ROUTE_MATRIX),
    pricingRules: structuredClone(SEED_PRICING_RULES),
    settings: structuredClone(SEED_SETTINGS),
    drivers: structuredClone(SEED_DRIVERS),
    rides: structuredClone(SEED_RIDES),
    intercityRequests: structuredClone(SEED_INTERCITY),
    emptyReturns: structuredClone(SEED_EMPTY_RETURNS),
    payments: structuredClone(SEED_PAYMENTS),
    vouchers: structuredClone(SEED_VOUCHERS),
    chats: structuredClone(SEED_CHATS),
    disputes: structuredClone(SEED_DISPUTES),
    reviews: structuredClone(SEED_REVIEWS),
    favorites: structuredClone(SEED_FAVORITES),
    routeTemplates: structuredClone(SEED_ROUTE_TEMPLATES),
    auditLogs: structuredClone(SEED_AUDIT_LOGS),
    rideCounter: 4513,
    intercityCounter: 1205,
  };
}

function loadState(): AppState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.drivers) && Array.isArray(parsed.rides)) {
        const mergedSettings: AppSettings = {
          ...structuredClone(SEED_SETTINGS),
          ...(parsed.settings ?? {}),
          // Compat arrière-plan : les anciens fichiers sans ces clés obtiennent les défauts.
          proPriceDzd: Number(parsed.settings?.proPriceDzd ?? SEED_SETTINGS.proPriceDzd),
          // Champ historique conservé mais aligné sur le prix Pro (une seule source de vérité).
          subscriptionPriceDzd: Number(parsed.settings?.proPriceDzd ?? SEED_SETTINGS.proPriceDzd),
          freeTierEnabled: parsed.settings?.freeTierEnabled ?? SEED_SETTINGS.freeTierEnabled,
          hideUnpaidProfiles: parsed.settings?.hideUnpaidProfiles ?? SEED_SETTINGS.hideUnpaidProfiles,
        };
        const normalizedDrivers = parsed.drivers.map((d) => {
          const requestsReceivedCount = Number(d.requestsReceivedCount ?? 0);
          const requestsRespondedCount = Number(d.requestsRespondedCount ?? 0);
          const ignoredRequestsStreak = Number(d.ignoredRequestsStreak ?? 0);
          const reactivity = computeDriverReactivity(
            { requestsReceivedCount, requestsRespondedCount, ignoredRequestsStreak },
            mergedSettings
          );
          return {
            ...d,
            requestsReceivedCount,
            requestsRespondedCount,
            ignoredRequestsStreak,
            responseRate: reactivity.responseRate,
            isDemotedInBroadcast: reactivity.isDemotedInBroadcast,
            autoBidConfig: d.autoBidConfig ?? structuredClone(DEFAULT_AUTO_BID_CONFIG),
          };
        });
        return {
          ...parsed,
          settings: mergedSettings,
          reviews: Array.isArray(parsed.reviews) ? parsed.reviews : structuredClone(SEED_REVIEWS),
          favorites: Array.isArray(parsed.favorites) ? parsed.favorites : structuredClone(SEED_FAVORITES),
          routeTemplates: Array.isArray(parsed.routeTemplates)
            ? parsed.routeTemplates
            : structuredClone(SEED_ROUTE_TEMPLATES),
          drivers: normalizedDrivers,
        };
      }
    }
  } catch {
    // Fallback to clean seed state if file is unreadable
  }
  return getInitialState();
}

let state: AppState = loadState();

function persistState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Non-fatal in read-only environments
  }
}

function todayIso(): string {
  // Africa/Algiers UTC+1 date string
  const now = new Date(Date.now() + 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

function addAudit(actor: string, action: string, entityType: string, entityId: string, detail: string) {
  state.auditLogs.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actor,
    action,
    entityType,
    entityId,
    detail,
    createdAt: new Date().toISOString(),
  });
  if (state.auditLogs.length > 200) {
    state.auditLogs = state.auditLogs.slice(0, 200);
  }
}

function getRule(category: VehicleCategory): PricingRule {
  return state.pricingRules.find((r) => r.vehicleCategory === category) ?? state.pricingRules[1];
}

function syncDriverSubscriptions() {
  const today = todayIso();
  for (const d of state.drivers) {
    const computed = computeSubscriptionStatus(d.subscription, today);
    d.subscription.status = computed.status;
    // Modèle visibilité : un chauffeur gratuit reste en ligne même hors période payante.
    if (!canDriverReceiveRides(d, state.settings, today)) {
      d.isOnline = false;
    }
  }
}

/** Identité authentifiée d'une requête, ou null. */
function authOf(req: express.Request): SessionIdentity | null {
  return (req as any).auth ?? null;
}

/** Middleware : exige une session valide (et optionnellement un rôle). */
function requireAuth(roles?: SessionIdentity['role'][]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const auth = authOf(req);
    if (!auth) {
      return sendError(res, 401, 'UNAUTHENTICATED', 'Session requise.', 'يلزم تسجيل الدخول.');
    }
    if (roles && !roles.includes(auth.role)) {
      return sendError(res, 403, 'FORBIDDEN', 'Rôle insuffisant.', 'غير مسموح.');
    }
    next();
  };
}

function sendError(res: express.Response, status: number, code: string, message: string, messageAr: string) {
  return res.status(status).json({
    error: {
      code,
      message,
      message_ar: messageAr,
      request_id: `req_${Date.now().toString(36)}`,
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Authentification (token signé en cookie httpOnly ou Bearer) — identité dérivée côté serveur.
  app.use('/api/v1', (req, _res, next) => {
    (req as any).auth = getSessionFromRequest(req as any);
    next();
  });

  // Limitation de débit globale + garde d'idempotence sur les mutations.
  app.use('/api/v1', (req, res, next) => {
    const key = `${req.ip ?? 'unknown'}:${req.path}`;
    const limit = req.method === 'GET' ? rateLimiter : mutationLimiter;
    const verdict = limit(key);
    if (!verdict.allowed) {
      res.setHeader('Retry-After', String(verdict.retryAfterSec));
      return sendError(res, 429, 'RATE_LIMITED', 'Trop de requêtes.', 'طلبات كثيرة جداً.');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const idem = req.header('Idempotency-Key');
      if (!idempotencyGuard(idem ?? undefined)) {
        return sendError(res, 409, 'IDEMPOTENCY_CONFLICT', 'Cette opération a déjà été traitée.', 'تم تنفيذ العملية مسبقاً.');
      }
    }
    next();
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    // Canal temps réel authentifié (les rooms sont dérivées de l'identité serveur).
    verifyClient: (info, done) => {
      try {
        const url = new URL(info.req.url ?? '/', 'http://localhost');
        const token = url.searchParams.get('token') ?? parseCookies(info.req.headers.cookie)[SESSION_COOKIE_NAME];
        const session = verifySessionToken(token);
        if (!session) return done(false, 401, 'Unauthorized');
        (info.req as any).auth = session;
        done(true);
      } catch {
        done(false, 400, 'Bad Request');
      }
    },
  });

  const clients = new Set<WebSocket>();
  function broadcast(event: string, payload: unknown) {
    const msg = JSON.stringify({ event, payload });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  function applyRidePositionUpdate(
    rideId: string,
    lat: number,
    lng: number,
    heading = 90,
    speedKmh = 32
  ) {
    const ride = state.rides.find((r) => r.id === rideId);
    if (!ride || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    const ts = new Date().toISOString();
    ride.driverLivePos = {
      lat,
      lng,
      heading: Number.isFinite(heading) ? heading : 90,
      speedKmh: Number.isFinite(speedKmh) ? speedKmh : 32,
      ts,
    };

    const existingTrail = ride.driverTrail ?? [];
    const last = existingTrail[existingTrail.length - 1];
    if (!last || Math.abs(last.lat - lat) >= 1e-6 || Math.abs(last.lng - lng) >= 1e-6) {
      const nextTrail = [...existingTrail, { lat, lng, ts }];
      ride.driverTrail = nextTrail.length > 25 ? nextTrail.slice(nextTrail.length - 25) : nextTrail;
    }

    const driver = state.drivers.find((d) => d.id === ride.driverId);
    if (driver) {
      driver.lat = lat;
      driver.lng = lng;
    }

    persistState();
    broadcast('driver.position', {
      rideId: ride.id,
      pos: ride.driverLivePos,
      trail: ride.driverTrail,
    });
    return ride.driverLivePos;
  }

  /** Applique un lot de positions (file GPS locale) en une seule écriture. */
  function applyRidePositionBatch(
    rideId: string,
    positions: Array<{ lat: number; lng: number; heading?: number; speedKmh?: number; ts?: string }>
  ) {
    const ride = state.rides.find((r) => r.id === rideId);
    if (!ride || positions.length === 0) return null;
    let lastPos: { lat: number; lng: number; heading: number; speedKmh: number; ts: string } | null = null;
    let trail = [...(ride.driverTrail ?? [])];
    for (const p of positions) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      const ts = typeof p.ts === 'string' ? p.ts : new Date().toISOString();
      lastPos = {
        lat: p.lat, lng: p.lng,
        heading: Number.isFinite(p.heading) ? Number(p.heading) : 90,
        speedKmh: Number.isFinite(p.speedKmh) ? Number(p.speedKmh) : 32,
        ts,
      };
      const previous = trail[trail.length - 1];
      if (!previous || Math.abs(previous.lat - p.lat) >= 1e-6 || Math.abs(previous.lng - p.lng) >= 1e-6) {
        trail = [...trail, { lat: p.lat, lng: p.lng, ts }].slice(-25);
      }
    }
    if (!lastPos) return null;
    ride.driverLivePos = lastPos;
    ride.driverTrail = trail;
    const driver = state.drivers.find((d) => d.id === ride.driverId);
    if (driver) { driver.lat = lastPos.lat; driver.lng = lastPos.lng; }
    persistState();
    broadcast('driver.position', { rideId: ride.id, pos: lastPos, trail });
    return lastPos;
  }

  function applyIntercityPositionUpdate(
    intercityId: string,
    lat: number,
    lng: number,
    heading = 90,
    speedKmh = 76
  ) {
    const ic = state.intercityRequests.find((r) => r.id === intercityId);
    if (!ic || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    const ts = new Date().toISOString();
    ic.driverLivePos = {
      lat,
      lng,
      heading: Number.isFinite(heading) ? heading : 90,
      speedKmh: Number.isFinite(speedKmh) ? speedKmh : 76,
      ts,
    };

    const existingTrail = ic.driverTrail ?? [];
    const last = existingTrail[existingTrail.length - 1];
    if (!last || Math.abs(last.lat - lat) >= 1e-6 || Math.abs(last.lng - lng) >= 1e-6) {
      const nextTrail = [...existingTrail, { lat, lng, ts }];
      ic.driverTrail = nextTrail.length > 30 ? nextTrail.slice(nextTrail.length - 30) : nextTrail;
    }

    if (ic.driverId) {
      const driver = state.drivers.find((d) => d.id === ic.driverId);
      if (driver) {
        driver.lat = lat;
        driver.lng = lng;
      }
    }

    persistState();
    broadcast('intercity.position', {
      intercityId: ic.id,
      pos: ic.driverLivePos,
      trail: ic.driverTrail,
    });
    return ic.driverLivePos;
  }

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    syncDriverSubscriptions();
    const session = (req as any).auth as SessionIdentity | undefined;
    // Le chauffeur associé à cette session est dérivé du téléphone vérifié, jamais du payload.
    const sessionDriver = session?.role === 'driver'
      ? state.drivers.find((d) => d.phone === session.sub)
      : undefined;
    ws.send(JSON.stringify({ event: 'connected', payload: { ts: new Date().toISOString(), role: session?.role ?? 'anonymous' } }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg?.event === 'driver.position.push' && msg?.payload?.rideId) {
          const target = state.rides.find((r) => r.id === String(msg.payload.rideId));
          if (!target || (sessionDriver && target.driverId !== sessionDriver.id)) {
            return; // un chauffeur ne publie que sa propre position
          }
          applyRidePositionUpdate(
            String(msg.payload.rideId),
            Number(msg.payload.lat),
            Number(msg.payload.lng),
            Number(msg.payload.heading ?? 90),
            Number(msg.payload.speedKmh ?? 32)
          );
        } else if (msg?.event === 'intercity.position.push' && msg?.payload?.intercityId) {
          const targetIc = state.intercityRequests.find((r) => r.id === String(msg.payload.intercityId));
          if (!targetIc || (sessionDriver && targetIc.driverId !== sessionDriver.id)) {
            return;
          }
          applyIntercityPositionUpdate(
            String(msg.payload.intercityId),
            Number(msg.payload.lat),
            Number(msg.payload.lng),
            Number(msg.payload.heading ?? 90),
            Number(msg.payload.speedKmh ?? 76)
          );
        }
      } catch {
        // Ignore invalid JSON frames
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  // OTP tracking map (in-memory for staging/demo verification)
  const otpTracker = new Map<string, { attempts: number; blockedUntil: number }>();

  app.get('/api/v1/health', (_req, res) => {
    res.json({ ok: true, service: 'camio-express-api', ts: new Date().toISOString() });
  });

  app.get('/api/v1/bootstrap', (_req, res) => {
    syncDriverSubscriptions();
    res.json({
      ...state,
      // Annuaire client : masquage optionnel + Pro devant Free (jamais le broadcast).
      drivers: rankDirectory(state.drivers, state.settings),
      rides: state.rides.map(sanitizeRideForApi),
      intercityRequests: state.intercityRequests.map(sanitizeIntercityForApi),
    });
  });

  // --- Auth OTP (§5.2) ---
  app.post('/api/v1/auth/otp/request', (req, res) => {
    const phone = String(req.body?.phone ?? '').trim();
    if (!/^\+213[567]\d{8}$/.test(phone)) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'Numéro algérien invalide (+213 5/6/7 XX XX XX XX).',
        'رقم الهاتف الجزائري غير صالح.'
      );
    }
    // Le code n'est plus renvoyé dans la réponse (CDC §12.1). En démonstration il est
    // configurable via OTP_DEMO_CODE ; en production un agrégateur SMS l'envoie au téléphone.
    pendingOtps.set(phone, { code: getDemoOtpCode(), expiresAt: Date.now() + 5 * 60_000 });
    res.json({ sent: true, expires_in: 300, retry_after: 60, method: 'sms' });
  });

  app.post('/api/v1/auth/otp/verify', (req, res) => {
    const phone = String(req.body?.phone ?? '').trim();
    const code = String(req.body?.code ?? '').trim();
    const now = Date.now();
    const rec = otpTracker.get(phone) ?? { attempts: 0, blockedUntil: 0 };

    if (rec.blockedUntil > now) {
      return sendError(
        res,
        429,
        'OTP_TOO_MANY_ATTEMPTS',
        'Trop de tentatives. Numéro bloqué 15 minutes.',
        'محاولات كثيرة جداً. تم حظر الرقم لمدة 15 دقيقة.'
      );
    }

    const pending = pendingOtps.get(phone);
    const codeValid = pending && pending.expiresAt > now && code === pending.code;
    if (!codeValid) {
      rec.attempts += 1;
      if (rec.attempts >= 5) {
        rec.blockedUntil = now + 15 * 60 * 1000;
      }
      otpTracker.set(phone, rec);
      return sendError(res, 400, 'OTP_INVALID', 'Code OTP incorrect ou expiré.', 'رمز التحقق غير صحيح أو منتهي.');
    }

    otpTracker.delete(phone);
    pendingOtps.delete(phone);

    // Le rôle est arrêté côté serveur : un client ne peut pas se déclarer admin.
    // Un numéro admin de démonstration (configurable) permet d'ouvrir le back-office.
    const adminDemoPhone = process.env.ADMIN_DEMO_PHONE ?? '+213660000000';
    const requestedRole: 'client' | 'driver' | 'admin' = phone === adminDemoPhone
      ? 'admin'
      : req.body?.role === 'driver'
      ? 'driver'
      : 'client';
    const known = verifiedPhones.get(phone);
    const identity = known ?? {
      role: requestedRole,
      name: String(req.body?.fullName || (requestedRole === 'driver' ? 'Chauffeur Camio' : 'Amine Boudiaf')),
    };
    verifiedPhones.set(phone, identity);

    const token = createSessionToken({ sub: phone, role: identity.role, name: identity.name });
    // Marqueur lisible par le JS (non sensible) : le vrai jeton reste httpOnly.
    const marker = `camio_signed_in=1; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 12}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', [sessionCookieHeader(token), marker]);
    res.json({
      verified: true,
      user: {
        id: `user-${Buffer.from(phone).toString('base64url').slice(0, 12)}`,
        phone,
        fullName: identity.name,
        role: identity.role,
      },
    });
  });

  // Session courante : identité lisible par l'UI, sans exposer le jeton signé.
  app.get('/api/v1/auth/me', (req, res) => {
    const auth = authOf(req);
    if (!auth) return res.json({ authenticated: false, user: null });
    res.json({
      authenticated: true,
      user: { id: `user-${Buffer.from(auth.sub).toString('base64url').slice(0, 12)}`, phone: auth.sub, fullName: auth.name, role: auth.role },
    });
  });

  // --- Sûreté des personnes (convergence Lalamove : Safety Center) ---
  app.post('/api/v1/safety/sos', requireAuth(), (req, res) => {
    const auth = authOf(req)!;
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const kind = String(req.body?.kind ?? 'sos');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Position requise.', 'الموقع مطلوب.');
    }
    const rideId = req.body?.rideId ? String(req.body.rideId) : undefined;
    const intercityId = req.body?.intercityId ? String(req.body.intercityId) : undefined;
    const detail = `${kind.toUpperCase()} · ${auth.role} ${auth.sub} · ${lat.toFixed(5)},${lng.toFixed(5)}${rideId ? ` · course ${rideId}` : ''}${intercityId ? ` · trajet ${intercityId}` : ''}`;
    addAudit(`safety:${auth.sub}`, 'safety.sos', 'safety', rideId ?? intercityId ?? 'global', detail);
    broadcast('safety.alert', { kind, role: auth.role, phone: auth.sub, lat, lng, rideId, intercityId, ts: new Date().toISOString() });
    broadcast('admin.updated', { type: 'safety_alert' });
    res.status(201).json({ ok: true, alertId: detail.slice(0, 60), supportPhone: state.settings.supportPhone });
  });

  // --- Urban Rides (§5.6, §5.7, §8.1) ---
  app.post('/api/v1/rides/estimate', (req, res) => {
    const body = req.body;
    const rule = getRule(body.vehicleCategory || 'medium_truck');
    const estimate = estimateUrbanRide(
      {
        serviceType: body.serviceType || 'moving',
        vehicleCategory: body.vehicleCategory || 'medium_truck',
        pickupLat: Number(body.pickupLat ?? 35.6971),
        pickupLng: Number(body.pickupLng ?? -0.6308),
        dropoffLat: body.dropoffLat != null ? Number(body.dropoffLat) : null,
        dropoffLng: body.dropoffLng != null ? Number(body.dropoffLng) : null,
        roadDistanceKm: body.roadDistanceKm ? Number(body.roadDistanceKm) : undefined,
        floorFrom: Number(body.floorFrom ?? 0),
        floorTo: body.floorTo != null ? Number(body.floorTo) : 0,
        hasElevatorFrom: Boolean(body.hasElevatorFrom),
        hasElevatorTo: Boolean(body.hasElevatorTo),
        portersCount: Number(body.portersCount ?? 0),
      },
      rule,
      state.settings
    );
    res.json(estimate);
  });

  app.post('/api/v1/rides', (req, res) => {
    const b = req.body;
    const serviceType = b.serviceType;
    const photos: string[] = Array.isArray(b.photos) ? b.photos : [];

    if ((serviceType === 'moving' || serviceType === 'waste_removal') && photos.length < 1) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'Au moins 1 photo est obligatoire pour un déménagement ou une évacuation.',
        'صورة واحدة على الأقل مطلوبة لنقل الأثاث أو إخلاء الردوم.'
      );
    }

    if (serviceType !== 'waste_removal' && (!b.dropoff || b.dropoff.lat == null)) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'L’adresse d’arrivée est obligatoire pour ce service.',
        'عنوان الوصول مطلوب لهذه الخدمة.'
      );
    }

    // Livraison moto : pas de manutentionnaires (la moto ne porte pas de meubles).
    const requestedPorters = b.vehicleCategory === 'motorcycle' ? 0 : Number(b.portersCount ?? 0);
    const rule = getRule(b.vehicleCategory || 'medium_truck');
    const est = estimateUrbanRide(
      {
        serviceType,
        vehicleCategory: b.vehicleCategory,
        pickupLat: b.pickup.lat,
        pickupLng: b.pickup.lng,
        dropoffLat: b.dropoff?.lat ?? null,
        dropoffLng: b.dropoff?.lng ?? null,
        floorFrom: Number(b.floorFrom ?? 0),
        floorTo: Number(b.floorTo ?? 0),
        hasElevatorFrom: Boolean(b.hasElevatorFrom),
        hasElevatorTo: Boolean(b.hasElevatorTo),
        portersCount: requestedPorters,
      },
      rule,
      state.settings
    );

    syncDriverSubscriptions();
    const today = todayIso();
    const eligibleDrivers = state.drivers
      .filter((d) => {
        if (d.status !== 'approved' || !d.isOnline) return false;
        if (!canDriverReceiveRides(d, state.settings, today)) return false;
        // CDC v2.1 §6.5 / T25: block drivers booked on intercity within ±intercityDriverBlockHours
        if (isDriverBlockedByIntercity(d.id, state.intercityRequests, today, state.settings).blocked) {
          return false;
        }
        const dist = haversineKm(b.pickup.lat, b.pickup.lng, d.lat, d.lng);
        return dist <= state.settings.radiusKmDefault * 2;
      })
      .sort((a, bDrv) => {
        // CDC v2.1 C12 / T37: demoted drivers are pushed to the back of broadcast ordering; zero paid ranking (C10)
        if (a.isDemotedInBroadcast !== bDrv.isDemotedInBroadcast) {
          return a.isDemotedInBroadcast ? 1 : -1;
        }
        const distA = haversineKm(b.pickup.lat, b.pickup.lng, a.lat, a.lng);
        const distB = haversineKm(b.pickup.lat, b.pickup.lng, bDrv.lat, bDrv.lng);
        return distA - distB || bDrv.ratingAvg - a.ratingAvg;
      });

    const rideCode = `LM-2026-${String(state.rideCounter++).padStart(6, '0')}`;
    const nowIso = new Date().toISOString();
    // CDC v2.1 C10 (§6.0): Modèle A (diffusion automatique) by default; direct request only when enabled in app_settings
    const preferredDriver =
      state.settings.directRequestEnabled && b.preferredDriverId
        ? state.drivers.find((d) => d.id === String(b.preferredDriverId))
        : undefined;
    const ride: Ride = {
      id: `ride-${Date.now()}`,
      rideCode,
      clientId: b.clientId || 'client-amine',
      clientName: b.clientName || 'Amine Boudiaf',
      clientPhone: b.clientPhone || '+213551889900',
      ...(preferredDriver
        ? { preferredDriverId: preferredDriver.id, preferredDriverName: preferredDriver.fullName }
        : {}),
      vehicleCategory: b.vehicleCategory,
      serviceType,
      status: 'searching',
      wilayaCode: Number(b.wilayaCode ?? 31),
      pickup: b.pickup,
      dropoff: serviceType === 'waste_removal' && !b.dropoff ? null : b.dropoff,
      distanceKm: est.distanceKm,
      floorFrom: Number(b.floorFrom ?? 0),
      floorTo: Number(b.floorTo ?? 0),
      hasElevatorFrom: Boolean(b.hasElevatorFrom),
      hasElevatorTo: Boolean(b.hasElevatorTo),
      portersCount: Number(b.portersCount ?? 0),
      hasFragileItems: Boolean(b.hasFragileItems),
      needsDisassembly: Boolean(b.needsDisassembly),
      volumeNote: String(b.volumeNote ?? ''),
      clientComment: String(b.clientComment ?? ''),
      clientBudgetDzd: b.clientBudgetDzd ? Number(b.clientBudgetDzd) : undefined,
      photos,
      hasVoiceNote: Boolean(b.hasVoiceNote),
      estimatedPriceDzd: est.estimatedPriceDzd,
      priceFloorDzd: est.priceFloorDzd,
      priceCapDzd: est.priceCapDzd,
      notifiedDriversCount: Math.max(1, eligibleDrivers.length),
      searchExpiresAt: new Date(Date.now() + state.settings.searchTtlMinutes * 60 * 1000).toISOString(),
      createdAt: nowIso,
      offers: [],
      events: [
        {
          id: `ev-${Date.now()}`,
          fromStatus: null,
          toStatus: 'searching',
          actor: 'client',
          note: `Demande publiée (${Math.max(1, eligibleDrivers.length)} chauffeurs notifiés)`,
          createdAt: nowIso,
        },
      ],
    };

    // Trigger compatible Driver Auto-Bids automatically
    for (const d of eligibleDrivers) {
      if (!d.autoBidConfig?.enabled) continue;
      const evalRes = evaluateAutoBidForRide(ride, d);
      if (!evalRes.compatible || evalRes.priceDzd == null) continue;
      const offerCreatedAt = new Date().toISOString();
      const autoOffer = sanitizeRideOfferForApi({
        id: `off-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        rideId: ride.id,
        driverId: d.id,
        driverName: d.fullName,
        driverRating: d.ratingAvg,
        driverRidesCompleted: d.ridesCompleted,
        vehicleCategory: d.vehicle.category,
        vehicleLabel: `${d.vehicle.brand} ${d.vehicle.model}`,
        plateMasked: d.vehicle.plateNumber.replace(/-\d{3}-/, '-***-'),
        priceDzd: evalRes.priceDzd,
        etaMinutes: 11,
        portersOffered: ride.portersCount,
        message: d.autoBidConfig.message || 'Offre automatique compatible',
        status: 'pending' as const,
        isAutoBid: true,
        retractableUntil: new Date(Date.now() + AUTO_BID_RETRACT_WINDOW_MS).toISOString(),
        createdAt: offerCreatedAt,
      });
      ride.offers.unshift(autoOffer);
      const updatedDriver = recordDriverOfferResponse(d, state.settings);
      Object.assign(d, updatedDriver);
      broadcast('bid.created', { rideId: ride.id, offer: autoOffer });
    }

    state.rides.unshift(ride);
    persistState();
    const safeRide = sanitizeRideForApi(ride);
    broadcast('ride.created', safeRide);
    res.status(201).json(safeRide);
  });

  // CDC v2.1 C11 / T33: Dedicated offers listing strictly without phone numbers
  app.get('/api/v1/rides/:id/offers', (req, res) => {
    const ride = state.rides.find((r) => r.id === req.params.id);
    if (!ride) return sendError(res, 404, 'NOT_FOUND', 'Course introuvable.', 'الرحلة غير موجودة.');
    res.json({
      rideId: ride.id,
      status: ride.status,
      offers: ride.offers.map(sanitizeRideOfferForApi),
    });
  });

  // CDC v2.1 C11 / T34 & T35: Contact reveal endpoint locked before `assigned`
  app.post('/api/v1/rides/:id/contact', requireAuth(), (req, res) => {
    const ride = state.rides.find((r) => r.id === req.params.id);
    if (!ride) return sendError(res, 404, 'NOT_FOUND', 'Course introuvable.', 'الرحلة غير موجودة.');
    if (!canRevealUrbanContact(ride.status)) {
      return sendError(
        res,
        403,
        'CONTACT_LOCKED',
        'Les coordonnées téléphoniques sont masquées tant qu’aucune offre n’a été acceptée.',
        'أرقام الهاتف مقفلة حتى يتم قبول أحد العروض.'
      );
    }
    const driver = state.drivers.find((d) => d.id === ride.driverId);
    const driverPhone = ride.driverPhone || driver?.phone || '';
    const clientPhone = ride.clientPhone || '';
    res.json({
      rideId: ride.id,
      status: ride.status,
      driver_phone: driverPhone,
      client_phone: clientPhone,
      driverPhone,
      clientPhone,
    });
  });

  app.post('/api/v1/rides/:id/offers', (req, res) => {
    const ride = state.rides.find((r) => r.id === req.params.id);
    if (!ride) return sendError(res, 404, 'NOT_FOUND', 'Course introuvable.', 'الرحلة غير موجودة.');
    if (ride.status !== 'searching') {
      return sendError(res, 409, 'RIDE_NOT_SEARCHING', 'La course n’est plus en recherche.', 'الرحلة لم تعد قيد البحث.');
    }

    const driver = state.drivers.find((d) => d.id === req.body.driverId);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');

    syncDriverSubscriptions();
    const today = todayIso();
    if (driver.status !== 'approved' || !canDriverReceiveRides(driver, state.settings, today)) {
      return sendError(
        res,
        403,
        'SUBSCRIPTION_EXPIRED',
        'Compte non validé ou abonnement expiré.',
        'الحساب غير مفعل أو الاشتراك منتهي.'
      );
    }

    // CDC v2.1 §6.5 / T25: block urban bids during ±intercityDriverBlockHours of a booked/active intercity trip
    const blockCheck = isDriverBlockedByIntercity(driver.id, state.intercityRequests, today, state.settings);
    if (blockCheck.blocked) {
      return sendError(
        res,
        409,
        'DRIVER_BLOCKED_INTERCITY',
        `Offres urbaines bloquées : vous avez un trajet inter-wilaya (${blockCheck.blockingTrip?.requestCode ?? ''}) dans la fenêtre ±${state.settings.intercityDriverBlockHours} h.`,
        'لا يمكنك تقديم عروض حضرية لوجود رحلة بين الولايات محجوزة في نفس الفترة.'
      );
    }

    const priceDzd = Number(req.body.priceDzd);
    const check = validateUrbanOfferPrice(priceDzd, ride.priceFloorDzd, ride.priceCapDzd);
    if (!check.valid) {
      return sendError(
        res,
        422,
        'PRICE_OUT_OF_RANGE',
        check.reason || 'Prix hors bornes.',
        'السعر المقترح خارج النطاق المسموح.'
      );
    }

    // Replace previous pending offer from same driver on this ride
    ride.offers = ride.offers.map((o) =>
      o.driverId === driver.id && o.status === 'pending' ? { ...o, status: 'withdrawn' } : o
    );

    const nowMs = Date.now();
    const offer = sanitizeRideOfferForApi({
      id: `off-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
      rideId: ride.id,
      driverId: driver.id,
      driverName: driver.fullName,
      driverRating: driver.ratingAvg,
      driverRidesCompleted: driver.ridesCompleted,
      vehicleCategory: driver.vehicle.category,
      vehicleLabel: `${driver.vehicle.brand} ${driver.vehicle.model}`,
      plateMasked: driver.vehicle.plateNumber.replace(/-\d{3}-/, '-***-'),
      priceDzd,
      etaMinutes: Number(req.body.etaMinutes ?? 12),
      portersOffered: Number(req.body.portersOffered ?? ride.portersCount),
      message: String(req.body.message ?? ''),
      status: 'pending' as const,
      isAutoBid: Boolean(req.body.isAutoBid),
      retractableUntil: new Date(nowMs + AUTO_BID_RETRACT_WINDOW_MS).toISOString(),
      createdAt: new Date(nowMs).toISOString(),
    });

    ride.offers.unshift(offer);
    const updatedDriver = recordDriverOfferResponse(driver, state.settings);
    Object.assign(driver, updatedDriver);

    persistState();
    broadcast('bid.created', { rideId: ride.id, offer });
    res.status(201).json(offer);
  });

  app.post('/api/v1/rides/:id/offers/:offerId/retract', (req, res) => {
    const ride = state.rides.find((r) => r.id === req.params.id);
    if (!ride) return sendError(res, 404, 'NOT_FOUND', 'Course introuvable.', 'الرحلة غير موجودة.');
    const offer = ride.offers.find((o) => o.id === req.params.offerId);
    if (!offer) return sendError(res, 404, 'NOT_FOUND', 'Offre introuvable.', 'العرض غير موجود.');
    if (req.body?.driverId && offer.driverId !== String(req.body.driverId)) {
      return sendError(res, 403, 'FORBIDDEN', 'Action réservée à l’auteur de l’offre.', 'غير مسموح.');
    }
    const retractStatus = getOfferRetractStatus(offer, Date.now());
    if (!retractStatus.canRetract) {
      return sendError(
        res,
        409,
        'RETRACT_WINDOW_EXPIRED',
        'Le délai de rétractation de 3 minutes est dépassé.',
        'انقضت مهلة السحب البالغة 3 دقائق.'
      );
    }
    offer.status = 'withdrawn';
    persistState();
    broadcast('bid.withdrawn', { rideId: ride.id, offer });
    res.json({ offer, ride });
  });

  app.post('/api/v1/rides/:id/accept-bid', (req, res) => {
    const ride = state.rides.find((r) => r.id === req.params.id);
    if (!ride) return sendError(res, 404, 'NOT_FOUND', 'Course introuvable.', 'الرحلة غير موجودة.');
    if (ride.status !== 'searching') {
      return sendError(res, 409, 'RIDE_ALREADY_ASSIGNED', 'Cette course a déjà été attribuée.', 'تم إسناد هذه الرحلة بالفعل.');
    }

    const offer = ride.offers.find((o) => o.id === req.body.offerId && o.status === 'pending');
    if (!offer) {
      return sendError(res, 409, 'OFFER_EXPIRED', 'Offre expirée ou indisponible.', 'العرض منتهي الصلاحية.');
    }

    const driver = state.drivers.find((d) => d.id === offer.driverId);
    const nowIso = new Date().toISOString();

    ride.status = 'assigned';
    ride.driverId = offer.driverId;
    ride.driverName = offer.driverName;
    ride.driverPhone = driver?.phone ?? '+213661000000';
    ride.finalAgreedPriceDzd = offer.priceDzd;
    const initialLat = driver?.lat ?? ride.pickup.lat + 0.006;
    const initialLng = driver?.lng ?? ride.pickup.lng + 0.005;
    ride.driverLivePos = {
      lat: initialLat,
      lng: initialLng,
      heading: 220,
      speedKmh: 34,
      ts: nowIso,
    };
    ride.driverTrail = [{ lat: initialLat, lng: initialLng, ts: nowIso }];
    ride.offers = ride.offers.map((o) =>
      o.id === offer.id ? { ...o, status: 'accepted' } : o.status === 'pending' ? { ...o, status: 'rejected' } : o
    );
    ride.events.push({
      id: `ev-${Date.now()}`,
      fromStatus: 'searching',
      toStatus: 'assigned',
      actor: 'client',
      note: `Offre acceptée : ${offer.driverName} (${offer.priceDzd} DA)`,
      createdAt: nowIso,
    });

    persistState();
    broadcast('bid.accepted', { rideId: ride.id, ride });
    res.json({ ride });
  });

  app.patch('/api/v1/rides/:id/status', (req, res) => {
    const ride = state.rides.find((r) => r.id === req.params.id);
    if (!ride) return sendError(res, 404, 'NOT_FOUND', 'Course introuvable.', 'الرحلة غير موجودة.');

    const toStatus = req.body.toStatus;
    const actor = req.body.actor || 'driver';
    const driver = state.drivers.find((d) => d.id === ride.driverId);
    const driverPos = req.body.lat != null && req.body.lng != null
      ? { lat: Number(req.body.lat), lng: Number(req.body.lng) }
      : driver
      ? { lat: driver.lat, lng: driver.lng }
      : undefined;

    const check = canTransitionUrbanRide({
      from: ride.status,
      to: toStatus,
      actor,
      driverPos,
      pickupPos: { lat: ride.pickup.lat, lng: ride.pickup.lng },
      dropoffPos: ride.dropoff ? { lat: ride.dropoff.lat, lng: ride.dropoff.lng } : null,
      hasDropoff: Boolean(ride.dropoff),
    });

    if (!check.ok) {
      return sendError(
        res,
        check.code === 'TOO_FAR_FROM_POINT' ? 422 : 409,
        check.code || 'INVALID_TRANSITION',
        check.message || 'Transition impossible.',
        'تعذر تغيير حالة الرحلة.'
      );
    }

    const fromStatus = ride.status;
    const nowIso = new Date().toISOString();
    ride.status = toStatus;
    if (toStatus === 'loading') ride.loadingStartedAt = nowIso;
    if (toStatus === 'completed') {
      ride.completedAt = nowIso;
      if (driver) driver.ridesCompleted += 1;
      // Preuve de livraison (Lalamove proofOfDelivery) — photo data URL fournie par le chauffeur.
      const pod = req.body.proofOfDelivery;
      if (pod && typeof pod.photoDataUrl === 'string' && pod.photoDataUrl.startsWith('data:image/') && pod.photoDataUrl.length <= 1_500_000) {
        ride.proofOfDelivery = {
          photoDataUrl: pod.photoDataUrl,
          capturedAt: nowIso,
          lat: Number.isFinite(Number(pod.lat)) ? Number(pod.lat) : undefined,
          lng: Number.isFinite(Number(pod.lng)) ? Number(pod.lng) : undefined,
          note: typeof pod.note === 'string' ? pod.note.slice(0, 300) : undefined,
        };
        addAudit(driver?.fullName ?? 'system', 'ride.proof_of_delivery', 'ride', ride.id, `${ride.rideCode} : preuve photo enregistrée`);
      }
    }
    if (toStatus === 'cancelled_driver' && driver) {
      driver.ridesCancelled += 1;
      ride.cancelledBy = 'driver';
      ride.cancellationReason = String(req.body.reason || 'Annulation chauffeur');
    }

    ride.events.push({
      id: `ev-${Date.now()}`,
      fromStatus,
      toStatus,
      actor,
      note: req.body.note,
      createdAt: nowIso,
    });

    if (actor === 'admin') {
      addAudit('admin@camio.dz', 'ride.force_status', 'ride', ride.id, `${ride.rideCode}: ${fromStatus} → ${toStatus}`);
    }

    persistState();
    broadcast('ride.status.changed', { rideId: ride.id, ride });
    res.json({ ride });
  });

  app.post('/api/v1/rides/:id/position/batch', (req, res) => {
    const positions = Array.isArray(req.body?.positions) ? req.body.positions : [];
    if (positions.length === 0 || positions.length > 200) {
      return sendError(res, 400, 'VALIDATION_ERROR', '1 à 200 positions requises.', 'مطلوب من 1 إلى 200 موقع.');
    }
    const pos = applyRidePositionBatch(req.params.id, positions);
    if (!pos) return sendError(res, 404, 'NOT_FOUND', 'Course introuvable.', 'الرحلة غير موجودة.');
    res.json({ ok: true, pos, applied: positions.length });
  });

  app.post('/api/v1/rides/:id/position', (req, res) => {
    const pos = applyRidePositionUpdate(
      req.params.id,
      Number(req.body.lat),
      Number(req.body.lng),
      Number(req.body.heading ?? 90),
      Number(req.body.speedKmh ?? 32)
    );
    if (!pos) return sendError(res, 404, 'NOT_FOUND', 'Course introuvable ou coordonnées invalides.', 'الرحلة غير موجودة.');
    res.json({ ok: true, pos });
  });

  app.post('/api/v1/rides/:id/cancel', (req, res) => {
    const ride = state.rides.find((r) => r.id === req.params.id);
    if (!ride) return sendError(res, 404, 'NOT_FOUND', 'Course introuvable.', 'الرحلة غير موجودة.');

    const check = canTransitionUrbanRide({
      from: ride.status,
      to: 'cancelled_client',
      actor: 'client',
    });
    if (!check.ok) {
      return sendError(res, 409, check.code || 'CANCELLATION_LOCKED', check.message || 'Annulation bloquée.', 'لا يمكن الإلغاء بعد بدء الشحن.');
    }

    const prev = ride.status;
    ride.status = 'cancelled_client';
    ride.cancelledBy = 'client';
    ride.cancellationReason = String(req.body.reason || 'Annulée par le client');
    ride.offers = ride.offers.map((o) => (o.status === 'pending' ? { ...o, status: 'rejected' } : o));
    ride.events.push({
      id: `ev-${Date.now()}`,
      fromStatus: prev,
      toStatus: 'cancelled_client',
      actor: 'client',
      note: ride.cancellationReason,
      createdAt: new Date().toISOString(),
    });

    persistState();
    const safeRide = sanitizeRideForApi(ride);
    broadcast('ride.status.changed', { rideId: ride.id, ride: safeRide });
    res.json({ ride: safeRide });
  });

  app.post('/api/v1/rides/:id/rating', requireAuth(['client']), (req, res) => {
    const ride = state.rides.find((r) => r.id === req.params.id);
    if (!ride) return sendError(res, 404, 'NOT_FOUND', 'Course introuvable.', 'الرحلة غير موجودة.');
    if (ride.status === 'rated') {
      return sendError(res, 400, 'ALREADY_RATED', 'Cette course a déjà été notée.', 'تم تقييم هذه الرحلة مسبقاً.');
    }
    if (ride.status !== 'completed') {
      return sendError(
        res,
        400,
        'RIDE_NOT_COMPLETED',
        'La notation est disponible uniquement après la finalisation du trajet.',
        'التقييم متاح فقط بعد إنهاء الرحلة.'
      );
    }

    const validation = validateReviewSubmission({
      stars: Number(req.body.stars ?? 5),
      tags: req.body.tags,
      comment: req.body.comment,
    });
    if (!validation.valid) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        validation.reasonFr ?? 'Avis invalide.',
        validation.reasonAr ?? 'تقييم غير صالح.'
      );
    }

    const ratedAt = new Date().toISOString();
    ride.rating = {
      stars: validation.stars,
      tags: validation.tags,
      comment: validation.comment,
      ratedAt,
    };
    ride.status = 'rated';
    ride.events.push({
      id: `ev-${Date.now()}`,
      fromStatus: 'completed',
      toStatus: 'rated',
      actor: 'client',
      note: `Note attribuée : ${validation.stars}/5`,
      createdAt: ratedAt,
    });

    const driver = state.drivers.find((d) => d.id === ride.driverId);
    if (driver) {
      const total = driver.ratingAvg * driver.ratingsCount + validation.stars;
      driver.ratingsCount += 1;
      driver.ratingAvg = Number((total / driver.ratingsCount).toFixed(2));
    }

    let createdReview: DriverReview | undefined;
    if (ride.driverId) {
      createdReview = {
        id: `rev-${Date.now()}`,
        driverId: ride.driverId,
        driverName: ride.driverName ?? driver?.fullName ?? 'Chauffeur',
        clientName: ride.clientName,
        tripType: 'urban',
        tripCode: ride.rideCode,
        serviceType: ride.serviceType,
        routeSummary: ride.dropoff
          ? `${ride.pickup.address} → ${ride.dropoff.address}`
          : ride.pickup.address,
        stars: validation.stars,
        tags: validation.tags,
        comment: validation.comment,
        pricePaidDzd: Number.isFinite(Number(req.body.pricePaidDzd)) && Number(req.body.pricePaidDzd) > 0
          ? Number(req.body.pricePaidDzd) : ride.finalAgreedPriceDzd,
        distanceKm: Number.isFinite(Number(req.body.distanceKm)) && Number(req.body.distanceKm) > 0
          ? Number(req.body.distanceKm) : ride.distanceKm,
        identityVerified: driver?.status === 'approved',
        createdAt: ratedAt,
      };
      state.reviews.unshift(createdReview);
    }

    persistState();
    broadcast('ride.rated', { rideId: ride.id, ride, review: createdReview });
    res.json({ ride, review: createdReview });
  });

  // --- Client Favorite Drivers ---
  /** Réponse du chauffeur à un avis reçu (gestion de réputation, modèle Bricoram). */
  app.post('/api/v1/reviews/:id/respond', requireAuth(['driver']), (req, res) => {
    const review = state.reviews.find((r) => r.id === req.params.id);
    if (!review) return sendError(res, 404, 'NOT_FOUND', 'Avis introuvable.', 'الرأي غير موجود.');
    const auth = authOf(req)!;
    const driver = state.drivers.find((d) => d.phone === auth.sub || d.id === auth.sub);
    if (!driver || review.driverId !== driver.id) {
      return sendError(res, 403, 'FORBIDDEN', 'Réponse réservée au chauffeur concerné.', 'غير مسموح.');
    }
    const text = String(req.body?.response ?? '').trim().slice(0, 500);
    if (!text) return sendError(res, 400, 'VALIDATION_ERROR', 'Réponse vide.', 'الرد فارغ.');
    review.response = text;
    review.responseAt = new Date().toISOString();
    persistState();
    broadcast('driver.updated', driver);
    res.json({ review });
  });

  app.post('/api/v1/favorites/toggle', (req, res) => {
    const driverId = String(req.body?.driverId ?? '').trim();
    const driver = state.drivers.find((d) => d.id === driverId);
    if (!driver) {
      return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');
    }
    const result = toggleFavoriteDriver(state.favorites, {
      driverId,
      clientId: req.body?.clientId ? String(req.body.clientId) : undefined,
      note: req.body?.note ? String(req.body.note) : undefined,
    });
    state.favorites = result.next;
    persistState();
    broadcast('favorite.updated', {
      added: result.added,
      driverId: driver.id,
      driverName: driver.fullName,
      favorites: state.favorites,
    });
    res.json({ added: result.added, entry: result.entry ?? null, favorites: state.favorites });
  });

  app.patch('/api/v1/favorites/:driverId/note', (req, res) => {
    const driverId = String(req.params.driverId ?? '').trim();
    const driver = state.drivers.find((d) => d.id === driverId);
    if (!driver) {
      return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');
    }
    state.favorites = updateFavoriteNote(state.favorites, {
      driverId,
      clientId: req.body?.clientId ? String(req.body.clientId) : undefined,
      note: String(req.body?.note ?? ''),
    });
    persistState();
    res.json({ favorites: state.favorites });
  });

  // --- Client Saved Route Templates (1-click repeatable B2B / personal routes) ---
  app.post('/api/v1/route-templates', (req, res) => {
    const b = req.body ?? {};
    const input = {
      clientId: b.clientId ? String(b.clientId) : 'client-amine',
      name: String(b.name ?? ''),
      mode: b.mode === 'intercity' ? ('intercity' as const) : ('urban' as const),
      serviceType: (b.serviceType || 'moving') as ServiceType,
    vehicleCategory: (b.vehicleCategory || 'medium_truck') as VehicleCategory,
      wilayaCode: Number(b.wilayaCode ?? 31),
      fromWilaya: b.fromWilaya != null ? Number(b.fromWilaya) : undefined,
      toWilaya: b.toWilaya != null ? Number(b.toWilaya) : undefined,
      pickupAddress: String(b.pickupAddress ?? ''),
      dropoffAddress: String(b.dropoffAddress ?? ''),
      pickupLat: b.pickupLat != null ? Number(b.pickupLat) : undefined,
      pickupLng: b.pickupLng != null ? Number(b.pickupLng) : undefined,
      dropoffLat: b.dropoffLat != null ? Number(b.dropoffLat) : undefined,
      dropoffLng: b.dropoffLng != null ? Number(b.dropoffLng) : undefined,
      portersCount: Number(b.portersCount ?? 0),
      volumeNote: String(b.volumeNote ?? ''),
      preferredDriverId: b.preferredDriverId ? String(b.preferredDriverId) : undefined,
    };
    const check = validateRouteTemplateInput(input);
    if (!check.valid) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        check.reasonFr ?? 'Modèle invalide.',
        check.reasonAr ?? 'نموذج غير صالح.'
      );
    }
    const created = createRouteTemplate(input);
    state.routeTemplates.unshift(created);
    persistState();
    res.status(201).json({ template: created, routeTemplates: state.routeTemplates });
  });

  app.post('/api/v1/route-templates/:id/use', (req, res) => {
    const existing = state.routeTemplates.find((t) => t.id === req.params.id);
    if (!existing) {
      return sendError(res, 404, 'NOT_FOUND', 'Modèle introuvable.', 'النموذج غير موجود.');
    }
    state.routeTemplates = incrementTemplateUsage(state.routeTemplates, existing.id);
    persistState();
    const updated = state.routeTemplates.find((t) => t.id === existing.id);
    res.json({ template: updated, routeTemplates: state.routeTemplates });
  });

  app.delete('/api/v1/route-templates/:id', (req, res) => {
    state.routeTemplates = removeRouteTemplate(state.routeTemplates, req.params.id);
    persistState();
    res.json({ ok: true, routeTemplates: state.routeTemplates });
  });

  // --- Chat & Disputes (CDC v2.1 C11 / T36) ---
  app.post('/api/v1/chats', (req, res) => {
    const parentType: 'ride' | 'intercity_request' =
      req.body.parentType === 'intercity_request' ? 'intercity_request' : 'ride';
    const parentId = String(req.body.parentId ?? '').trim();

    if (parentType === 'ride') {
      const ride = state.rides.find((r) => r.id === parentId);
      if (!ride) {
        return sendError(res, 404, 'NOT_FOUND', 'Course introuvable.', 'الرحلة غير موجودة.');
      }
      if (!canSendUrbanChat(ride.status, state.settings)) {
        return sendError(
          res,
          403,
          'CHAT_LOCKED',
          'La messagerie est verrouillée avant l’acceptation d’une offre.',
          'المحادثة مقفلة قبل قبول أحد العروض.'
        );
      }
    } else {
      const ic = state.intercityRequests.find((r) => r.id === parentId);
      if (!ic) {
        return sendError(res, 404, 'NOT_FOUND', 'Trajet inter-wilaya introuvable.', 'الرحلة بين الولايات غير موجودة.');
      }
      if (!canSendIntercityChat(ic.status, state.settings)) {
        return sendError(
          res,
          403,
          'CHAT_LOCKED',
          'La messagerie inter-wilaya est verrouillée avant la réservation d’un devis.',
          'المحادثة مقفلة قبل تأكيد حجز أحد العروض.'
        );
      }
    }

    const msg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      parentType,
      parentId,
      senderRole: req.body.senderRole || 'client',
      senderName: req.body.senderName || 'Client',
      kind: req.body.kind || 'text',
      body: String(req.body.body ?? '').trim(),
      durationSec: req.body.durationSec ? Number(req.body.durationSec) : undefined,
      createdAt: new Date().toISOString(),
    };
    if (!msg.body) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Message vide.', 'الرسالة فارغة.');
    }
    state.chats.push(msg);
    persistState();
    broadcast('chat.message', msg);
    res.status(201).json(msg);
  });

  app.post('/api/v1/disputes', (req, res) => {
    const parentType = req.body.parentType === 'intercity_request' ? 'intercity_request' : 'ride';
    const check = validateIncidentReport({
      parentId: req.body.parentId,
      parentType,
      category: req.body.category || 'other',
      description: req.body.description,
    });
    if (!check.valid) {
      return sendError(
        res,
        422,
        'VALIDATION_ERROR',
        check.reasonFr || 'Données de signalement invalides.',
        check.reasonAr || 'بيانات البلاغ غير صالحة.'
      );
    }

    const parentId = String(req.body.parentId).trim();
    const targetRide = parentType === 'ride' ? state.rides.find((x) => x.id === parentId) : undefined;
    const targetIc =
      parentType === 'intercity_request' ? state.intercityRequests.find((x) => x.id === parentId) : undefined;

    if (!targetRide && !targetIc) {
      return sendError(res, 404, 'NOT_FOUND', 'Trajet introuvable pour ce signalement.', 'الرحلة غير موجودة.');
    }

    const nowIso = new Date().toISOString();
    const resolvedCode =
      String(req.body.code || '').trim() || targetRide?.rideCode || targetIc?.requestCode || 'LM-2026';
    const openedByRole = req.body.openedByRole === 'driver' ? 'driver' : 'client';
    const openedByName = String(req.body.openedByName || 'Amine Boudiaf').trim() || 'Amine Boudiaf';

    const dispute: Dispute = {
      id: `disp-${Date.now()}`,
      parentType,
      parentId,
      code: resolvedCode,
      openedByRole,
      openedByName,
      category: check.category,
      description: check.description,
      status: 'open',
      createdAt: nowIso,
    };
    state.disputes.unshift(dispute);

    if (targetRide) {
      const prevStatus = targetRide.status;
      targetRide.status = 'disputed';
      targetRide.events.push({
        id: `ev-${Date.now()}`,
        fromStatus: prevStatus,
        toStatus: 'disputed',
        actor: openedByRole,
        note: `Incident signalé (${check.category}) : ${check.description.slice(0, 90)}`,
        createdAt: nowIso,
      });
      broadcast('ride.updated', targetRide);
    } else if (targetIc) {
      const prevStatus = targetIc.status;
      targetIc.status = 'disputed';
      targetIc.events.push({
        id: `icev-${Date.now()}`,
        fromStatus: prevStatus,
        toStatus: 'disputed',
        actor: openedByRole,
        note: `Incident signalé (${check.category}) : ${check.description.slice(0, 90)}`,
        createdAt: nowIso,
      });
      broadcast('intercity.updated', targetIc);
    }

    addAudit(
      openedByRole === 'driver' ? 'driver@camio.dz' : 'client@camio.dz',
      'dispute.opened',
      'dispute',
      dispute.id,
      `${resolvedCode} (${check.category}): ${check.description.slice(0, 80)}`
    );
    persistState();
    broadcast('admin.updated', { type: 'dispute' });
    res.status(201).json(dispute);
  });

  // --- Driver Module (§5.4, §5.5, §5.8, §10) ---
  app.post('/api/v1/driver/:id/availability', requireAuth(['driver']), (req, res) => {
    const driver = state.drivers.find((d) => d.id === req.params.id);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');

    const wantOnline = Boolean(req.body.isOnline);
    if (wantOnline) {
      if (driver.status !== 'approved') {
        return sendError(
          res,
          403,
          'DRIVER_NOT_APPROVED',
          'Votre dossier KYC doit être validé par l’administration.',
          'يجب اعتماد ملفك أولاً من طرف الإدارة.'
        );
      }
      syncDriverSubscriptions();
      if (!canDriverReceiveRides(driver, state.settings, todayIso())) {
        return sendError(
          res,
          403,
          'SUBSCRIPTION_EXPIRED',
          'Votre abonnement a expiré. Renouvelez pour recevoir des courses.',
          'انتهى اشتراكك. يرجى التجديد لاستقبال الطلبات.'
        );
      }
      const blockCheck = isDriverBlockedByIntercity(driver.id, state.intercityRequests, todayIso(), state.settings);
      if (blockCheck.blocked) {
        return sendError(
          res,
          409,
          'DRIVER_BLOCKED_INTERCITY',
          `Vous avez un trajet inter-wilaya planifié (${blockCheck.blockingTrip?.requestCode ?? ''}) dans la fenêtre ±${state.settings.intercityDriverBlockHours} h.`,
          'لديك رحلة مبرمجة بين الولايات في نفس الفترة.'
        );
      }
    }

    driver.isOnline = wantOnline;
    persistState();
    broadcast('driver.updated', driver);
    res.json({ driver });
  });

  // CDC v2.1 C12 / T37: Track ignored ride requests and demote unresponsive drivers
  app.post('/api/v1/driver/:id/ignore-ride', (req, res) => {
    const driver = state.drivers.find((d) => d.id === req.params.id);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');

    const wasDemoted = driver.isDemotedInBroadcast;
    const updated = recordDriverIgnoredRequest(driver, state.settings);
    Object.assign(driver, updated);

    if (!wasDemoted && driver.isDemotedInBroadcast) {
      addAudit(
        'system',
        'driver.reactivity_demoted',
        'driver',
        driver.id,
        `${driver.fullName} rétrogradé en diffusion (${driver.ignoredRequestsStreak} ignorées, taux ${Math.round(driver.responseRate * 100)} %)`
      );
      broadcast('admin.updated', { type: 'reactivity_alert', driverId: driver.id });
    }

    persistState();
    broadcast('driver.updated', driver);
    res.json({ driver });
  });

  app.put('/api/v1/driver/:id/auto-bid', (req, res) => {
    const driver = state.drivers.find((d) => d.id === req.params.id);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');

    const b = req.body ?? {};
    const ratePerKmDzd = Number(b.ratePerKmDzd ?? 1400);
    const minFloorPriceDzd = Number(b.minFloorPriceDzd ?? 10000);
    const maxDistanceKm = Math.max(5, Math.min(200, Number(b.maxDistanceKm ?? 30)));
    const serviceTypes: ServiceType[] = Array.isArray(b.serviceTypes) && b.serviceTypes.length > 0
      ? b.serviceTypes
      : ['moving', 'freight'];

    if (!Number.isFinite(ratePerKmDzd) || ratePerKmDzd < 100 || !Number.isFinite(minFloorPriceDzd) || minFloorPriceDzd < 1000) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'Tarif/km (≥ 100 DA) et plancher minimum (≥ 1 000 DA) invalides.',
        'تعريفة الكيلومتر والسعر الأدنى غير صالحين.'
      );
    }

    driver.autoBidConfig = {
      enabled: Boolean(b.enabled),
      ratePerKmDzd: Math.round(ratePerKmDzd),
      minFloorPriceDzd: Math.round(minFloorPriceDzd),
      maxDistanceKm,
      serviceTypes,
      acceptSmallerLoads: b.acceptSmallerLoads !== undefined ? Boolean(b.acceptSmallerLoads) : true,
      message: String(b.message ?? 'Offre automatique · Disponible immédiatement').trim(),
    };

    const autoBidsCreated: unknown[] = [];
    syncDriverSubscriptions();
    const today = todayIso();
    const blockedByIc = isDriverBlockedByIntercity(driver.id, state.intercityRequests, today, state.settings).blocked;
    if (
      driver.autoBidConfig.enabled &&
      driver.status === 'approved' &&
      driver.isOnline &&
      canDriverReceiveRides(driver, state.settings, today) &&
      !blockedByIc
    ) {
      for (const ride of state.rides) {
        if (ride.status !== 'searching') continue;
        const hasPending = ride.offers.some((o) => o.driverId === driver.id && o.status === 'pending');
        if (hasPending) continue;
        const evalRes = evaluateAutoBidForRide(ride, driver);
        if (!evalRes.compatible || evalRes.priceDzd == null) continue;
        const nowMs = Date.now();
        const offer = sanitizeRideOfferForApi({
          id: `off-auto-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
          rideId: ride.id,
          driverId: driver.id,
          driverName: driver.fullName,
          driverRating: driver.ratingAvg,
          driverRidesCompleted: driver.ridesCompleted,
          vehicleCategory: driver.vehicle.category,
          vehicleLabel: `${driver.vehicle.brand} ${driver.vehicle.model}`,
          plateMasked: driver.vehicle.plateNumber.replace(/-\d{3}-/, '-***-'),
          priceDzd: evalRes.priceDzd,
          etaMinutes: 11,
          portersOffered: ride.portersCount,
          message: driver.autoBidConfig.message || 'Offre automatique compatible',
          status: 'pending' as const,
          isAutoBid: true,
          retractableUntil: new Date(nowMs + AUTO_BID_RETRACT_WINDOW_MS).toISOString(),
          createdAt: new Date(nowMs).toISOString(),
        });
        ride.offers.unshift(offer);
        const updatedDriver = recordDriverOfferResponse(driver, state.settings);
        Object.assign(driver, updatedDriver);
        autoBidsCreated.push(offer);
        broadcast('bid.created', { rideId: ride.id, offer });
      }
    }

    persistState();
    broadcast('driver.updated', driver);
    res.json({ driver, autoBidsCreatedCount: autoBidsCreated.length });
  });

  app.post('/api/v1/driver/signup', (req, res) => {
    const phone = String(req.body?.phone ?? '').trim();
    if (!/^\+213[567]\d{8}$/.test(phone)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Numéro algérien invalide (+213 5/6/7 XX XX XX XX).', 'رقم الهاتف الجزائري غير صالح.');
    }
    if (state.drivers.some((d) => d.phone === phone)) {
      return sendError(res, 409, 'DRIVER_ALREADY_EXISTS', 'Ce numéro est déjà inscrit comme chauffeur.', 'هذا الرقم مسجل كسائق.');
    }
    const wilayaCode = Number(req.body?.wilayaCode ?? 31);
    const category = String(req.body?.vehicleCategory ?? 'van');
    const docs = Array.isArray(req.body?.documents) ? req.body.documents : [];
    const profile = buildDriverProfile(
      {
        phone,
        fullName: String(req.body?.fullName ?? ''),
        wilayaCode,
        vehicleCategory: category as VehicleCategory,
        brand: String(req.body?.brand ?? ''),
        model: String(req.body?.model ?? ''),
        plateNumber: String(req.body?.plateNumber ?? ''),
        documents: docs,
      },
      state.settings
    );
    state.drivers.unshift(profile);
    persistState();
    broadcast('admin.updated', { type: 'driver_signup', driverId: profile.id });
    res.status(201).json({ driver: profile });
  });

  app.post('/api/v1/driver/:id/documents/submit', requireAuth(['driver']), (req, res) => {
    const driver = state.drivers.find((d) => d.id === req.params.id);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');
    if (driver.documents.length < 5) {
      return sendError(res, 422, 'DOSSIER_INCOMPLET', '5 documents obligatoires requis (dont le selfie).', '5 وثائق إلزامية مطلوبة (بما فيها السيلفي).');
    }
    driver.status = 'pending_review';
    persistState();
    broadcast('admin.updated', { type: 'driver_submit' });
    res.json({ driver });
  });

  app.post('/api/v1/driver/:id/subscription/payments', requireAuth(['driver']), (req, res) => {
    const driver = state.drivers.find((d) => d.id === req.params.id);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');

    const pending = state.payments.find((p) => p.driverId === driver.id && p.status === 'pending');
    if (pending) {
      return sendError(
        res,
        409,
        'PAYMENT_ALREADY_PENDING',
        'Un justificatif est déjà en attente de validation.',
        'يوجد إيصال قيد المراجعة بالفعل.'
      );
    }

    const reference = String(req.body.reference ?? '').trim();
    const amountDzd = Number(req.body.amountDzd ?? state.settings.subscriptionPriceDzd);
    if (!reference || amountDzd < state.settings.subscriptionPriceDzd) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        `Référence requise et montant minimum de ${state.settings.subscriptionPriceDzd} DA.`,
        'رقم المرجع والمبلغ الصحيح مطلوبان.'
      );
    }

    const payment: SubscriptionPayment = {
      id: `pay-${Date.now()}`,
      driverId: driver.id,
      driverName: driver.fullName,
      method: req.body.method === 'ccp' ? 'ccp' : 'baridimob',
      amountDzd,
      status: 'pending',
      reference,
      proofLabel: String(req.body.proofLabel || `recu_${reference}.jpg`),
      proofHash: `hash_${reference.toLowerCase()}`,
      submittedAt: new Date().toISOString(),
      periodDays: 30,
    };

    state.payments.unshift(payment);
    persistState();
    broadcast('subscription.updated', { driverId: driver.id, payment });
    res.status(201).json({ payment });
  });

  app.post('/api/v1/driver/:id/subscription/redeem', (req, res) => {
    const driver = state.drivers.find((d) => d.id === req.params.id);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');

    const code = String(req.body.code ?? '').trim().toUpperCase();
    const voucher = state.vouchers.find((v) => v.code === code);
    if (!voucher) {
      return sendError(res, 404, 'VOUCHER_NOT_FOUND', 'Code voucher introuvable.', 'رمز التعبئة غير موجود.');
    }
    if (voucher.uses >= voucher.maxUses) {
      return sendError(res, 409, 'VOUCHER_ALREADY_USED', 'Ce voucher a déjà été utilisé.', 'تم استخدام هذا الرمز مسبقاً.');
    }
    const today = todayIso();
    if (voucher.validUntil < today) {
      return sendError(res, 410, 'VOUCHER_EXPIRED', 'Ce voucher a expiré.', 'انتهت صلاحية هذا الرمز.');
    }

    voucher.uses += 1;
    const ext = computeSubscriptionExtension(driver.subscription.endsOn, voucher.periodDays, today, state.settings.graceDays);
    driver.subscription = {
      ...driver.subscription,
      kind: 'paid',
      status: 'active',
      startsOn: ext.startsOn,
      endsOn: ext.endsOn,
      graceUntil: ext.graceUntil,
      amountDzd: state.settings.subscriptionPriceDzd,
    };

    state.payments.unshift({
      id: `pay-v-${Date.now()}`,
      driverId: driver.id,
      driverName: driver.fullName,
      method: 'voucher',
      amountDzd: state.settings.subscriptionPriceDzd,
      status: 'approved',
      reference: voucher.code,
      proofLabel: `Voucher ${voucher.code}`,
      proofHash: voucher.code,
      submittedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      periodDays: voucher.periodDays,
    });
    addAudit(driver.fullName, 'voucher.redeem', 'voucher', driver.id, `Code ${voucher.code} → +${voucher.periodDays} j (fin ${ext.endsOn})`);

    persistState();
    broadcast('subscription.updated', { driverId: driver.id, subscription: driver.subscription });
    res.json({ subscription: driver.subscription, driver });
  });

  app.post('/api/v1/driver/:id/coverage', (req, res) => {
    const driver = state.drivers.find((d) => d.id === req.params.id);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');
    const fromWilaya = Number(req.body.fromWilaya);
    const toWilaya = req.body.toWilaya != null && req.body.toWilaya !== '' ? Number(req.body.toWilaya) : null;
    const exists = driver.coverageAxes.some((a) => a.fromWilaya === fromWilaya && a.toWilaya === toWilaya);
    if (!exists) {
      driver.coverageAxes.push({ fromWilaya, toWilaya });
    }
    persistState();
    broadcast('driver.updated', driver);
    res.json({ driver });
  });

  app.post('/api/v1/driver/:id/empty-returns', (req, res) => {
    const driver = state.drivers.find((d) => d.id === req.params.id);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');

    const fromWilaya = Number(req.body.fromWilaya);
    const toWilaya = Number(req.body.toWilaya);
    if (fromWilaya === toWilaya) {
      return sendError(res, 422, 'SAME_WILAYA', 'Départ et arrivée doivent être différents.', 'الولايتان متطابقتان.');
    }

    const decl: EmptyReturnDeclaration = {
      id: `er-${Date.now()}`,
      driverId: driver.id,
      driverName: driver.fullName,
      vehicleCategory: driver.vehicle.category,
      fromWilaya,
      toWilaya,
      departDate: String(req.body.departDate || todayIso()),
      availableM3: Number(req.body.availableM3 ?? driver.vehicle.volumeM3),
      maxWeightKg: Number(req.body.maxWeightKg ?? driver.vehicle.maxLoadKg),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    state.emptyReturns.unshift(decl);
    persistState();
    broadcast('intercity.updated', { type: 'empty_return' });
    res.status(201).json(decl);
  });

  // --- Intercity Module (§5.14, §6.5, §7.4, §8.5, §8.6) ---
  app.post('/api/v1/intercity/estimate', (req, res) => {
    const b = req.body;
    const fromW = Number(b.fromWilaya);
    const toW = Number(b.toWilaya);
    if (fromW === toW) {
      return sendError(res, 422, 'SAME_WILAYA', 'Départ et arrivée identiques : utilisez « En ville ».', 'نفس الولاية: استعمل المسار الحضري.');
    }
    const route = state.routeMatrix.find((r) => r.fromWilaya === fromW && r.toWilaya === toW);
    if (!route || !route.isActive) {
      return sendError(res, 422, 'AXIS_NOT_OPEN', 'Cet axe inter-wilaya n’est pas encore ouvert commercialement.', 'هذا المحور غير مفتوح حالياً.');
    }
    const rule = getRule(b.vehicleCategory || 'medium_truck');
    const est = estimateIntercityReference(
      {
        serviceType: b.serviceType || 'moving',
        vehicleCategory: b.vehicleCategory || 'medium_truck',
        distanceKm: route.distanceKm,
        axisCoefficient: route.axisCoefficient,
        portersCount: Number(b.portersCount ?? 0),
        floorFrom: Number(b.floorFrom ?? 0),
        floorTo: Number(b.floorTo ?? 0),
        hasElevatorFrom: Boolean(b.hasElevatorFrom),
        hasElevatorTo: Boolean(b.hasElevatorTo),
        needsDisassembly: Boolean(b.needsDisassembly),
        needsPacking: Boolean(b.needsPacking),
      },
      rule,
      state.settings
    );
    res.json({ ...est, distanceKm: route.distanceKm, durationMin: route.durationMin });
  });

  app.post('/api/v1/intercity/requests', (req, res) => {
    const b = req.body;
    const fromW = Number(b.fromWilaya);
    const toW = Number(b.toWilaya);
    if (fromW === toW) {
      return sendError(res, 422, 'SAME_WILAYA', 'Départ et arrivée identiques : utilisez « En ville ».', 'نفس الولاية.');
    }
    const route = state.routeMatrix.find((r) => r.fromWilaya === fromW && r.toWilaya === toW);
    if (!route || !route.isActive) {
      return sendError(res, 422, 'AXIS_NOT_OPEN', 'Cet axe inter-wilaya n’est pas ouvert.', 'هذا المحور غير مفتوح.');
    }
    const dateCheck = validateIntercityDate(String(b.preferredDate), todayIso(), 1, 60);
    if (!dateCheck.ok) {
      return sendError(res, 422, dateCheck.code || 'MIN_LEAD_TIME', dateCheck.message || 'Date invalide.', 'التاريخ غير صالح.');
    }
    const photos: string[] = Array.isArray(b.photos) ? b.photos : [];
    if (photos.length < 2) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'Minimum 2 photos obligatoires pour une demande inter-wilaya.',
        'صورتان على الأقل مطلوبتان للرحلات بين الولايات.'
      );
    }

    const rule = getRule(b.vehicleCategory || 'medium_truck');
    const est = estimateIntercityReference(
      {
        serviceType: b.serviceType || 'moving',
        vehicleCategory: b.vehicleCategory,
        distanceKm: route.distanceKm,
        axisCoefficient: route.axisCoefficient,
        portersCount: Number(b.portersCount ?? 0),
        floorFrom: Number(b.floorFrom ?? 0),
        floorTo: Number(b.floorTo ?? 0),
        hasElevatorFrom: Boolean(b.hasElevatorFrom),
        hasElevatorTo: Boolean(b.hasElevatorTo),
        needsDisassembly: Boolean(b.needsDisassembly),
        needsPacking: Boolean(b.needsPacking),
      },
      rule,
      state.settings
    );

    const reqCode = `LMX-2026-${String(state.intercityCounter++).padStart(6, '0')}`;
    const depositRequiredDzd =
      state.settings.intercityDepositRequiredAboveDzd > 0 &&
      est.refPriceDzd >= state.settings.intercityDepositRequiredAboveDzd
        ? Math.round(est.refPriceDzd * 0.25)
        : 0;

    const preferredIcDriver =
      state.settings.directRequestEnabled && b.preferredDriverId
        ? state.drivers.find((d) => d.id === String(b.preferredDriverId))
        : undefined;
    const ic: IntercityRequest = {
      id: `ic-${Date.now()}`,
      requestCode: reqCode,
      clientId: b.clientId || 'client-amine',
      clientName: b.clientName || 'Amine Boudiaf',
      clientPhone: b.clientPhone || '+213551889900',
      ...(preferredIcDriver
        ? { preferredDriverId: preferredIcDriver.id, preferredDriverName: preferredIcDriver.fullName }
        : {}),
      status: 'collecting',
      serviceType: b.serviceType || 'moving',
      vehicleCategory: b.vehicleCategory || 'medium_truck',
      fromWilaya: fromW,
      toWilaya: toW,
      pickupAddress: String(b.pickupAddress || ''),
      dropoffAddress: String(b.dropoffAddress || ''),
      distanceKm: route.distanceKm,
      preferredDate: String(b.preferredDate),
      dateFlexibility: b.dateFlexibility || 'plus_minus_1',
      timeSlot: b.timeSlot || 'morning',
      floorFrom: Number(b.floorFrom ?? 0),
      floorTo: Number(b.floorTo ?? 0),
      hasElevatorFrom: Boolean(b.hasElevatorFrom),
      hasElevatorTo: Boolean(b.hasElevatorTo),
      portersCount: Number(b.portersCount ?? 0),
      needsDisassembly: Boolean(b.needsDisassembly),
      needsPacking: Boolean(b.needsPacking),
      volumeNote: String(b.volumeNote ?? ''),
      clientComment: String(b.clientComment ?? ''),
      photos,
      refPriceDzd: est.refPriceDzd,
      priceFloorDzd: est.priceFloorDzd,
      priceCapDzd: est.priceCapDzd,
      clientBudgetDzd: b.clientBudgetDzd ? Number(b.clientBudgetDzd) : undefined,
      depositRequiredDzd,
      depositDeclaredDzd: 0,
      depositMethod: 'none',
      quotesOpenUntil: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      checklist: { truckChecked: false, portersConfirmed: false, clientCalled: false },
      quotes: [],
      events: [
        {
          id: `icev-${Date.now()}`,
          fromStatus: null,
          toStatus: 'collecting',
          actor: 'client',
          note: `Demande inter-wilaya publiée (${route.distanceKm} km)`,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };

    state.intercityRequests.unshift(ic);
    persistState();
    const safeIc = sanitizeIntercityForApi(ic);
    broadcast('intercity.created', safeIc);
    res.status(201).json(safeIc);
  });

  // CDC v2.1 C11: Sanitized single intercity request endpoint
  app.get('/api/v1/intercity/requests/:id', (req, res) => {
    const ic = state.intercityRequests.find((x) => x.id === req.params.id);
    if (!ic) return sendError(res, 404, 'NOT_FOUND', 'Demande introuvable.', 'الطلب غير موجود.');
    res.json(sanitizeIntercityForApi(ic));
  });

  // CDC v2.1 C11: Intercity contact reveal locked until `booked`
  app.post('/api/v1/intercity/requests/:id/contact', requireAuth(), (req, res) => {
    const ic = state.intercityRequests.find((x) => x.id === req.params.id);
    if (!ic) return sendError(res, 404, 'NOT_FOUND', 'Demande introuvable.', 'الطلب غير موجود.');
    if (!canRevealIntercityContact(ic.status)) {
      return sendError(
        res,
        403,
        'CONTACT_LOCKED',
        'Les coordonnées sont verrouillées tant qu’aucun devis n’a été retenu.',
        'أرقام الهاتف مقفلة حتى يتم تأكيد حجز أحد العروض.'
      );
    }
    const driver = state.drivers.find((d) => d.id === ic.driverId);
    const driverPhone = ic.driverPhone || driver?.phone || '';
    const clientPhone = ic.clientPhone || '';
    res.json({
      requestId: ic.id,
      status: ic.status,
      driver_phone: driverPhone,
      client_phone: clientPhone,
      driverPhone,
      clientPhone,
    });
  });

  // CDC v2.1 §5.14 & T27: Client intercity cancellation with < 48h reputational tracking
  app.post('/api/v1/intercity/requests/:id/cancel', (req, res) => {
    const ic = state.intercityRequests.find((x) => x.id === req.params.id);
    if (!ic) return sendError(res, 404, 'NOT_FOUND', 'Demande introuvable.', 'الطلب غير موجود.');
    if (!['collecting', 'quoted', 'booked'].includes(ic.status)) {
      return sendError(
        res,
        409,
        'CANCELLATION_LOCKED',
        'Impossible d’annuler un trajet déjà en cours ou terminé.',
        'لا يمكن إلغاء رحلة قيد التنفيذ أو مكتملة.'
      );
    }

    const prev = ic.status;
    const nowIso = new Date().toISOString();
    const lateFlag = prev === 'booked' && isLateIntercityCancellation(ic.preferredDate, nowIso);
    ic.status = 'cancelled_client';
    ic.cancelledBy = 'client';
    ic.cancellationReason = String(req.body?.reason || 'Annulée par le client');
    ic.lateClientCancellationFlag = lateFlag;
    ic.quotes = ic.quotes.map((q) =>
      q.status === 'pending' || q.status === 'countered' ? { ...q, status: 'rejected' } : q
    );
    ic.events.push({
      id: `icev-${Date.now()}`,
      fromStatus: prev,
      toStatus: 'cancelled_client',
      actor: 'client',
      note: lateFlag
        ? `${ic.cancellationReason} (désistement < 48 h signalé)`
        : ic.cancellationReason,
      createdAt: nowIso,
    });

    if (lateFlag) {
      addAudit(
        'client@camio.dz',
        'intercity.late_client_cancel',
        'intercity_request',
        ic.id,
        `${ic.requestCode} : désistement client < 48 h avant ${ic.preferredDate}`
      );
      broadcast('admin.updated', { type: 'late_intercity_cancel', requestId: ic.id });
    }

    persistState();
    const safeIc = sanitizeIntercityForApi(ic);
    broadcast('intercity.updated', safeIc);
    res.json({ intercity: safeIc, lateCancellationWarning: lateFlag });
  });

  app.post('/api/v1/intercity/requests/:id/quotes', (req, res) => {
    const ic = state.intercityRequests.find((x) => x.id === req.params.id);
    if (!ic) return sendError(res, 404, 'NOT_FOUND', 'Demande introuvable.', 'الطلب غير موجود.');
    if (ic.status !== 'collecting' && ic.status !== 'quoted') {
      return sendError(res, 409, 'INVALID_STATE', 'Les devis sont clos pour cette demande.', 'انتهت مهلة العروض.');
    }

    const driver = state.drivers.find((d) => d.id === req.body.driverId);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');

    // CDC v2.1 §7.5: quality threshold (ratingIntercityAvg >= 3.5 once >= 3 ratings) + KYC/subscription check
    syncDriverSubscriptions();
    const eligibility = isDriverEligibleForIntercity(driver, todayIso());
    if (!eligibility.eligible) {
      const msgMap = {
        DRIVER_NOT_APPROVED: {
          fr: 'Votre dossier KYC doit être validé pour répondre aux trajets inter-wilaya.',
          ar: 'يجب اعتماد ملفك أولاً لتقديم عروض بين الولايات.',
        },
        SUBSCRIPTION_EXPIRED: {
          fr: 'Votre abonnement a expiré. Renouvelez pour soumettre un devis.',
          ar: 'انتهى اشتراكك. يرجى التجديد لتقديم عرض سعر.',
        },
        INTERCITY_QUALITY_SUSPENDED: {
          fr: 'Accès inter-wilaya suspendu : note moyenne longue distance inférieure à 3,5/5 (≥ 3 avis).',
          ar: 'تم تعليق الرحلات بين الولايات لانخفاض التقييم عن 3.5/5.',
        },
      };
      const errCode = eligibility.code ?? 'DRIVER_NOT_APPROVED';
      return sendError(res, 403, errCode, msgMap[errCode].fr, msgMap[errCode].ar);
    }

    const availableDate = String(req.body.availableDate || ic.preferredDate);
    if (!isQuoteDateCompatible(ic.preferredDate, availableDate, ic.dateFlexibility)) {
      return sendError(
        res,
        422,
        'DATE_NOT_COMPATIBLE',
        'La date proposée sort de la fenêtre de souplesse du client.',
        'التاريخ المقترح خارج النطاق المسموح من الزبون.'
      );
    }

    // CDC §8.5 : le plancher -25 % n'est autorisé que si le chauffeur a réellement
    // déclaré un retour à vide sur le même axe et une date compatible.
    const declaredEmptyReturn = state.emptyReturns.find(
      (er) =>
        er.driverId === driver.id &&
        er.fromWilaya === ic.fromWilaya &&
        er.toWilaya === ic.toWilaya &&
        er.isActive &&
        isQuoteDateCompatible(availableDate, er.departDate, ic.dateFlexibility)
    );
    const requestedEmptyReturn = Boolean(req.body.isEmptyReturn);
    if (requestedEmptyReturn && !declaredEmptyReturn) {
      return sendError(
        res,
        422,
        'EMPTY_RETURN_NOT_DECLARED',
        'Aucun retour à vide déclaré sur cet axe à cette date : la remise de 25 % ne peut pas être appliquée.',
        'لم يتم الإعلان عن عودة فارغة على هذا المحور في هذا التاريخ: لا يمكن تطبيق خصم 25%.'
      );
    }
    const isEmptyReturn = requestedEmptyReturn && Boolean(declaredEmptyReturn);
    const isGroupage = Boolean(req.body.isGroupage);
    const priceCheck = validateIntercityQuotePrice(
      Number(req.body.priceDzd),
      ic.refPriceDzd,
      { isEmptyReturn, isGroupage },
      state.settings
    );
    if (!priceCheck.valid) {
      return sendError(
        res,
        422,
        'PRICE_OUT_OF_RANGE',
        priceCheck.reason || 'Prix hors bornes.',
        'السعر المقترح خارج الحدود المسموحة.'
      );
    }

    ic.quotes = ic.quotes.map((q) =>
      q.driverId === driver.id && q.status === 'pending' ? { ...q, status: 'withdrawn' } : q
    );

    const quote = sanitizeIntercityQuoteForApi({
      id: `icq-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      requestId: ic.id,
      driverId: driver.id,
      driverName: driver.fullName,
      driverIntercityRating: driver.ratingIntercityAvg,
      driverIntercityCount: driver.intercityRatingsCount,
      axisExperienceCount: driver.intercityCompleted,
      vehicleCategory: driver.vehicle.category,
      vehicleLabel: `${driver.vehicle.brand} ${driver.vehicle.model}`,
      plateMasked: driver.vehicle.plateNumber.replace(/-\d{3}-/, '-***-'),
      priceDzd: Number(req.body.priceDzd),
      availableDate,
      timeSlot: req.body.timeSlot || ic.timeSlot,
      portersIncluded: Number(req.body.portersIncluded ?? ic.portersCount),
      includesPacking: Boolean(req.body.includesPacking),
      includesDisassembly: Boolean(req.body.includesDisassembly),
      isGroupage,
      isEmptyReturn,
      message: String(req.body.message ?? ''),
      status: 'pending' as const,
      responseMinutes: 15,
      createdAt: new Date().toISOString(),
    });

    ic.quotes.push(quote);
    if (ic.status === 'collecting') {
      ic.status = 'quoted';
      ic.events.push({
        id: `icev-${Date.now()}`,
        fromStatus: 'collecting',
        toStatus: 'quoted',
        actor: 'system',
        note: 'Premier devis reçu',
        createdAt: new Date().toISOString(),
      });
    }

    persistState();
    broadcast('intercity.quote.created', { requestId: ic.id, quote });
    res.status(201).json(quote);
  });

  app.post('/api/v1/intercity/quotes/:quoteId/counter', (req, res) => {
    const ic = state.intercityRequests.find((r) => r.quotes.some((q) => q.id === req.params.quoteId));
    if (!ic) return sendError(res, 404, 'NOT_FOUND', 'Devis introuvable.', 'العرض غير موجود.');
    const quote = ic.quotes.find((q) => q.id === req.params.quoteId)!;
    if (quote.clientCounterPriceDzd != null) {
      return sendError(
        res,
        409,
        'COUNTER_ALREADY_USED',
        'Une contre-proposition a déjà été envoyée (1 seul tour autorisé).',
        'تم إرسال عرض مضاد مسبقاً (جولة واحدة فقط).'
      );
    }
    const counterPrice = Number(req.body.priceDzd);
    if (counterPrice < ic.priceFloorDzd * 0.75 || counterPrice > quote.priceDzd) {
      return sendError(
        res,
        422,
        'PRICE_OUT_OF_RANGE',
        'Contre-proposition hors limites raisonnables.',
        'السعر المضاد غير مقبول.'
      );
    }
    quote.clientCounterPriceDzd = counterPrice;
    quote.status = 'countered';
    persistState();
    const safeIc = sanitizeIntercityForApi(ic);
    broadcast('intercity.updated', safeIc);
    res.json({ quote, intercity: safeIc });
  });

  app.post('/api/v1/intercity/quotes/:quoteId/respond-counter', (req, res) => {
    const ic = state.intercityRequests.find((r) => r.quotes.some((q) => q.id === req.params.quoteId));
    if (!ic) return sendError(res, 404, 'NOT_FOUND', 'Devis introuvable.', 'العرض غير موجود.');
    const quote = ic.quotes.find((q) => q.id === req.params.quoteId)!;
    const accept = Boolean(req.body.accept);

    if (accept && quote.clientCounterPriceDzd) {
      quote.priceDzd = quote.clientCounterPriceDzd;
      quote.status = 'pending';
    } else {
      quote.status = 'rejected';
    }
    persistState();
    const safeIc = sanitizeIntercityForApi(ic);
    broadcast('intercity.updated', safeIc);
    res.json({ quote, intercity: safeIc });
  });

  app.post('/api/v1/intercity/quotes/:quoteId/accept', (req, res) => {
    const ic = state.intercityRequests.find((r) => r.quotes.some((q) => q.id === req.params.quoteId));
    if (!ic) return sendError(res, 404, 'NOT_FOUND', 'Devis introuvable.', 'العرض غير موجود.');
    if (!req.body.clientCommitted) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'Vous devez cocher la case d’engagement horodaté.',
        'يجب تأكيد الالتزام بالموعد والسعر.'
      );
    }
    const quote = ic.quotes.find((q) => q.id === req.params.quoteId && (q.status === 'pending' || q.status === 'countered'));
    if (!quote) {
      return sendError(res, 409, 'OFFER_EXPIRED', 'Devis non disponible.', 'العرض غير متاح.');
    }

    const depositRequired =
      state.settings.intercityDepositRequiredAboveDzd > 0 &&
      quote.priceDzd >= state.settings.intercityDepositRequiredAboveDzd;
    if (depositRequired && (!req.body.depositMethod || req.body.depositMethod === 'none')) {
      return sendError(
        res,
        422,
        'VALIDATION_ERROR',
        `Acompte déclaré requis pour les trajets ≥ ${state.settings.intercityDepositRequiredAboveDzd} DA.`,
        'التصريح بالتسبيق مطلوب للرحلات التي تتجاوز 40000 دج.'
      );
    }

    const driver = state.drivers.find((d) => d.id === quote.driverId);
    const nowIso = new Date().toISOString();
    ic.status = 'booked';
    ic.driverId = quote.driverId;
    ic.driverName = quote.driverName;
    ic.driverPhone = driver?.phone ?? '+213661000000';
    ic.agreedPriceDzd = quote.priceDzd;
    ic.clientCommittedAt = nowIso;
    ic.depositMethod = req.body.depositMethod || 'none';
    ic.depositDeclaredDzd = Number(req.body.depositDeclaredDzd ?? 0);
    ic.depositProofLabel = req.body.depositProofLabel;

    const fromW = state.wilayas.find((w) => w.code === ic.fromWilaya);
    const toW = state.wilayas.find((w) => w.code === ic.toWilaya);
    if (fromW && toW) {
      ic.driverLivePos = {
        lat: fromW.lat,
        lng: fromW.lng,
        heading: computeBearingDeg(fromW, toW),
        speedKmh: 0,
        ts: nowIso,
      };
      ic.driverTrail = [{ lat: fromW.lat, lng: fromW.lng, ts: nowIso }];
    }

    ic.quotes = ic.quotes.map((q) =>
      q.id === quote.id ? { ...q, status: 'accepted' } : q.status === 'pending' || q.status === 'countered' ? { ...q, status: 'rejected' } : q
    );
    ic.events.push({
      id: `icev-${Date.now()}`,
      fromStatus: 'quoted',
      toStatus: 'booked',
      actor: 'client',
      note: `Réservé avec ${quote.driverName} à ${quote.priceDzd} DA`,
      createdAt: nowIso,
    });

    persistState();
    broadcast('intercity.updated', ic);
    res.json({ intercity: ic });
  });

  app.post('/api/v1/intercity/requests/:id/position/batch', (req, res) => {
    const positions = Array.isArray(req.body?.positions) ? req.body.positions : [];
    if (positions.length === 0 || positions.length > 200) {
      return sendError(res, 400, 'VALIDATION_ERROR', '1 à 200 positions requises.', 'مطلوب من 1 إلى 200 موقع.');
    }
    let last = null;
    for (const p of positions) {
      const r = applyIntercityPositionUpdate(req.params.id, Number(p.lat), Number(p.lng), Number(p.heading ?? 90), Number(p.speedKmh ?? 76));
      if (r) last = r;
    }
    if (!last) return sendError(res, 404, 'NOT_FOUND', 'Trajet introuvable.', 'الرحلة غير موجودة.');
    res.json({ ok: true, pos: last, applied: positions.length });
  });

  app.post('/api/v1/intercity/requests/:id/position', (req, res) => {
    const pos = applyIntercityPositionUpdate(
      req.params.id,
      Number(req.body.lat),
      Number(req.body.lng),
      Number(req.body.heading ?? 90),
      Number(req.body.speedKmh ?? 76)
    );
    if (!pos) {
      return sendError(
        res,
        404,
        'NOT_FOUND',
        'Trajet inter-wilaya introuvable ou coordonnées invalides.',
        'الرحلة بين الولايات غير موجودة أو الإحداثيات غير صالحة.'
      );
    }
    res.json({ ok: true, pos });
  });

  app.patch('/api/v1/intercity/requests/:id/status', (req, res) => {
    const ic = state.intercityRequests.find((r) => r.id === req.params.id);
    if (!ic) return sendError(res, 404, 'NOT_FOUND', 'Trajet introuvable.', 'الرحلة غير موجودة.');
    const prev = ic.status;
    const toStatus = req.body.toStatus;
    const nowIso = new Date().toISOString();
    ic.status = toStatus;

    const fromW = state.wilayas.find((w) => w.code === ic.fromWilaya);
    const toW = state.wilayas.find((w) => w.code === ic.toWilaya);

    if (toStatus === 'in_progress' && fromW && toW) {
      const heading = computeBearingDeg(fromW, toW);
      const startLat = ic.driverLivePos?.lat ?? fromW.lat;
      const startLng = ic.driverLivePos?.lng ?? fromW.lng;
      const atOrigin =
        Math.abs(startLat - fromW.lat) < 0.01 && Math.abs(startLng - fromW.lng) < 0.01;
      const nextLat = atOrigin
        ? Number((fromW.lat + (toW.lat - fromW.lat) * 0.1).toFixed(6))
        : startLat;
      const nextLng = atOrigin
        ? Number((fromW.lng + (toW.lng - fromW.lng) * 0.1).toFixed(6))
        : startLng;
      ic.driverLivePos = {
        lat: nextLat,
        lng: nextLng,
        heading,
        speedKmh: 76,
        ts: nowIso,
      };
      const baseTrail =
        ic.driverTrail && ic.driverTrail.length > 0
          ? ic.driverTrail
          : [{ lat: fromW.lat, lng: fromW.lng, ts: nowIso }];
      const last = baseTrail[baseTrail.length - 1];
      if (!last || Math.abs(last.lat - nextLat) >= 1e-6 || Math.abs(last.lng - nextLng) >= 1e-6) {
        baseTrail.push({ lat: nextLat, lng: nextLng, ts: nowIso });
      }
      ic.driverTrail = baseTrail.slice(-30);
    }

    if (toStatus === 'completed') {
      const driver = state.drivers.find((d) => d.id === ic.driverId);
      if (driver) driver.intercityCompleted += 1;
      if (toW) {
        ic.driverLivePos = {
          lat: toW.lat,
          lng: toW.lng,
          heading: fromW ? computeBearingDeg(fromW, toW) : 0,
          speedKmh: 0,
          ts: nowIso,
        };
        const trail = ic.driverTrail ?? [];
        const last = trail[trail.length - 1];
        if (!last || Math.abs(last.lat - toW.lat) >= 1e-6 || Math.abs(last.lng - toW.lng) >= 1e-6) {
          trail.push({ lat: toW.lat, lng: toW.lng, ts: nowIso });
        }
        ic.driverTrail = trail.slice(-30);
      }
    }

    ic.events.push({
      id: `icev-${Date.now()}`,
      fromStatus: prev,
      toStatus,
      actor: req.body.actor || 'driver',
      note: req.body.note,
      createdAt: nowIso,
    });
    persistState();
    broadcast('intercity.updated', ic);
    res.json({ intercity: ic });
  });

  app.post('/api/v1/intercity/requests/:id/checklist', (req, res) => {
    const ic = state.intercityRequests.find((r) => r.id === req.params.id);
    if (!ic) return sendError(res, 404, 'NOT_FOUND', 'Trajet introuvable.', 'الرحلة غير موجودة.');
    ic.checklist = { ...ic.checklist, ...req.body };
    persistState();
    broadcast('intercity.updated', ic);
    res.json({ intercity: ic });
  });

  app.post('/api/v1/intercity/requests/:id/price-revision', (req, res) => {
    const ic = state.intercityRequests.find((r) => r.id === req.params.id);
    if (!ic || !ic.agreedPriceDzd) {
      return sendError(res, 404, 'NOT_FOUND', 'Trajet réservé introuvable.', 'الرحلة غير موجودة.');
    }
    const proposed = Number(req.body.proposedPriceDzd);
    const check = validatePriceRevision(ic.agreedPriceDzd, proposed, state.settings.intercityRevisionCapPct);
    if (!check.valid) {
      return sendError(
        res,
        422,
        'REVISION_CAP_EXCEEDED',
        `Révision refusée : plafond +${state.settings.intercityRevisionCapPct}% (max ${check.maxAllowedDzd} DA).`,
        'تجاوز سقف مراجعة السعر المسموح (+30%).'
      );
    }
    ic.priceRevision = {
      proposedPriceDzd: proposed,
      reason: String(req.body.reason || 'Volume réel supérieur à l’estimation'),
      status: 'pending',
    };
    persistState();
    broadcast('intercity.updated', ic);
    res.json({ intercity: ic });
  });

  app.post('/api/v1/intercity/requests/:id/price-revision/respond', (req, res) => {
    const ic = state.intercityRequests.find((r) => r.id === req.params.id);
    if (!ic || !ic.priceRevision) return sendError(res, 404, 'NOT_FOUND', 'Révision introuvable.', 'لا توجد مراجعة.');
    const accept = Boolean(req.body.accept);
    ic.priceRevision.status = accept ? 'accepted' : 'rejected';
    if (accept) {
      ic.agreedPriceDzd = ic.priceRevision.proposedPriceDzd;
    }
    persistState();
    broadcast('intercity.updated', ic);
    res.json({ intercity: ic });
  });

  app.post('/api/v1/intercity/requests/:id/rating', requireAuth(['client']), (req, res) => {
    const ic = state.intercityRequests.find((r) => r.id === req.params.id);
    if (!ic) return sendError(res, 404, 'NOT_FOUND', 'Trajet introuvable.', 'الرحلة غير موجودة.');
    if (ic.status === 'rated') {
      return sendError(res, 400, 'ALREADY_RATED', 'Ce trajet a déjà été noté.', 'تم تقييم هذه الرحلة مسبقاً.');
    }
    if (ic.status !== 'completed') {
      return sendError(
        res,
        400,
        'RIDE_NOT_COMPLETED',
        'La notation est disponible uniquement après la finalisation du trajet.',
        'التقييم متاح فقط بعد إنهاء الرحلة.'
      );
    }

    const validation = validateReviewSubmission({
      stars: Number(req.body.stars ?? 5),
      tags: req.body.tags,
      comment: req.body.comment,
    });
    if (!validation.valid) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        validation.reasonFr ?? 'Avis invalide.',
        validation.reasonAr ?? 'تقييم غير صالح.'
      );
    }

    const ratedAt = new Date().toISOString();
    ic.rating = {
      stars: validation.stars,
      tags: validation.tags,
      comment: validation.comment,
      ratedAt,
    };
    ic.status = 'rated';
    const driver = state.drivers.find((d) => d.id === ic.driverId);
    if (driver) {
      const total = driver.ratingIntercityAvg * driver.intercityRatingsCount + validation.stars;
      driver.intercityRatingsCount += 1;
      driver.ratingIntercityAvg = Number((total / driver.intercityRatingsCount).toFixed(2));
    }

    let createdReview: DriverReview | undefined;
    if (ic.driverId) {
      createdReview = {
        id: `rev-ic-${Date.now()}`,
        driverId: ic.driverId,
        driverName: ic.driverName ?? driver?.fullName ?? 'Chauffeur',
        clientName: ic.clientName,
        tripType: 'intercity',
        tripCode: ic.requestCode,
        serviceType: ic.serviceType,
        routeSummary: `${ic.pickupAddress} → ${ic.dropoffAddress}`,
        stars: validation.stars,
        tags: validation.tags,
        comment: validation.comment,
        pricePaidDzd: Number.isFinite(Number(req.body.pricePaidDzd)) && Number(req.body.pricePaidDzd) > 0
          ? Number(req.body.pricePaidDzd) : ic.agreedPriceDzd,
        distanceKm: ic.distanceKm,
        identityVerified: driver?.status === 'approved',
        createdAt: ratedAt,
      };
      state.reviews.unshift(createdReview);
    }

    persistState();
    broadcast('intercity.updated', ic);
    res.json({ intercity: ic, review: createdReview });
  });

  // --- Admin Endpoints (§5.12, §11) ---
  app.post('/api/v1/admin/drivers/:id/status', (req, res) => {
    const driver = state.drivers.find((d) => d.id === req.params.id);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');
    const prev = driver.status;
    driver.status = req.body.status;
    if (req.body.reason) driver.rejectionReason = String(req.body.reason);
    if (driver.status !== 'approved') driver.isOnline = false;
    if (driver.status === 'approved') {
      driver.documents = driver.documents.map((doc) => ({ ...doc, status: 'approved' }));
    }
    addAudit('admin@camio.dz', `driver.${driver.status}`, 'driver', driver.id, `${driver.fullName}: ${prev} → ${driver.status}`);
    persistState();
    broadcast('admin.updated', { type: 'driver_status' });
    res.json({ driver });
  });

  app.post('/api/v1/admin/drivers/:id/reset-reactivity', (req, res) => {
    const driver = state.drivers.find((d) => d.id === req.params.id);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');
    driver.requestsReceivedCount = 0;
    driver.requestsRespondedCount = 0;
    driver.ignoredRequestsStreak = 0;
    driver.responseRate = 1;
    driver.isDemotedInBroadcast = false;
    addAudit('admin@camio.dz', 'driver.reactivity_reset', 'driver', driver.id, `Réactivité réinitialisée pour ${driver.fullName}`);
    persistState();
    broadcast('admin.updated', { type: 'driver_reactivity' });
    broadcast('driver.updated', driver);
    res.json({ driver });
  });

  app.post('/api/v1/admin/documents/:docId/review', (req, res) => {
    for (const d of state.drivers) {
      const doc = d.documents.find((x) => x.id === req.params.docId);
      if (doc) {
        doc.status = req.body.status === 'rejected' ? 'rejected' : 'approved';
        doc.reviewNote = req.body.note ? String(req.body.note) : undefined;
        doc.reviewedAt = new Date().toISOString();
        addAudit('admin@camio.dz', `document.${doc.status}`, 'driver_document', doc.id, `${d.fullName} (${doc.docType})`);
        persistState();
        broadcast('admin.updated', { type: 'document_review' });
        return res.json({ driver: d });
      }
    }
    return sendError(res, 404, 'NOT_FOUND', 'Document introuvable.', 'الوثيقة غير موجودة.');
  });

  app.post('/api/v1/admin/payments/:id/review', (req, res) => {
    const payment = state.payments.find((p) => p.id === req.params.id);
    if (!payment) return sendError(res, 404, 'NOT_FOUND', 'Paiement introuvable.', 'الدفع غير موجود.');

    const action = req.body.action === 'reject' ? 'rejected' : 'approved';
    payment.status = action;
    payment.reviewedAt = new Date().toISOString();
    if (action === 'rejected') {
      payment.rejectionReason = String(req.body.reason || 'Justificatif illisible');
    } else {
      const driver = state.drivers.find((d) => d.id === payment.driverId);
      if (driver) {
        const ext = computeSubscriptionExtension(
          driver.subscription.endsOn,
          payment.periodDays,
          todayIso(),
          state.settings.graceDays
        );
        driver.subscription = {
          ...driver.subscription,
          kind: 'paid',
          status: 'active',
          startsOn: ext.startsOn,
          endsOn: ext.endsOn,
          graceUntil: ext.graceUntil,
          amountDzd: payment.amountDzd,
        };
        broadcast('subscription.updated', { driverId: driver.id, subscription: driver.subscription });
      }
    }
    addAudit('admin@camio.dz', `payment.${action}`, 'subscription_payment', payment.id, `${payment.driverName} · ${payment.reference}`);
    persistState();
    broadcast('admin.updated', { type: 'payment_review' });
    res.json({ payment });
  });

  app.post('/api/v1/admin/drivers/:id/subscription/manual', (req, res) => {
    const driver = state.drivers.find((d) => d.id === req.params.id);
    if (!driver) return sendError(res, 404, 'NOT_FOUND', 'Chauffeur introuvable.', 'السائق غير موجود.');
    const days = Math.max(1, Number(req.body.days ?? 30));
    const ext = computeSubscriptionExtension(driver.subscription.endsOn, days, todayIso(), state.settings.graceDays);
    driver.subscription = {
      ...driver.subscription,
      kind: 'manual',
      status: 'active',
      startsOn: ext.startsOn,
      endsOn: ext.endsOn,
      graceUntil: ext.graceUntil,
    };
    addAudit('admin@camio.dz', 'subscription.manual_grant', 'driver', driver.id, `+${days} jours (${req.body.reason || 'geste commercial'})`);
    persistState();
    broadcast('subscription.updated', { driverId: driver.id, subscription: driver.subscription });
    res.json({ driver });
  });

  app.post('/api/v1/admin/vouchers', (req, res) => {
    const count = Math.min(20, Math.max(1, Number(req.body.count ?? 5)));
    const batch = String(req.body.batch || `LOT-${todayIso().replace(/-/g, '')}`);
    const periodDays = Math.max(1, Number(req.body.periodDays ?? 30));
    const created: Voucher[] = [];
    for (let i = 0; i < count; i++) {
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const rand2 = Math.random().toString(36).slice(2, 6).toUpperCase();
      const v: Voucher = {
        code: `LM-2026-${rand}-${rand2}`,
        batch,
        periodDays,
        maxUses: 1,
        uses: 0,
        validUntil: '2027-12-31',
        createdAt: new Date().toISOString(),
      };
      state.vouchers.unshift(v);
      created.push(v);
    }
    addAudit('admin@camio.dz', 'voucher.generate_batch', 'voucher', batch, `${count} codes générés (${periodDays} j)`);
    persistState();
    broadcast('admin.updated', { type: 'vouchers' });
    res.status(201).json({ created });
  });

  app.post('/api/v1/admin/disputes/:id/resolve', (req, res) => {
    const dispute = state.disputes.find((d) => d.id === req.params.id);
    if (!dispute) return sendError(res, 404, 'NOT_FOUND', 'Litige introuvable.', 'النزاع غير موجود.');
    dispute.status = req.body.status === 'rejected' ? 'rejected' : 'resolved';
    dispute.resolutionNote = String(req.body.resolutionNote || 'Clôturé après médiation.');
    dispute.resolvedAt = new Date().toISOString();
    addAudit('admin@camio.dz', `dispute.${dispute.status}`, 'dispute', dispute.id, `${dispute.code}: ${dispute.resolutionNote}`);
    persistState();
    broadcast('admin.updated', { type: 'dispute' });
    res.json({ dispute });
  });

  app.patch('/api/v1/admin/routes/:id', (req, res) => {
    const route = state.routeMatrix.find((r) => r.id === req.params.id);
    if (!route) return sendError(res, 404, 'NOT_FOUND', 'Axe introuvable.', 'المسار غير موجود.');
    if (req.body.isActive !== undefined) route.isActive = Boolean(req.body.isActive);
    if (req.body.mediumPrice != null) {
      route.refPrices.medium_truck = Number(req.body.mediumPrice);
    }
    addAudit('admin@camio.dz', 'route_matrix.update', 'route', route.id, `Axe ${route.fromWilaya}→${route.toWilaya} mis à jour`);
    persistState();
    broadcast('admin.updated', { type: 'routes' });
    res.json({ route });
  });

  app.put('/api/v1/admin/settings', (req, res) => {
    state.settings = { ...state.settings, ...req.body };
    addAudit('admin@camio.dz', 'settings.update', 'app_settings', 'global', 'Paramètres tarifaires/abonnement mis à jour');
    persistState();
    broadcast('admin.updated', { type: 'settings' });
    res.json({ settings: state.settings });
  });

  // Vite integration (dev) or static dist (prod)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT ?? 3000);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CAMIO EXPRESS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
