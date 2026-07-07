import {
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  /**
   * E.164: +5959xxxxxxxx. Guardarlo así hace trivial el link wa.me
   * (solo se le quita el "+").
   */
  @Matches(/^\+\d{8,15}$/, {
    message: 'El teléfono debe estar en formato E.164, ej: +595981123456',
  })
  phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Fecha de nacimiento inválida (formato ISO)' })
  birthday?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
