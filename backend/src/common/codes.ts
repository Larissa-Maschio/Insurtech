import { randomInt } from 'crypto';

/** Gera números legíveis para apólices e sinistros, ex.: AP-2026-483920. */
export function humanCode(prefix: string, now: Date): string {
  return `${prefix}-${now.getUTCFullYear()}-${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
}
