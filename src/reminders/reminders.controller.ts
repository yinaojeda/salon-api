import { Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RemindersService } from './reminders.service';

@Controller('reminders')
@Roles(Role.ADMIN, Role.RECEPCIONISTA)
export class RemindersController {
  constructor(private remindersService: RemindersService) {}

  @Get()
  findAll() {
    return this.remindersService.findAll();
  }

  @Patch(':id/sent')
  markSent(@Param('id', ParseIntPipe) id: number) {
    return this.remindersService.markSent(id);
  }
}
