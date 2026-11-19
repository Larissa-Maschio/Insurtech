import {
  Controller,
  Get,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators';
import { ClockService } from '../common/clock.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Verifica se a API e o banco estão no ar' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        code: 'BANCO_INDISPONIVEL',
        message: 'Banco de dados indisponível.',
      });
    }
    return {
      status: 'ok',
      database: 'ok',
      time: this.clock.now().toISOString(),
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
