import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { CommissionsService } from '../commissions/commissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { withTenant } from '../prisma/with-tenant';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

/**
 * Máquina de estados del turno. Cualquier transición fuera
 * de este mapa se rechaza — la lección del bug Seleccionado/Finalizado:
 * las transiciones viven en UN solo lugar.
 */
const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDIENTE: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['EN_CURSO', 'CANCELADO', 'NO_SHOW'],
  EN_CURSO: ['COMPLETADO', 'CANCELADO'],
  COMPLETADO: [],
  CANCELADO: [],
  NO_SHOW: [],
};

const REMINDER_HOUR_UTC = 9; // hora fija para el recordatorio del día anterior

/** 09:00 del día calendario anterior a startsAt (sin importar la hora del turno) */
function reminderSendAt(startsAt: Date): Date {
  return new Date(
    Date.UTC(
      startsAt.getUTCFullYear(),
      startsAt.getUTCMonth(),
      startsAt.getUTCDate() - 1,
      REMINDER_HOUR_UTC,
    ),
  );
}

/** true si `date` cae hoy o en el futuro, comparando solo por día calendario */
function isTodayOrFuture(date: Date): boolean {
  const today = new Date();
  const todayStart = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const dateStart = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return dateStart >= todayStart;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private commissions: CommissionsService,
  ) {}

  findRange(from: Date, to: Date) {
    return this.prisma.tenant.appointment.findMany({
      where: { startsAt: { gte: from, lt: to } },
      include: {
        client: true,
        services: { include: { service: true, employee: true } },
        payments: true,
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async findOne(id: number) {
    const appointment = await this.prisma.tenant.appointment.findFirst({
      where: { id },
      include: {
        client: true,
        services: { include: { service: true, employee: true } },
        payments: true,
      },
    });
    if (!appointment) throw new NotFoundException('Turno no encontrado');
    return appointment;
  }

  async create(dto: CreateAppointmentDto, userId: number | null) {
    // Validar cliente (el scope de tenant garantiza que sea de este salón)
    const client = await this.prisma.tenant.client.findFirst({
      where: { id: dto.clientId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    // Cargar servicios y profesionales activos referenciados
    const serviceIds = [...new Set(dto.services.map((l) => l.serviceId))];
    const employeeIds = [...new Set(dto.services.map((l) => l.employeeId))];

    const [services, employees] = await Promise.all([
      this.prisma.tenant.service.findMany({
        where: { id: { in: serviceIds }, active: true },
      }),
      this.prisma.tenant.employee.findMany({
        where: { id: { in: employeeIds }, active: true },
      }),
    ]);

    if (services.length !== serviceIds.length) {
      throw new BadRequestException('Algún servicio no existe o está inactivo');
    }
    if (employees.length !== employeeIds.length) {
      throw new BadRequestException(
        'Algún profesional no existe o está inactivo',
      );
    }

    type ServiceSnapshot = {
      id: number;
      price: number;
      commissionPct: number;
      durationMin: number;
    };
    const serviceById = new Map<number, ServiceSnapshot>(
      services.map((s: ServiceSnapshot) => [s.id, s]),
    );

    // Snapshots: cambiar el catálogo después nunca reescribe este turno
    const lines = dto.services.map((l) => {
      const service = serviceById.get(l.serviceId)!;
      return {
        serviceId: l.serviceId,
        employeeId: l.employeeId,
        priceSnapshot: service.price,
        commissionPctSnapshot: service.commissionPct,
        durationMin: service.durationMin,
      };
    });

    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Fecha de inicio inválida');
    }
    const totalMin = lines.reduce((sum, l) => sum + l.durationMin, 0);
    const endsAt = new Date(startsAt.getTime() + totalMin * 60_000);

    // Solapamiento: ningún profesional involucrado puede tener otro
    // turno vivo que se cruce con [startsAt, endsAt)
    const conflict = await this.prisma.tenant.appointment.findFirst({
      where: {
        status: { notIn: ['CANCELADO', 'NO_SHOW'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        services: { some: { employeeId: { in: employeeIds } } },
      },
      include: {
        client: true,
        services: { include: { employee: true } },
      },
    });
    if (conflict) {
      const busy = conflict.services.find((s: { employeeId: number }) =>
        employeeIds.includes(s.employeeId),
      );
      throw new ConflictException(
        `${busy?.employee?.name ?? 'El profesional'} ya tiene un turno en ese horario`,
      );
    }

    return this.prisma.tenant.appointment.create({
      data: withTenant({
        clientId: dto.clientId,
        startsAt,
        endsAt,
        notes: dto.notes,
        createdById: userId ?? undefined,
        services: { create: lines },
      }),
      include: {
        client: true,
        services: { include: { service: true, employee: true } },
      },
    });
  }

  async update(id: number, dto: UpdateAppointmentDto) {
    const current = await this.findOne(id);

    if (current.status !== 'PENDIENTE' && current.status !== 'CONFIRMADO') {
      throw new BadRequestException(
        'Solo se pueden editar turnos pendientes o confirmados',
      );
    }

    if (dto.clientId) {
      const client = await this.prisma.tenant.client.findFirst({
        where: { id: dto.clientId },
      });
      if (!client) throw new NotFoundException('Cliente no encontrado');
    }

    // Líneas: si vienen nuevas se re-snapshotean del catálogo actual
    // (el turno todavía no generó comisiones, así que es seguro);
    // si no vienen, se conservan las existentes para calcular la duración.
    type Line = {
      serviceId: number;
      employeeId: number;
      priceSnapshot: number;
      commissionPctSnapshot: number;
      durationMin: number;
    };
    let lines: Line[];

    if (dto.services) {
      const serviceIds = [...new Set(dto.services.map((l) => l.serviceId))];
      const employeeIds = [...new Set(dto.services.map((l) => l.employeeId))];

      const [services, employees] = await Promise.all([
        this.prisma.tenant.service.findMany({
          where: { id: { in: serviceIds }, active: true },
        }),
        this.prisma.tenant.employee.findMany({
          where: { id: { in: employeeIds }, active: true },
        }),
      ]);
      if (services.length !== serviceIds.length) {
        throw new BadRequestException(
          'Algún servicio no existe o está inactivo',
        );
      }
      if (employees.length !== employeeIds.length) {
        throw new BadRequestException(
          'Algún profesional no existe o está inactivo',
        );
      }

      type ServiceSnapshot = {
        id: number;
        price: number;
        commissionPct: number;
        durationMin: number;
      };
      const serviceById = new Map<number, ServiceSnapshot>(
        services.map((s: ServiceSnapshot) => [s.id, s]),
      );
      lines = dto.services.map((l) => {
        const service = serviceById.get(l.serviceId)!;
        return {
          serviceId: l.serviceId,
          employeeId: l.employeeId,
          priceSnapshot: service.price,
          commissionPctSnapshot: service.commissionPct,
          durationMin: service.durationMin,
        };
      });
    } else {
      lines = current.services.map((s: Line) => ({
        serviceId: s.serviceId,
        employeeId: s.employeeId,
        priceSnapshot: s.priceSnapshot,
        commissionPctSnapshot: s.commissionPctSnapshot,
        durationMin: s.durationMin,
      }));
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Fecha de inicio inválida');
    }
    const totalMin = lines.reduce((sum, l) => sum + l.durationMin, 0);
    const endsAt = new Date(startsAt.getTime() + totalMin * 60_000);
    const employeeIds = [...new Set(lines.map((l) => l.employeeId))];

    // Solapamiento, excluyéndose a sí mismo
    const conflict = await this.prisma.tenant.appointment.findFirst({
      where: {
        id: { not: id },
        status: { notIn: ['CANCELADO', 'NO_SHOW'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        services: { some: { employeeId: { in: employeeIds } } },
      },
      include: { services: { include: { employee: true } } },
    });
    if (conflict) {
      const busy = conflict.services.find((s: { employeeId: number }) =>
        employeeIds.includes(s.employeeId),
      );
      throw new ConflictException(
        `${busy?.employee?.name ?? 'El profesional'} ya tiene un turno en ese horario`,
      );
    }

    const updated = await this.prisma.tenant.appointment.update({
      where: { id },
      data: {
        clientId: dto.clientId ?? undefined,
        startsAt,
        endsAt,
        notes: dto.notes !== undefined ? dto.notes : undefined,
        ...(dto.services
          ? { services: { deleteMany: {}, create: lines } }
          : {}),
      },
      include: {
        client: true,
        services: { include: { service: true, employee: true } },
      },
    });

    // Si cambió el horario, reprogramar el recordatorio pendiente
    if (dto.startsAt) {
      await this.prisma.tenant.reminder.updateMany({
        where: { appointmentId: id, status: 'PENDIENTE' },
        data: { sendAt: reminderSendAt(startsAt) },
      });
    }

    return updated;
  }

  async updateStatus(id: number, status: AppointmentStatus) {
    const appointment = await this.findOne(id);

    if (!TRANSITIONS[appointment.status as AppointmentStatus].includes(status)) {
      throw new BadRequestException(
        `No se puede pasar de ${appointment.status} a ${status}`,
      );
    }

    const updated = await this.prisma.tenant.appointment.update({
      where: { id },
      data: { status },
      include: {
        client: true,
        services: { include: { service: true, employee: true } },
      },
    });

    // Efectos colaterales del cambio de estado
    if (status === 'CONFIRMADO') {
      const sendAt = reminderSendAt(updated.startsAt);
      if (isTodayOrFuture(sendAt)) {
        await this.prisma.tenant.reminder.create({
          data: withTenant({ appointmentId: id, sendAt }),
        });
      }
    }

    if (status === 'CANCELADO' || status === 'NO_SHOW') {
      // Que a nadie le llegue un WhatsApp de un turno que ya no existe
      await this.prisma.tenant.reminder.updateMany({
        where: { appointmentId: id, status: 'PENDIENTE' },
        data: { status: 'CANCELADO' },
      });
    }

    if (status === 'COMPLETADO') {
      // Si el turno ya estaba saldado (seña/adelantos), genera comisiones acá;
      // si falta pagar, las genera el módulo de pagos al saldar.
      await this.commissions.generateIfDue(id);
    }

    return updated;
  }
}
