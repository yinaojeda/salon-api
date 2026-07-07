import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantStorage } from './tenant-context';

/**
 * Corre DESPUÉS de los guards (los interceptors siempre corren después),
 * por lo que req.user ya fue poblado por la JwtStrategy.
 * Envuelve la ejecución del handler dentro del AsyncLocalStorage,
 * haciendo que TenantContext esté disponible en servicios y en Prisma.
 */
@Injectable()
export class TenancyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    // Rutas @Public (ej. login): no hay usuario, no hay tenant
    if (!user) return next.handle();

    return new Observable((subscriber) => {
      tenantStorage.run(
        {
          userId: user.userId,
          salonId: user.salonId ?? null,
          role: user.role,
        },
        () => next.handle().subscribe(subscriber),
      );
    });
  }
}
