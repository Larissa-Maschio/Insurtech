import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvVars {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @Type(() => Number)
  @IsInt()
  PORT = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  FRONTEND_URL = 'http://localhost:5173';

  @IsString()
  API_URL = 'http://localhost:3000';

  @IsString()
  @MinLength(16)
  JWT_ACCESS_SECRET!: string;

  @IsIn(['mock', 'http'])
  IMEI_PROVIDER = 'mock';

  @IsIn(['mock', 'mercadopago'])
  PAYMENT_GATEWAY = 'mock';

  @IsString()
  @MinLength(16)
  PAYMENT_WEBHOOK_SECRET!: string;

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const parsed = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    const list = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${list}`);
  }
  return { ...config, ...parsed };
}
