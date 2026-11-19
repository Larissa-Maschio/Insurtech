import { execSync } from 'child_process';

/**
 * Prepara um banco MySQL limpo para os testes de integração.
 * - Com E2E_DATABASE_URL (ex.: serviço MySQL da CI ou docker compose), usa esse banco.
 * - Sem ela, sobe um MySQL temporário com mysql-memory-server (não precisa de Docker).
 * Em seguida aplica as migrations e o seed base.
 */
export default async function globalSetup() {
  let url = process.env.E2E_DATABASE_URL;
  if (!url) {
    const { createDB } = await import('mysql-memory-server');
    const db = await createDB({ dbName: 'seguradora_test', logLevel: 'ERROR' });
    (globalThis as any).__MYSQL__ = db;
    url = `mysql://root@127.0.0.1:${db.port}/${db.dbName}`;
  }
  process.env.DATABASE_URL = url;
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma migrate reset --force --skip-generate', {
    env,
    stdio: 'inherit',
  });
}
