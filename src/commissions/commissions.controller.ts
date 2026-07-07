import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CommissionsService } from './commissions.service';

@Controller('commissions')
@Roles(Role.ADMIN)
export class CommissionsController {
  constructor(private commissionsService: CommissionsService) {}

  @Get('summary')
  summary() {
    return this.commissionsService.summary();
  }

  @Get()
  findAll(
    @Query('status') status?: 'PENDIENTE' | 'LIQUIDADA',
    @Query('employeeId') employeeId?: string,
  ) {
    return this.commissionsService.findAll(
      status,
      employeeId ? Number(employeeId) : undefined,
    );
  }

  @Post('liquidate')
  liquidate(@Body('employeeId', ParseIntPipe) employeeId: number) {
    return this.commissionsService.liquidate(employeeId);
  }
}
