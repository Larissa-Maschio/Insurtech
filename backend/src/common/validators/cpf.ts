import { registerDecorator, ValidationOptions } from 'class-validator';

/** Valida CPF (11 dígitos + 2 dígitos verificadores). Aceita com ou sem máscara. */
export function isValidCpf(input: string): boolean {
  const cpf = (input ?? '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function IsCpf(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName,
      options: { message: 'CPF inválido', ...options },
      validator: {
        validate: (v: unknown) => typeof v === 'string' && isValidCpf(v),
      },
    });
}
