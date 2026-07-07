import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withTenant } from '../prisma/with-tenant';

type CommissionLine = {
  id: number;
  employeeId: number;
  priceSnapshot: number;
  commissionPctSnapshot: number;
};

@Injectable()
export class CommissionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Regla acordada: la comisión se genera cuando el turno está
   * COMPLETADO *y* pagado en su totalidad. Idempotente por diseño:
   * el @unique(appointmentServiceId) + skipDuplicates hace imposible
   * duplicar aunque se llame dos veces (doble click, retry, etc).
   */
  async generateIfDue(appointmentId: number) {
    const appointment = await this.prisma.tenant.appointment.findFirst({
      where: { id: appointmentId },
      include: { services: true, payments: true },
    });
    if (!appointment || appointment.status !== 'COMPLETADO') return;

    const total = appointment.services.reduce(
      (sum: number, l: CommissionLine) => sum + l.priceSnapshot,
      0,
    );
    const paid = appointment.payments.reduce(
      (sum: number, p: { amount: number }) => sum + p.amount,
      0,
    );
    if (paid < total) return;

    await this.prisma.tenant.commission.createMany({
      data: appointment.services.map((l: CommissionLine) =>
        withTenant({
          appointmentServiceId: l.id,
          employeeId: l.employeeId,
          baseAmount: l.priceSnapshot,
          pct: l.commissionPctSnapshot,
          amount: Math.round((l.priceSnapshot * l.commissionPctSnapshot) / 100),
        }),
      ),
      skipDuplicates: true,
    });
  }

  findAll(status?: 'PENDIENTE' | 'LIQUIDADA', employeeId?: number) {
    return this.prisma.tenant.commission.findMany({
      where: {
        status: status ?? undefined,
        employeeId: employeeId ?? undefined,
      },
      include: {
        employee: true,
        appointmentService: {
          include: {
            service: true,
            appointment: { include: { client: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Resumen de pendientes por profesional (la vista principal de Comisiones) */
  async summary() {
    const groups = await this.prisma.tenant.commission.groupBy({
      by: ['employeeId'],
      where: { status: 'PENDIENTE' },
      _sum: { amount: true },
      _count: { id: true },
    });
    const employees = await this.prisma.tenant.employee.findMany({
      where: { id: { in: groups.map((g: { employeeId: number }) => g.employeeId) } },
    });
    const nameById = new Map<number, string>(
      employees.map((e: { id: number; name: string }) => [e.id, e.name]),
    );
    return groups.map(
      (g: {
        employeeId: number;
        _sum: { amount: number | null };
        _count: { id: number };
      }) => ({
        employeeId: g.employeeId,
        employeeName: nameById.get(g.employeeId) ?? '—',
        pendingAmount: g._sum.amount ?? 0,
        pendingCount: g._count.id,
      }),
    );
  }

  /** Liquida TODAS las comisiones pendientes de un profesional */
  async liquidate(employeeId: number) {
    const pending = await this.prisma.tenant.commission.findMany({
      where: { employeeId, status: 'PENDIENTE' },
      orderBy: { createdAt: 'asc' },
    });
    if (pending.length === 0) {
      throw new BadRequestException(
        'El profesional no tiene comisiones pendientes',
      );
    }

    const total = pending.reduce(
      (sum: number, c: { amount: number }) => sum + c.amount,
      0,
    );
    const payout = await this.prisma.tenant.commissionPayout.create({
      data: withTenant({
        employeeId,
        periodStart: pending[0].createdAt,
        periodEnd: new Date(),
        total,
      }),
    });
    await this.prisma.tenant.commission.updateMany({
      where: { id: { in: pending.map((c: { id: number }) => c.id) } },
      data: { status: 'LIQUIDADA', payoutId: payout.id },
    });
    return payout;
  }
}
