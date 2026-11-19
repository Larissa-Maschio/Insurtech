import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SentMail {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envio de e-mails transacionais. Em desenvolvimento usa o Mailpit (SMTP de teste do docker compose).
 * Sem SMTP_HOST, apenas registra no log. Falha de envio nunca derruba o fluxo de negócio.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;
  readonly frontendUrl: string;
  /** Últimos e-mails enviados (usado nos testes). */
  readonly outbox: SentMail[] = [];

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from =
      config.get('MAIL_FROM') ??
      'Seguradora de Celular <nao-responda@seguradora.local>';
    this.frontendUrl = config.get('FRONTEND_URL') ?? 'http://localhost:5173';
    this.transporter =
      host && config.get('NODE_ENV') !== 'test'
        ? nodemailer.createTransport({
            host,
            port: Number(config.get('SMTP_PORT') ?? 1025),
            secure: false,
            auth: config.get('SMTP_USER')
              ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') }
              : undefined,
          })
        : null;
  }

  async send(
    to: string,
    subject: string,
    bodyHtml: string,
    cta?: { label: string; path: string },
  ) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
        <h2 style="color:#4338ca">Seguradora de Celular</h2>
        ${bodyHtml}
        ${
          cta
            ? `<p><a href="${this.frontendUrl}${cta.path}" style="background:#4338ca;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${cta.label}</a></p>`
            : ''
        }
        <p style="font-size:12px;color:#6b7280">Este é um e-mail automático, não responda.</p>
      </div>`;
    this.outbox.push({ to, subject, html });
    if (this.outbox.length > 200) this.outbox.shift();
    if (!this.transporter) {
      this.logger.log(`[e-mail simulado] para=${to} assunto="${subject}"`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.warn(
        `Falha ao enviar e-mail "${subject}": ${(err as Error).message}`,
      );
    }
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
