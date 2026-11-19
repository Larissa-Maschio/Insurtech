import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../auth/decorators';
import { AppException } from '../common/app-exception';
import { ClockService } from '../common/clock.service';
import { InsuranceModule } from '../insurance/insurance.module';
import { BillingService } from '../insurance/billing.service';
import { MailService } from '../mail/mail.service';
import { MockPaymentGateway } from '../payments/gateway/mock.gateway';
import { PaymentGateway } from '../payments/gateway/payment-gateway';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentsService } from '../payments/payments.service';

class SimulateDto {
  @ApiProperty({ enum: ['APROVADO', 'RECUSADO'] })
  @IsIn(['APROVADO', 'RECUSADO'])
  status!: 'APROVADO' | 'RECUSADO';
}

class AdvanceDto {
  @ApiProperty({ minimum: 1, maximum: 120 })
  @IsInt()
  @Min(1)
  @Max(120)
  days!: number;
}

class RenewalOutcomeDto {
  @ApiProperty({ enum: ['approve', 'decline'] })
  @IsIn(['approve', 'decline'])
  outcome!: 'approve' | 'decline';
}

/**
 * Ferramentas só de desenvolvimento/demonstração (ENABLE_DEV_TOOLS=true e NODE_ENV != production):
 * simular confirmação do gateway e avançar o relógio para demonstrar renovação e inadimplência.
 */
@ApiTags('dev')
@ApiBearerAuth()
@Controller('dev')
export class DevController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly gateway: PaymentGateway,
    private readonly mock: MockPaymentGateway,
    private readonly clock: ClockService,
    private readonly billing: BillingService,
    private readonly mail: MailService,
  ) {}

  @Post('payments/:id/simulate')
  @ApiOperation({
    summary:
      '[dev] Simula o webhook assinado do gateway mock (aprovar/recusar)',
  })
  async simulate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SimulateDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (this.gateway !== this.mock) {
      throw new AppException(
        'INDISPONIVEL',
        'Simulação disponível apenas com PAYMENT_GATEWAY=mock.',
      );
    }
    await this.payments.getForUser(id, user); // garante que o pagamento é do usuário
    const { body, signature } = this.mock.buildWebhook(
      id,
      dto.status,
      dto.status === 'RECUSADO' ? 'Recusado no checkout simulado' : undefined,
    );
    // Passa pelo mesmo caminho do webhook real (validação de assinatura incluída).
    return this.payments.handleWebhook({
      headers: { 'x-mock-signature': signature },
      query: {},
      body: JSON.parse(body),
      rawBody: Buffer.from(body),
    });
  }

  @Roles(Role.ADMIN)
  @Get('clock')
  @ApiOperation({ summary: '[dev] Data simulada atual' })
  clockNow() {
    return {
      now: this.clock.now(),
      offsetDays: this.clock.offsetDays,
      renewalOutcome: this.mock.renewalOutcome,
    };
  }

  @Roles(Role.ADMIN)
  @Post('clock/advance')
  @ApiOperation({
    summary:
      '[dev] Avança o relógio N dias, rodando a rotina diária de cobrança a cada dia',
  })
  async advance(@Body() dto: AdvanceDto) {
    const totals: Record<string, number> = {};
    for (let i = 0; i < dto.days; i++) {
      this.clock.advanceDays(1);
      const s = await this.billing.runDaily();
      for (const [k, v] of Object.entries(s)) totals[k] = (totals[k] ?? 0) + v;
    }
    return { now: this.clock.now(), offsetDays: this.clock.offsetDays, totals };
  }

  @Roles(Role.ADMIN)
  @Post('clock/reset')
  @ApiOperation({ summary: '[dev] Volta o relógio para a data real' })
  reset() {
    this.clock.reset();
    return { now: this.clock.now() };
  }

  @Roles(Role.ADMIN)
  @Post('billing/run')
  @ApiOperation({ summary: '[dev] Executa a rotina diária de cobrança agora' })
  run() {
    return this.billing.runDaily();
  }

  @Roles(Role.ADMIN)
  @Post('renewal-outcome')
  @ApiOperation({
    summary:
      '[dev] Define se as renovações no cartão (mock) serão aprovadas ou recusadas',
  })
  renewalOutcome(@Body() dto: RenewalOutcomeDto) {
    this.mock.renewalOutcome = dto.outcome;
    return { renewalOutcome: dto.outcome };
  }

  @Roles(Role.ADMIN)
  @Get('emails')
  @ApiOperation({
    summary: '[dev] Últimos e-mails enviados (útil sem SMTP configurado)',
  })
  emails() {
    return [...this.mail.outbox].reverse().slice(0, 50);
  }
}

@Module({
  imports: [PaymentsModule, InsuranceModule],
  controllers: [DevController],
})
export class DevModule {}
