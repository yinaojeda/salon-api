import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantScopeExtension } from './tenant-scope.extension';

const createTenantClient = (base: PrismaClient) =>
  base.$extends(tenantScopeExtension);

export type TenantClient = ReturnType<typeof createTenantClient>;

/**
 * Dos formas de acceder a la base:
 *
 *   prisma.tenant.client.findMany()  -> scopeado por salonId automáticamente
 *   prisma.client.findMany()         -> SIN scope (login, seeds, tareas cross-tenant)
 *
 * Regla de oro: en módulos de negocio, usar SIEMPRE `prisma.tenant`.
 * El cliente base queda reservado para auth y administración de la plataforma.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  readonly tenant: TenantClient = createTenantClient(this);

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
