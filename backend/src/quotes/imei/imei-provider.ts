export interface ImeiInfo {
  brand: string | null;
  model: string | null;
  /** Aparelho com restrição (roubo/perda) em base de bloqueio. */
  blacklisted: boolean;
}

/** Falha técnica da consulta externa (timeout, erro HTTP, limite excedido). */
export class ImeiProviderError extends Error {
  constructor(
    message: string,
    public readonly reason: 'TIMEOUT' | 'LIMITE' | 'INDISPONIVEL',
  ) {
    super(message);
  }
}

/** Contrato para qualquer fonte de consulta de IMEI (mock ou API real). */
export abstract class ImeiProvider {
  abstract readonly name: string;
  abstract lookup(imei: string): Promise<ImeiInfo>;
}
