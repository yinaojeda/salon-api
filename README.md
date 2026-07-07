# Salon API

API multi-tenant para gestión de salones de belleza, barberías y spas.
Stack: NestJS + Prisma + PostgreSQL.

## Setup

```bash
npm install
cp .env.example .env        # editar DATABASE_URL y JWT_SECRET
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

## Probar el flujo

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"admin123"}'

# 2. Crear cliente (con el accessToken del paso anterior)
curl -X POST http://localhost:3000/api/clients \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"María López","phone":"+595981123456"}'

# 3. Listar clientes (solo ve los de SU salón)
curl http://localhost:3000/api/clients -H "Authorization: Bearer TOKEN"
```

## Arquitectura multi-tenant

Cada request autenticado corre dentro de un `AsyncLocalStorage` con el
`salonId` extraído del JWT (`TenancyInterceptor`). Una extensión de Prisma
(`tenant-scope.extension.ts`) inyecta ese `salonId` en **todas** las queries
de los modelos con tenant:

- Lecturas y escrituras via `prisma.tenant.*` quedan scopeadas automáticamente.
- `prisma.*` (cliente base) NO tiene scope — reservado para auth, seeds y
  operaciones cross-tenant del SUPER_ADMIN.

**Reglas para módulos nuevos:**

1. Usar siempre `prisma.tenant.*` en servicios de negocio.
2. Nunca aceptar `salonId` desde el frontend (el `whitelist: true` del
   ValidationPipe descarta campos no declarados en los DTOs).
3. En creates, usar FKs escalares (`clientId: 5`), no `connect` — la
   extensión setea `salonId` como escalar.
4. `AppointmentService` no tiene `salonId`: consultarlo siempre a través
   de su `Appointment`.

## Roles

| Rol | Alcance |
|---|---|
| `SUPER_ADMIN` | Cross-tenant (vos, administración de la plataforma) |
| `ADMIN` | Dueño del salón, acceso total a su salón |
| `RECEPCIONISTA` | Agenda, clientes, pagos |
| `PROFESIONAL` | Su propia agenda y comisiones |
