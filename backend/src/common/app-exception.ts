import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Erro de negócio com código estável, usado pelo frontend para exibir mensagens.
 * Formato da resposta: { statusCode, code, message, details?, path, timestamp }.
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export const notFound = (what: string) =>
  new AppException(
    'NAO_ENCONTRADO',
    `${what} não encontrado(a).`,
    HttpStatus.NOT_FOUND,
  );

export const forbidden = () =>
  new AppException(
    'ACESSO_NEGADO',
    'Você não tem permissão para acessar este recurso.',
    HttpStatus.FORBIDDEN,
  );
