import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RemindersService {
  constructor(private prisma: PrismaService) {}

  /** Pendientes y ya enviados (para que el staff vea qué falta y qué no) */
  findAll() {
    return this.prisma.tenant.reminder.findMany({
      where: {
        status: { in: ['PENDIENTE', 'ENVIADO'] },
        appointment: { status: { notIn: ['CANCELADO', 'NO_SHOW'] } },
      },
      include: {
        appointment: {
          include: {
            client: true,
            services: { include: { service: true, employee: true } },
          },
        },
      },
      // pendientes primero (status desc: PENDIENTE > ENVIADO alfabéticamente),
      // y dentro de cada grupo, por fecha de envío
      orderBy: [{ status: 'desc' }, { sendAt: 'asc' }],
    });
  }

  async markSent(id: number) {
    const reminder = await this.prisma.tenant.reminder.findFirst({
      where: { id },
    });
    if (!reminder) throw new NotFoundException('Recordatorio no encontrado');
    if (reminder.status !== 'PENDIENTE') {
      throw new BadRequestException('El recordatorio ya fue procesado');
    }
    return this.prisma.tenant.reminder.update({
      where: { id },
      data: { status: 'ENVIADO', sentAt: new Date() },
    });
  }
}
