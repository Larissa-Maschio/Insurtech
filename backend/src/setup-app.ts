import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/http-exception.filter';

/** Configuração compartilhada entre main.ts e os testes de integração. */
export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.get('FRONTEND_URL'), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const doc = new DocumentBuilder()
    .setTitle('Seguradora de Celular – API')
    .setDescription(
      'Contrato da API do MVP. Valores monetários em centavos (inteiros), datas em ISO 8601 (UTC). ' +
        'Erros seguem o formato { statusCode, code, message, details?, path, timestamp }. ' +
        'Listas paginadas usam ?page=&pageSize= e respondem { data, meta }.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  return app;
}
