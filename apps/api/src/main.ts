import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app-config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { env } = app.get(AppConfig);

  const http = app.getHttpAdapter().getInstance() as Express;
  http.disable('x-powered-by');
  // Behind Render's proxy: trust it so request IPs (rate limits, audit log) are the caller's.
  if (env.NODE_ENV === 'production') http.set('trust proxy', 1);
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true, exposedHeaders: ['Idempotent-Replayed'] });

  if (env.NODE_ENV !== 'production' || env.ENABLE_API_DOCS) {
    const config = new DocumentBuilder().setTitle('d-scims API').setDescription('Phone dealer inventory, sales, credit and device provenance API').setVersion('0.1.0').addBearerAuth().build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  app.enableShutdownHooks();
  await app.listen(env.PORT, '0.0.0.0');
}
await bootstrap();
