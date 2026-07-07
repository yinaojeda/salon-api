import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@Roles(Role.ADMIN, Role.RECEPCIONISTA)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get()
  findRange(@Query('from') from: string, @Query('to') to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException(
        'Parámetros from y to requeridos en formato ISO',
      );
    }
    return this.paymentsService.findRange(fromDate, toDate);
  }

  @Post()
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.create(dto, user.userId);
  }
}
