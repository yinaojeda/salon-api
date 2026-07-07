import { AppointmentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(AppointmentStatus, { message: 'Estado inválido' })
  status: AppointmentStatus;
}
