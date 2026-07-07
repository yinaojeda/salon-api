import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AppointmentLineDto {
  @IsInt()
  serviceId: number;

  @IsInt()
  employeeId: number;
}

export class CreateAppointmentDto {
  @IsInt()
  clientId: number;

  @IsISO8601({}, { message: 'startsAt debe ser una fecha ISO válida' })
  startsAt: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'El turno necesita al menos un servicio' })
  @ValidateNested({ each: true })
  @Type(() => AppointmentLineDto)
  services: AppointmentLineDto[];
}
