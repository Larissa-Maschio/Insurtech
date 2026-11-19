import { rmSync } from 'fs';

export default async function globalTeardown() {
  const db = (globalThis as any).__MYSQL__;
  if (db) await db.stop();
  rmSync('./storage-test', { recursive: true, force: true });
}
