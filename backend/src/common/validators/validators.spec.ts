import { isValidCpf } from './cpf';
import { imeiCheckDigit, isValidImei } from './imei';

describe('isValidImei (Luhn)', () => {
  it('aceita IMEIs válidos', () => {
    expect(isValidImei('350000011234560')).toBe(true);
    expect(isValidImei('490154203237518')).toBe(true); // exemplo clássico
  });

  it('recusa dígito verificador errado', () => {
    expect(isValidImei('350000011234561')).toBe(false);
    expect(isValidImei('490154203237519')).toBe(false);
  });

  it('recusa tamanho diferente de 15 ou caracteres não numéricos', () => {
    expect(isValidImei('35000001123456')).toBe(false);
    expect(isValidImei('3500000112345600')).toBe(false);
    expect(isValidImei('35000001123456a')).toBe(false);
    expect(isValidImei('')).toBe(false);
  });

  it('calcula o dígito verificador', () => {
    expect(imeiCheckDigit('35000001123456')).toBe(0);
    expect(imeiCheckDigit('49015420323751')).toBe(8);
  });
});

describe('isValidCpf', () => {
  it('aceita CPFs válidos com e sem máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('11144477735')).toBe(true);
  });

  it('recusa dígitos verificadores errados, sequências repetidas e tamanho errado', () => {
    expect(isValidCpf('52998224726')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('1234567890')).toBe(false);
  });
});
