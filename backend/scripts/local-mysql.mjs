// Sobe um MySQL temporário sem Docker (usa o pacote mysql-memory-server).
// Uso: node scripts/local-mysql.mjs  → mantém o banco rodando na porta 3307 até Ctrl+C.
import { createDB } from 'mysql-memory-server';

const port = Number(process.env.LOCAL_MYSQL_PORT ?? 3307);
const db = await createDB({ port, dbName: 'seguradora', logLevel: 'ERROR' });
console.log(`MySQL local pronto: mysql://root@127.0.0.1:${db.port}/${db.dbName}`);
const stop = async () => { await db.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
