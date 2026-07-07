import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de tenant por request, basado en AsyncLocalStorage.
 * El TenancyInterceptor lo inicializa después de validar el JWT,
 * y la extensión de Prisma lo lee para inyectar salonId en cada query.
 */
export interface TenantStore {
  userId: number;
  /** null = SUPER_ADMIN operando cross-tenant (sin scope automático) */
  salonId: number | null;
  role: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  get(): TenantStore | undefined {
    return tenantStorage.getStore();
  },

  salonId(): number | null {
    return tenantStorage.getStore()?.salonId ?? null;
  },

  userId(): number | null {
    return tenantStorage.getStore()?.userId ?? null;
  },
};
