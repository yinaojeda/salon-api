import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
/** Restringe una ruta o controller a ciertos roles. SUPER_ADMIN siempre pasa. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
