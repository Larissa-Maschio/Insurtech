import {
  deductible,
  deviceEligibility,
  MIN_MONTHLY_PRICE_CENTS,
  monthlyPrice,
} from './pricing';

describe('monthlyPrice (RN02)', () => {
  const value = 400_000; // R$ 4.000,00

  it.each([
    ['Básico 0,9%', 90, 3_600],
    ['Intermediário 1,3%', 130, 5_200],
    ['Premium 1,8%', 180, 7_200],
  ])('%s de um aparelho de R$ 4.000', (_, bps, expected) => {
    expect(monthlyPrice(value, bps)).toBe(expected);
  });

  it('arredonda para cima ao centavo', () => {
    expect(monthlyPrice(999_999, 130)).toBe(13_000); // 12.999,987 → 13.000
    expect(monthlyPrice(333_333, 180)).toBe(6_000); // 5.999,994 → 6.000
  });

  it('aplica o preço mínimo de R$ 19,90', () => {
    expect(monthlyPrice(80_000, 90)).toBe(MIN_MONTHLY_PRICE_CENTS); // 720 < 1.990
  });

  it('rejeita valores inválidos', () => {
    expect(() => monthlyPrice(-1, 90)).toThrow(RangeError);
    expect(() => monthlyPrice(100.5, 90)).toThrow(RangeError);
  });
});

describe('deductible (RN03)', () => {
  it.each([
    ['Premium quebra 15%', 1_500, 60_000],
    ['Básico roubo 25%', 2_500, 100_000],
    ['Premium furto simples 30%', 3_000, 120_000],
  ])('%s de R$ 4.000', (_, bps, expected) => {
    expect(deductible(400_000, bps)).toBe(expected);
  });

  it('arredonda ao centavo mais próximo', () => {
    expect(deductible(333_333, 1_500)).toBe(50_000); // 49.999,95 → 50.000
  });
});

describe('deviceEligibility (RN04)', () => {
  it('aceita aparelho na faixa e recente', () => {
    expect(deviceEligibility(400_000, 2025, 2026)).toBeNull();
    expect(deviceEligibility(80_000, 2023, 2026)).toBeNull(); // limites inclusivos
    expect(deviceEligibility(1_500_000, 2026, 2026)).toBeNull();
  });

  it('recusa valor fora da faixa', () => {
    expect(deviceEligibility(79_999, 2025, 2026)).toBe('VALOR_FORA_DA_FAIXA');
    expect(deviceEligibility(1_500_001, 2025, 2026)).toBe(
      'VALOR_FORA_DA_FAIXA',
    );
  });

  it('recusa modelo com mais de 3 anos', () => {
    expect(deviceEligibility(400_000, 2022, 2026)).toBe('APARELHO_ANTIGO');
  });
});
