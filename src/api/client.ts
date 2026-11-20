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
  SubscriptionPayment,
  Voucher,
  Wilaya,
} from '../domain/types';

export interface BootstrapPayload {
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
}

export class ApiError extends Error {
  code: string;
  messageAr: string;
  status: number;

  constructor(status: number, code: string, message: string, messageAr: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.messageAr = messageAr;
  }
}

const idempotencyKeys = new Map<string, string>();

function idempotencyKeyFor(url: string, options?: RequestInit): string {
  const signature = `${options?.method ?? 'GET'}|${url}|${String(options?.body ?? '')}`;
  let key = idempotencyKeys.get(signature);
  if (!key) {
    key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    idempotencyKeys.set(signature, key);
  }
  return key;
}

export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include', // session httpOnly signée côté serveur
    headers: {
      'Content-Type': 'application/json',
      // Clé d'idempotence sur les mutations (convergence modèle Lalamove).
      ...(options?.method && !['GET', 'HEAD'].includes(options.method)
        ? { 'Idempotency-Key': idempotencyKeyFor(url, options) }
        : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'API_ERROR',
      err?.message ?? 'Erreur serveur',
      err?.message_ar ?? 'خطأ في الخادم'
    );
  }
  return data as T;
}
