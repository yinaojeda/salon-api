import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withTenant } from '../prisma/with-tenant';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

/**
 * Patrón a seguir en todos los módulos de negocio:
 * usar SIEMPRE prisma.tenant.* — el salonId se inyecta solo.
 * Nunca recibir salonId desde el frontend ni pasarlo a mano.
 */
@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  findAll(search?: string) {
    return this.prisma.tenant.client.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const client = await this.prisma.tenant.client.findFirst({
      where: { id },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  async create(dto: CreateClientDto) {
    try {
      return await this.prisma.tenant.client.create({
        data: withTenant({
          ...dto,
          birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        }),
      });
    } catch (e) {
      // P2002 = violación de @@unique([salonId, phone])
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un cliente con ese teléfono en este salón',
        );
      }
      throw e;
    }
  }

  async update(id: number, dto: UpdateClientDto) {
    await this.findOne(id); // valida existencia Y pertenencia al salón
    return this.prisma.tenant.client.update({
      where: { id },
      data: {
        ...dto,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.tenant.client.delete({ where: { id } });
  }
}
