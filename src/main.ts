import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta propiedades no declaradas en el DTO (ej. un salonId malicioso)
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  console.log(`API corriendo en http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
