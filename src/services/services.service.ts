import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withTenant } from '../prisma/with-tenant';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  findAll(includeInactive = false) {
    return this.prisma.tenant.service.findMany({
      where: includeInactive ? undefined : { active: true },
      include: { category: true },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async findOne(id: number) {
    const service = await this.prisma.tenant.service.findFirst({
      where: { id },
      include: { category: true },
    });
    if (!service) throw new NotFoundException('Servicio no encontrado');
    return service;
  }

  async create(dto: CreateServiceDto) {
    try {
      return await this.prisma.tenant.service.create({
        data: withTenant(dto),
        include: { category: true },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un servicio con ese nombre');
      }
      throw e;
    }
  }

  async update(id: number, dto: UpdateServiceDto) {
    await this.findOne(id);
    return this.prisma.tenant.service.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    // Soft delete: los servicios históricos siguen referenciados por turnos
    return this.prisma.tenant.service.update({
      where: { id },
      data: { active: false },
    });
  }
}
