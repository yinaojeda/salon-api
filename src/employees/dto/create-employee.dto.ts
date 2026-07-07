import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @IsOptional()
  @Matches(/^\+\d{8,15}$/, {
    message: 'El teléfono debe estar en formato E.164, ej: +595981123456',
  })
  phone?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
