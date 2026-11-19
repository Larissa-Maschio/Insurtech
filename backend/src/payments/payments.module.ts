import {
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthUser, CurrentUser, Public } from '../auth/decorators';
import { MercadoPagoGateway } from './gateway/mercadopago.gateway';
import { MockPaymentGateway } from './gateway/mock.gateway';
import { PaymentGateway } from './gateway/payment-gateway';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('webhook')
  @ApiOperation({
    summary:
      'Webhook do gateway: valida assinatura e atualiza pagamento (idempotente)',
  })
  webhook(@Req() req: Request & { rawBody?: Buffer }) {
    return this.payments.handleWebhook({
      headers: req.headers,
      query: req.query as Record<string, unknown>,
      body: req.body,
      rawBody: req.rawBody,
    });
  }

  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Status de um pagamento (dono ou admin)' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.payments.getForUser(id, user);
  }
}

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockPaymentGateway,
    MercadoPagoGateway,
    {
      provide: PaymentGateway,
      inject: [ConfigService, MockPaymentGateway, MercadoPagoGateway],
      useFactory: (
        config: ConfigService,
        mock: MockPaymentGateway,
        mp: MercadoPagoGateway,
      ) => (config.get('PAYMENT_GATEWAY') === 'mercadopago' ? mp : mock),
    },
  ],
  exports: [PaymentsService, MockPaymentGateway, PaymentGateway],
})
export class PaymentsModule {}
