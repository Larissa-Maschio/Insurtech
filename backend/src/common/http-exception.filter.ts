import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

const DEFAULT_CODES: Record<number, string> = {
  400: 'DADOS_INVALIDOS',
  401: 'NAO_AUTENTICADO',
  403: 'ACESSO_NEGADO',
  404: 'NAO_ENCONTRADO',
  409: 'CONFLITO',
  413: 'ARQUIVO_GRANDE_DEMAIS',
  422: 'REGRA_DE_NEGOCIO',
  429: 'MUITAS_REQUISICOES',
};

/** Padroniza todas as respostas de erro: { statusCode, code, message, details, path, timestamp }. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpError');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'ERRO_INTERNO';
    let message = 'Ocorreu um erro inesperado. Tente novamente em instantes.';
    let details: unknown;

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = 'MUITAS_REQUISICOES';
      message =
        'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as any;
      code = body?.code ?? DEFAULT_CODES[status] ?? 'ERRO';
      if (Array.isArray(body?.message)) {
        // Erros do ValidationPipe
        message = 'Alguns campos estão inválidos.';
        details = body.message;
      } else {
        message = body?.message ?? exception.message;
        details = body?.details;
      }
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      status = HttpStatus.CONFLICT;
      code = 'CONFLITO';
      message = 'Registro duplicado.';
    } else {
      // Nunca vaza detalhes técnicos; loga sem dados sensíveis do corpo.
      this.logger.error(
        `${req.method} ${req.path}: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }

    res.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
