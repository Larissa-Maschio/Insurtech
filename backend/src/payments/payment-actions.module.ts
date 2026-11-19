import { Body, Controller, Module, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { AppException } from '../common/app-exception';
import { ClaimsModule } from '../claims/claims.module';
import { ClaimsService } from '../claims/claims.service';
import { InsuranceModule } from '../insurance/insurance.module';
import { PoliciesService } from '../insurance/policies.service';

class PayDto {
  @ApiPropertyOptional({
    description: 'Pagar a mensalidade em aberto desta apólice',
  })
  @IsOptional()
  @IsUUID()
  policyId?: string;

  @ApiPropertyOptional({ description: 'Pagar a franquia deste sinistro' })
  @IsOptional()
  @IsUUID()
  claimId?: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentActionsController {
  constructor(
    private readonly policies: PoliciesService,
    private readonly claims: ClaimsService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Gera cobrança (Pix ou checkout de cartão) da mensalidade em aberto ou da franquia',
  })
  pay(@CurrentUser() user: AuthUser, @Body() dto: PayDto) {
    if (!!dto.policyId === !!dto.claimId) {
      throw new AppException(
        'DADOS_INVALIDOS',
        'Informe policyId ou claimId.',
        400,
      );
    }
    return dto.policyId
      ? this.policies.payPending(user, dto.policyId, dto.method)
      : this.claims.payDeductible(user, dto.claimId!, dto.method);
  }
}

@Module({
  imports: [InsuranceModule, ClaimsModule],
  controllers: [PaymentActionsController],
})
export class PaymentActionsModule {}
