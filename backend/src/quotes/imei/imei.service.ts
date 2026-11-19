import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClockService } from '../../common/clock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ImeiInfo, ImeiProvider } from './imei-provider';

/** Consulta o IMEI no provedor configurado, com cache em banco para economizar chamadas. */
@Injectable()
export class ImeiService {
  private readonly cacheMs: number;

  constructor(
    private readonly provider: ImeiProvider,
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    config: ConfigService,
  ) {
    this.cacheMs =
      Number(config.get('IMEI_CACHE_HOURS') ?? 24) * 60 * 60 * 1000;
  }

  async lookup(imei: string): Promise<ImeiInfo> {
    const now = this.clock.now();
    const cached = await this.prisma.imeiLookup.findUnique({ where: { imei } });
    if (cached && now.getTime() - cached.fetchedAt.getTime() < this.cacheMs) {
      return {
        brand: cached.brand,
        model: cached.model,
        blacklisted: cached.blacklisted,
      };
    }
    const info = await this.provider.lookup(imei);
    await this.prisma.imeiLookup.upsert({
      where: { imei },
      create: { imei, ...info, fetchedAt: now },
      update: { ...info, fetchedAt: now },
    });
    return info;
  }
}
