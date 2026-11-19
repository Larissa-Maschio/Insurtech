import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImeiInfo, ImeiProvider, ImeiProviderError } from './imei-provider';

/**
 * Provedor para uma API HTTP real de consulta de IMEI.
 *
 * Configuração (.env):
 *   IMEI_API_URL      URL com o marcador {imei}, ex.: https://api.exemplo.com/v1/imei/{imei}
 *   IMEI_API_KEY      enviada como "Authorization: Bearer <chave>"
 *   IMEI_API_TIMEOUT_MS
 *
 * Cada fornecedor devolve um formato diferente: ajuste apenas `mapResponse` para o escolhido.
 * O formato padrão esperado é { brand, model, blacklisted } (com alguns sinônimos comuns).
 */
@Injectable()
export class HttpImeiProvider extends ImeiProvider {
  readonly name = 'http';
  private readonly logger = new Logger(HttpImeiProvider.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async lookup(imei: string): Promise<ImeiInfo> {
    const urlTemplate = this.config.get<string>('IMEI_API_URL');
    if (!urlTemplate)
      throw new ImeiProviderError(
        'IMEI_API_URL não configurada',
        'INDISPONIVEL',
      );
    const timeout = Number(this.config.get('IMEI_API_TIMEOUT_MS') ?? 5000);

    let res: Response;
    try {
      res = await fetch(
        urlTemplate.replace('{imei}', encodeURIComponent(imei)),
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${this.config.get('IMEI_API_KEY') ?? ''}`,
          },
          signal: AbortSignal.timeout(timeout),
        },
      );
    } catch (err) {
      const isTimeout = (err as Error).name === 'TimeoutError';
      throw new ImeiProviderError(
        'Falha ao consultar IMEI',
        isTimeout ? 'TIMEOUT' : 'INDISPONIVEL',
      );
    }
    if (res.status === 429)
      throw new ImeiProviderError('Limite da API de IMEI excedido', 'LIMITE');
    if (!res.ok) {
      this.logger.warn(`API de IMEI respondeu ${res.status}`);
      throw new ImeiProviderError(
        `API de IMEI respondeu ${res.status}`,
        'INDISPONIVEL',
      );
    }
    return this.mapResponse(await res.json());
  }

  mapResponse(body: any): ImeiInfo {
    const data = body?.data ?? body?.properties ?? body;
    const brand = data?.brand ?? data?.manufacturer ?? null;
    const model = data?.model ?? data?.modelName ?? data?.deviceName ?? null;
    const status = String(
      data?.blacklistStatus ?? data?.gsmaBlacklisted ?? '',
    ).toLowerCase();
    const blacklisted =
      data?.blacklisted === true ||
      status === 'true' ||
      status === 'blacklisted' ||
      status === 'blocked';
    return { brand, model, blacklisted };
  }
}
