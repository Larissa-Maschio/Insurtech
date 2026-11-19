import { Injectable } from '@nestjs/common';
import { ImeiInfo, ImeiProvider, ImeiProviderError } from './imei-provider';

/**
 * Provedor fixo para desenvolvimento, testes e demonstração.
 * Os 8 primeiros dígitos (TAC) definem o aparelho — ver a tabela de IMEIs de teste no README.
 */
export const MOCK_TACS: Record<
  string,
  { brand: string; model: string; blacklisted?: boolean }
> = {
  '35000001': { brand: 'Apple', model: 'iPhone 16' },
  '35000002': { brand: 'Apple', model: 'iPhone 15' },
  '35000003': { brand: 'Apple', model: 'iPhone 17 Pro Max' },
  '35000004': { brand: 'Samsung', model: 'Galaxy S25' },
  '35000005': { brand: 'Samsung', model: 'Galaxy A55' },
  '35000006': { brand: 'Motorola', model: 'Moto G85' },
  '35000007': { brand: 'Xiaomi', model: 'Redmi Note 14' },
  '35000008': { brand: 'Samsung', model: 'Galaxy S9' }, // lançado há mais de 3 anos
  '35000009': { brand: 'Motorola', model: 'Moto E14' }, // abaixo de R$ 800
  '35000010': { brand: 'Samsung', model: 'Galaxy Z Fold7' }, // acima de R$ 15.000
  '35000020': { brand: 'Nokia', model: '3310' }, // fora da tabela de referência
  '35999999': { brand: 'Apple', model: 'iPhone 16', blacklisted: true },
};

/** TAC que simula a API externa fora do ar. */
export const MOCK_UNAVAILABLE_TAC = '35000000';

const FALLBACK = [
  '35000001',
  '35000002',
  '35000003',
  '35000004',
  '35000005',
  '35000006',
  '35000007',
];

@Injectable()
export class MockImeiProvider extends ImeiProvider {
  readonly name = 'mock';

  async lookup(imei: string): Promise<ImeiInfo> {
    const tac = imei.slice(0, 8);
    if (tac === MOCK_UNAVAILABLE_TAC) {
      throw new ImeiProviderError(
        'Serviço de IMEI indisponível (simulado)',
        'INDISPONIVEL',
      );
    }
    const known = MOCK_TACS[tac];
    // Qualquer outro IMEI válido recebe um modelo elegível, escolhido de forma determinística.
    const entry =
      known ??
      MOCK_TACS[
        FALLBACK[[...imei].reduce((s, d) => s + Number(d), 0) % FALLBACK.length]
      ];
    return {
      brand: entry.brand,
      model: entry.model,
      blacklisted: !!entry.blacklisted,
    };
  }
}
