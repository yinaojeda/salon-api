import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withTenant } from '../prisma/with-tenant';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  findAll(includeInactive = false) {
    return this.prisma.tenant.employee.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const employee = await this.prisma.tenant.employee.findFirst({
      where: { id },
    });
    if (!employee) throw new NotFoundException('Profesional no encontrado');
    return employee;
  }

  async create(dto: CreateEmployeeDto) {
    return this.prisma.tenant.employee.create({ data: withTenant(dto) });
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    await this.findOne(id);
    return this.prisma.tenant.employee.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    // Soft delete: el historial de turnos y comisiones lo referencia
    return this.prisma.tenant.employee.update({
      where: { id },
      data: { active: false },
    });
  }
}
