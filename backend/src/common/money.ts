/** Formata centavos em reais, ex.: 123456 → "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
