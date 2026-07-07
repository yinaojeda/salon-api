/**
 * El salonId lo inyecta la extensión tenant-scope en runtime,
 * pero los tipos generados por Prisma no lo saben. Este helper
 * marca un `data` de create como completo para TypeScript.
 * Usar SOLO con prisma.tenant.* — nunca con el cliente base.
 */
export const withTenant = <T extends object>(data: T) =>
  data as T & { salonId: number };
