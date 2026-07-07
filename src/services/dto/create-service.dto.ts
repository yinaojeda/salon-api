import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsInt()
  @Min(5, { message: 'La duración mínima es 5 minutos' })
  durationMin: number;

  @IsInt()
  @Min(0)
  price: number;

  @IsInt()
  @Min(0)
  @Max(100, { message: 'La comisión es un porcentaje entre 0 y 100' })
  commissionPct: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
