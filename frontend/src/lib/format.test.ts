import { formatBRL, isValidCpf, isValidImei, maskCpf, maskImei, maskPhone } from './format'

describe('formatação e validação', () => {
  it('formata centavos em reais', () => {
    expect(formatBRL(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56')
  })

  it('aplica máscaras', () => {
    expect(maskImei('350000011234560')).toBe('35-000001-123456-0')
    expect(maskCpf('52998224725')).toBe('529.982.247-25')
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321')
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444')
  })

  it('valida IMEI pelo algoritmo de Luhn (igual ao backend)', () => {
    expect(isValidImei('350000011234560')).toBe(true)
    expect(isValidImei('350000011234561')).toBe(false)
    expect(isValidImei('35000001123456')).toBe(false)
  })

  it('valida CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('111.111.111-11')).toBe(false)
  })
})
