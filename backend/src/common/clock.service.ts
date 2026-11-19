import { Global, Injectable, Module } from '@nestjs/common';

/**
 * Relógio injetável. Todo código de negócio usa clock.now() em vez de new Date(),
 * para os testes (e a demonstração) poderem simular a passagem do tempo.
 */
@Injectable()
export class ClockService {
  private offsetMs = 0;
  private fixed: Date | null = null;

  now(): Date {
    if (this.fixed) return new Date(this.fixed.getTime() + this.offsetMs);
    return new Date(Date.now() + this.offsetMs);
  }

  /** Avança o relógio (testes e rota de desenvolvimento). */
  advanceDays(days: number) {
    this.offsetMs += days * 24 * 60 * 60 * 1000;
  }

  /** Fixa o relógio numa data (testes). */
  set(date: Date) {
    this.fixed = date;
    this.offsetMs = 0;
  }

  reset() {
    this.fixed = null;
    this.offsetMs = 0;
  }

  get offsetDays() {
    return this.offsetMs / (24 * 60 * 60 * 1000);
  }
}

@Global()
@Module({ providers: [ClockService], exports: [ClockService] })
export class ClockModule {}
