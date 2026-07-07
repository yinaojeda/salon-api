import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommissionsService } from '../commissions/commissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { withTenant } from '../prisma/with-tenant';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private commissions: CommissionsService,
  ) {}

  findRange(from: Date, to: Date) {
    return this.prisma.tenant.payment.findMany({
      where: { paidAt: { gte: from, lt: to } },
      include: { appointment: { include: { client: true } } },
      orderBy: { paidAt: 'desc' },
    });
  }

  async create(dto: CreatePaymentDto, userId: number | null) {
    const appointment = await this.prisma.tenant.appointment.findFirst({
      where: { id: dto.appointmentId },
      include: { services: true, payments: true },
    });
    if (!appointment) throw new NotFoundException('Turno no encontrado');

    if (appointment.status === 'CANCELADO' || appointment.status === 'NO_SHOW') {
      throw new BadRequestException(
        'No se puede registrar un pago sobre un turno cancelado',
      );
    }

    const total = appointment.services.reduce(
      (sum: number, l: { priceSnapshot: number }) => sum + l.priceSnapshot,
      0,
    );
    const paid = appointment.payments.reduce(
      (sum: number, p: { amount: number }) => sum + p.amount,
      0,
    );
    const remaining = total - paid;

    if (dto.amount > remaining) {
      throw new BadRequestException(
        `El monto supera el saldo pendiente (${remaining})`,
      );
    }

    const payment = await this.prisma.tenant.payment.create({
      data: withTenant({
        appointmentId: dto.appointmentId,
        method: dto.method,
        amount: dto.amount,
        receivedById: userId ?? undefined,
      }),
    });

    // Si con este pago el turno completado quedó saldado → comisiones
    await this.commissions.generateIfDue(dto.appointmentId);

    return payment;
  }
}
