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
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsString, IsUUID } from 'class-validator';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { PaymentsModule } from '../payments/payments.module';
import { QuotesModule } from '../quotes/quotes.module';
import { BillingService } from './billing.service';
import { PoliciesService } from './policies.service';
import { SubscriptionsService } from './subscriptions.service';

class PurchaseDto {
  @ApiProperty()
  @IsUUID()
  quoteId!: string;

  @ApiProperty({ description: 'Id ou código do plano escolhido na cotação' })
  @IsString()
  planId!: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}

class ChangePlanDto {
  @ApiProperty({ description: 'Id ou código do novo plano' })
  @IsString()
  planId!: string;
}

@ApiTags('policies')
@ApiBearerAuth()
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Compra: cria apólice aguardando pagamento, assinatura e a 1ª cobrança',
  })
  purchase(@CurrentUser() user: AuthUser, @Body() dto: PurchaseDto) {
    return this.policies.purchase(user, dto.quoteId, dto.planId, dto.method);
  }

  @Get()
  @ApiOperation({ summary: 'Minhas apólices' })
  list(@CurrentUser() user: AuthUser) {
    return this.policies.list(user);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Detalhe da apólice: coberturas, franquias, carências, assinatura e pagamentos',
  })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.policies.get(id, user);
  }
}

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Minhas assinaturas com próxima cobrança e histórico',
  })
  list(@CurrentUser() user: AuthUser) {
    return this.subs.list(user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.subs.get(id, user);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancela: a cobertura vale até o fim do ciclo pago (RN09)',
  })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.subs.cancel(id, user);
  }

  @Post(':id/change-plan')
  @ApiOperation({ summary: 'Agenda troca de plano para o próximo ciclo' })
  changePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePlanDto,
  ) {
    return this.subs.changePlan(id, user, dto.planId);
  }
}

@Module({
  imports: [PaymentsModule, QuotesModule],
  controllers: [PoliciesController, SubscriptionsController],
  providers: [PoliciesService, SubscriptionsService, BillingService],
  exports: [PoliciesService, BillingService],
})
export class InsuranceModule {}
