import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin123', 10);

  // Vos: acceso cross-tenant a toda la plataforma
  await prisma.user.upsert({
    where: { email: 'super@plataforma.com' },
    update: {},
    create: {
      email: 'super@plataforma.com',
      password,
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
      salonId: null,
    },
  });

  // Salón demo con su dueña
  const salon = await prisma.salon.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Salón Demo',
      slug: 'demo',
      phone: '+595981000000',
      address: 'Loma Plata, Boquerón',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      password,
      name: 'Admin Demo',
      role: Role.ADMIN,
      salonId: salon.id,
    },
  });

  const existingServices = await prisma.service.count({
    where: { salonId: salon.id },
  });

  if (existingServices === 0) {
    const categoryNames = ['Peluquería', 'Barbería', 'Uñas', 'Spa'];
    await prisma.category.createMany({
      data: categoryNames.map((name) => ({ salonId: salon.id, name })),
      skipDuplicates: true,
    });
    const categories = await prisma.category.findMany({
      where: { salonId: salon.id, name: { in: categoryNames } },
    });
    const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

    await prisma.service.createMany({
      data: [
        { salonId: salon.id, name: 'Corte de cabello', categoryId: categoryIdByName.get('Peluquería'), durationMin: 45, price: 60000, commissionPct: 40 },
        { salonId: salon.id, name: 'Corte + barba', categoryId: categoryIdByName.get('Barbería'), durationMin: 60, price: 80000, commissionPct: 40 },
        { salonId: salon.id, name: 'Manicura', categoryId: categoryIdByName.get('Uñas'), durationMin: 40, price: 50000, commissionPct: 50 },
        { salonId: salon.id, name: 'Masaje relajante', categoryId: categoryIdByName.get('Spa'), durationMin: 60, price: 150000, commissionPct: 35 },
      ],
    });

    await prisma.employee.createMany({
      data: [
        { salonId: salon.id, name: 'Ana Martínez', phone: '+595981111111' },
        { salonId: salon.id, name: 'Luis González', phone: '+595982222222' },
      ],
    });
  }

  const existingClients = await prisma.client.count({
    where: { salonId: salon.id },
  });

  if (existingClients === 0) {
    await prisma.client.createMany({
      data: [
        { salonId: salon.id, name: 'María Fernández', phone: '+595981333001', email: 'maria.fernandez@example.com', birthday: new Date('1990-03-15') },
        { salonId: salon.id, name: 'Carlos Benítez', phone: '+595981333002', email: 'carlos.benitez@example.com' },
        { salonId: salon.id, name: 'Lucía Duarte', phone: '+595981333003', birthday: new Date('1995-07-22') },
        { salonId: salon.id, name: 'Diego Ramírez', phone: '+595981333004', email: 'diego.ramirez@example.com' },
        { salonId: salon.id, name: 'Valentina Cáceres', phone: '+595981333005', notes: 'Prefiere turnos por la tarde' },
        { salonId: salon.id, name: 'Jorge Villalba', phone: '+595981333006', email: 'jorge.villalba@example.com' },
        { salonId: salon.id, name: 'Sofía Ortiz', phone: '+595981333007', birthday: new Date('1988-11-02') },
        { salonId: salon.id, name: 'Pablo Insfrán', phone: '+595981333008' },
      ],
    });
  }

  console.log('Seed completado:');
  console.log('  SUPER_ADMIN -> super@plataforma.com / admin123');
  console.log('  ADMIN demo  -> admin@demo.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
