import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';

const INACTIVE_DAYS = 60;

type LineWithRefs = {
  priceSnapshot: number;
  service: { id: number; name: string };
  employee: { id: number; name: string };
};

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async overview(from: Date, to: Date) {
    const [salon, payments, completed, statusGroups, commissionsAgg] =
      await Promise.all([
        // Salon no está tenant-scopeado (es el tenant): cliente base
        this.prisma.salon.findUnique({
          where: { id: TenantContext.salonId()! },
        }),
        this.prisma.tenant.payment.findMany({
          where: { paidAt: { gte: from, lt: to } },
        }),
        this.prisma.tenant.appointment.findMany({
          where: { startsAt: { gte: from, lt: to }, status: 'COMPLETADO' },
          include: {
            services: { include: { service: true, employee: true } },
          },
        }),
        this.prisma.tenant.appointment.groupBy({
          by: ['status'],
          where: { startsAt: { gte: from, lt: to } },
          _count: { id: true },
        }),
        this.prisma.tenant.commission.aggregate({
          where: { createdAt: { gte: from, lt: to } },
          _sum: { amount: true },
        }),
      ]);

    const timezone = salon?.timezone ?? 'America/Asuncion';
    // en-CA da YYYY-MM-DD directamente
    const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });

    // ── Ingresos ──
    const byMethodMap = new Map<string, number>();
    const byDayMap = new Map<string, number>();
    let revenueTotal = 0;

    for (const p of payments as { method: string; amount: number; paidAt: Date }[]) {
      revenueTotal += p.amount;
      byMethodMap.set(p.method, (byMethodMap.get(p.method) ?? 0) + p.amount);
      const key = dayKey.format(p.paidAt);
      byDayMap.set(key, (byDayMap.get(key) ?? 0) + p.amount);
    }

    // ── Servicios más vendidos y productividad por profesional ──
    const serviceStats = new Map<
      number,
      { name: string; count: number; revenue: number }
    >();
    const employeeStats = new Map<
      number,
      { name: string; count: number; revenue: number }
    >();

    for (const appointment of completed as { services: LineWithRefs[] }[]) {
      for (const line of appointment.services) {
        const s = serviceStats.get(line.service.id) ?? {
          name: line.service.name,
          count: 0,
          revenue: 0,
        };
        s.count += 1;
        s.revenue += line.priceSnapshot;
        serviceStats.set(line.service.id, s);

        const e = employeeStats.get(line.employee.id) ?? {
          name: line.employee.name,
          count: 0,
          revenue: 0,
        };
        e.count += 1;
        e.revenue += line.priceSnapshot;
        employeeStats.set(line.employee.id, e);
      }
    }

    // Comisiones por profesional en el período
    const commissionGroups = await this.prisma.tenant.commission.groupBy({
      by: ['employeeId'],
      where: { createdAt: { gte: from, lt: to } },
      _sum: { amount: true },
    });
    const commissionByEmployee = new Map<number, number>(
      (commissionGroups as { employeeId: number; _sum: { amount: number | null } }[]).map(
        (g) => [g.employeeId, g._sum.amount ?? 0],
      ),
    );

    // ── Estados de turnos ──
    const counts: Record<string, number> = {};
    let appointmentsTotal = 0;
    for (const g of statusGroups as { status: string; _count: { id: number } }[]) {
      counts[g.status] = g._count.id;
      appointmentsTotal += g._count.id;
    }
    const noShows = counts['NO_SHOW'] ?? 0;

    return {
      revenue: {
        total: revenueTotal,
        byMethod: [...byMethodMap.entries()].map(([method, total]) => ({
          method,
          total,
        })),
        byDay: [...byDayMap.entries()]
          .map(([date, total]) => ({ date, total }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      },
      commissionsTotal: commissionsAgg._sum.amount ?? 0,
      topServices: [...serviceStats.values()]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8),
      employees: [...employeeStats.entries()]
        .map(([id, e]) => ({
          ...e,
          commissions: commissionByEmployee.get(id) ?? 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      appointments: {
        total: appointmentsTotal,
        counts,
        noShowRate:
          appointmentsTotal > 0
            ? Math.round((noShows / appointmentsTotal) * 100)
            : 0,
      },
      inactiveClients: await this.inactiveClients(),
    };
  }

  /**
   * Clientes con historial que no vienen hace 60+ días —
   * la lista para reactivar por WhatsApp.
   */
  private async inactiveClients() {
    const cutoff = new Date(Date.now() - INACTIVE_DAYS * 86_400_000);
    const clients = await this.prisma.tenant.client.findMany({
      include: {
        appointments: {
          where: { status: { notIn: ['CANCELADO'] } },
          orderBy: { startsAt: 'desc' },
          take: 1,
        },
      },
    });

    type ClientWithLast = {
      id: number;
      name: string;
      phone: string;
      appointments: { startsAt: Date }[];
    };

    return (clients as ClientWithLast[])
      .filter(
        (c) => c.appointments.length > 0 && c.appointments[0].startsAt < cutoff,
      )
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        lastVisit: c.appointments[0].startsAt,
      }))
      .sort((a, b) => a.lastVisit.getTime() - b.lastVisit.getTime())
      .slice(0, 20);
  }
}
