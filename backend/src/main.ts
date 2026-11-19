import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

async function bootstrap() {
  // rawBody: necessário para validar a assinatura dos webhooks de pagamento.
  const app = await NestFactory.create(AppModule.register(), { rawBody: true });
  setupApp(app);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(
    `API em http://localhost:${port}/api · Swagger em http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
}
bootstrap();
