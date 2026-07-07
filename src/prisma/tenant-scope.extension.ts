import { Prisma } from '@prisma/client';
import { TenantContext } from '../tenancy/tenant-context';

/**
 * Modelos que tienen columna salonId y se scopean automáticamente.
 *
 * OJO: AppointmentService NO está acá porque no tiene salonId propio —
 * siempre debe consultarse a través de su Appointment (que sí está scopeado)
 * o con un include desde el turno.
 */
const TENANT_MODELS = new Set<string>([
  'User',
  'Employee',
  'Client',
  'Category',
  'Service',
  'Appointment',
  'Payment',
  'Commission',
  'CommissionPayout',
  'Reminder',
]);

/**
 * Operaciones que aceptan `where`. Desde Prisma 5, update/delete/findUnique
 * aceptan campos no-únicos adicionales en el where (extendedWhereUnique),
 * así que inyectar salonId ahí es válido y convierte cada update/delete
 * en "actualizá X *solo si* pertenece a este salón".
 */
const OPS_WITH_WHERE = new Set<string>([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
  'count',
  'aggregate',
  'groupBy',
]);

export const tenantScopeExtension = Prisma.defineExtension({
  name: 'tenant-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const salonId = TenantContext.salonId();

        // Sin contexto de tenant (login, seeds, SUPER_ADMIN): sin scope.
        if (salonId == null || !TENANT_MODELS.has(model)) {
          return query(args);
        }

        const a = (args ?? {}) as Record<string, unknown>;

        if (OPS_WITH_WHERE.has(operation)) {
          a.where = { ...((a.where as object) ?? {}), salonId };
        }

        if (operation === 'create') {
          a.data = { ...((a.data as object) ?? {}), salonId };
        }

        if (operation === 'createMany') {
          const data = Array.isArray(a.data) ? a.data : [a.data];
          a.data = data.map((d: object) => ({ ...d, salonId }));
        }

        if (operation === 'upsert') {
          a.create = { ...((a.create as object) ?? {}), salonId };
        }

        return query(a as typeof args);
      },
    },
  },
});
