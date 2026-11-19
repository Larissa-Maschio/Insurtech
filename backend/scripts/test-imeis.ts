// Lista IMEIs válidos (Luhn) para cada aparelho do MockImeiProvider. Uso: npx ts-node scripts/test-imeis.ts
import { imeiCheckDigit } from '../src/common/validators/imei';
import { MOCK_TACS, MOCK_UNAVAILABLE_TAC } from '../src/quotes/imei/mock-imei.provider';

const rows = Object.entries(MOCK_TACS).map(([tac, d]) => [tac, `${d.brand} ${d.model}${d.blacklisted ? ' (bloqueado)' : ''}`]);
rows.push([MOCK_UNAVAILABLE_TAC, 'simula API de IMEI fora do ar']);
for (const [tac, label] of rows) {
  const base = `${tac}123456`;
  console.log(`${base}${imeiCheckDigit(base)}  ${label}`);
}
