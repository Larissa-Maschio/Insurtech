/**
 * Funções puras de cálculo (RN02 e RN03). Todos os valores em centavos; taxas em basis points
 * (1% = 100 bps). Sem dependência de banco ou framework, para serem testadas isoladamente.
 */

/** Preço mínimo da mensalidade: R$ 19,90 (RN02). */
export const MIN_MONTHLY_PRICE_CENTS = 1990;

/** preço mensal = valor do aparelho × taxa do plano, arredondado para cima, com mínimo. */
export function monthlyPrice(
  deviceValueCents: number,
  monthlyRateBps: number,
): number {
  assertNonNegativeInt(deviceValueCents, 'deviceValueCents');
  assertNonNegativeInt(monthlyRateBps, 'monthlyRateBps');
  const raw = Math.ceil((deviceValueCents * monthlyRateBps) / 10_000);
  return Math.max(raw, MIN_MONTHLY_PRICE_CENTS);
}

/** franquia = valor do aparelho × percentual da cobertura no plano, arredondado ao centavo. */
export function deductible(
  deviceValueCents: number,
  deductibleBps: number,
): number {
  assertNonNegativeInt(deviceValueCents, 'deviceValueCents');
  assertNonNegativeInt(deductibleBps, 'deductibleBps');
  return Math.round((deviceValueCents * deductibleBps) / 10_000);
}

/** Faixa de valor aceita para o aparelho (RN04): R$ 800,00 a R$ 15.000,00. */
export const DEVICE_VALUE_MIN_CENTS = 80_000;
export const DEVICE_VALUE_MAX_CENTS = 1_500_000;
/** Idade máxima do modelo em anos (RN04). */
export const MAX_DEVICE_AGE_YEARS = 3;
/** Validade da cotação em dias (RN05). */
export const QUOTE_VALIDITY_DAYS = 7;

export type EligibilityIssue = 'VALOR_FORA_DA_FAIXA' | 'APARELHO_ANTIGO';

export function deviceEligibility(
  valueCents: number,
  releaseYear: number,
  currentYear: number,
): EligibilityIssue | null {
  if (
    valueCents < DEVICE_VALUE_MIN_CENTS ||
    valueCents > DEVICE_VALUE_MAX_CENTS
  ) {
    return 'VALOR_FORA_DA_FAIXA';
  }
  if (currentYear - releaseYear > MAX_DEVICE_AGE_YEARS)
    return 'APARELHO_ANTIGO';
  return null;
}

function assertNonNegativeInt(v: number, name: string) {
  if (!Number.isInteger(v) || v < 0)
    throw new RangeError(`${name} deve ser inteiro não negativo`);
}
