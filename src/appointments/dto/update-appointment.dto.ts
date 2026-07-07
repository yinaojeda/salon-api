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
import { AppointmentLineDto } from './create-appointment.dto';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsInt()
  clientId?: number;

  @IsOptional()
  @IsISO8601({}, { message: 'startsAt debe ser una fecha ISO válida' })
  startsAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'El turno necesita al menos un servicio' })
  @ValidateNested({ each: true })
  @Type(() => AppointmentLineDto)
  services?: AppointmentLineDto[];
}
