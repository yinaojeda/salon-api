import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withTenant } from '../prisma/with-tenant';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  findAll(includeInactive = false) {
    return this.prisma.tenant.category.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.tenant.category.findFirst({
      where: { id },
    });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    try {
      return await this.prisma.tenant.category.create({
        data: withTenant(dto),
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe una categoría con ese nombre');
      }
      throw e;
    }
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.findOne(id);
    return this.prisma.tenant.category.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    // Soft delete: los servicios existentes siguen referenciando la categoría
    return this.prisma.tenant.category.update({
      where: { id },
      data: { active: false },
    });
  }
}
