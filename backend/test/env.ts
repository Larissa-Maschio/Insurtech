// Variáveis fixas dos testes de integração (DATABASE_URL vem do global-setup).
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789';
process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret-0123456789';
process.env.IMEI_PROVIDER = 'mock';
process.env.PAYMENT_GATEWAY = 'mock';
process.env.MOCK_RENEWAL_OUTCOME = 'approve';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.UPLOAD_DIR = './storage-test';
process.env.ENABLE_DEV_TOOLS = 'true';
delete process.env.SMTP_HOST;
