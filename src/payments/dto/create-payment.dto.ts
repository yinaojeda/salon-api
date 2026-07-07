import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsInt, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  appointmentId: number;

  @IsEnum(PaymentMethod, { message: 'Método de pago inválido' })
  method: PaymentMethod;

  @IsInt()
  @Min(1, { message: 'El monto debe ser mayor a cero' })
  amount: number;
}
