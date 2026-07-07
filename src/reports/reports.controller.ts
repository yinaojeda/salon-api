import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@Roles(Role.ADMIN)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('overview')
  overview(@Query('from') from: string, @Query('to') to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException(
        'Parámetros from y to requeridos en formato ISO',
      );
    }
    return this.reportsService.overview(fromDate, toDate);
  }
}
