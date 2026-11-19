/**
 * Valida IMEI: exatamente 15 dígitos e dígito verificador pelo algoritmo de Luhn (RN04).
 * Recebe o valor já sem máscara.
 */
export function isValidImei(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(imei[14 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Calcula o dígito verificador para os 14 primeiros dígitos (útil para gerar IMEIs de teste). */
export function imeiCheckDigit(first14: string): number {
  for (let d = 0; d <= 9; d++) if (isValidImei(first14 + d)) return d;
  throw new Error('Entrada inválida');
}
