import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { ClaimStatus, CoverageCode, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser, Roles } from '../auth/decorators';
import { PaginationQuery } from '../common/pagination';
import { PaymentsModule } from '../payments/payments.module';
import { CLAIM_RULES, ClaimsService, UploadedFile } from './claims.service';

class CreateClaimDto {
  @ApiProperty()
  @IsUUID()
  policyId!: string;

  @ApiProperty({ enum: CoverageCode })
  @IsEnum(CoverageCode)
  type!: CoverageCode;

  @ApiProperty({ example: '2026-11-10T14:30:00.000Z' })
  @Type(() => Date)
  @IsDate()
  occurredAt!: Date;

  @ApiProperty({ example: 'Av. Paulista, 1000 – São Paulo/SP' })
  @IsString()
  @Length(3, 200)
  location!: string;

  @ApiProperty()
  @IsString()
  @Length(20, 2000, {
    message: 'Descreva o ocorrido com pelo menos 20 caracteres',
  })
  description!: string;
}

class DecisionDto {
  @ApiProperty({
    description: 'Motivo registrado no histórico e enviado ao cliente',
  })
  @IsString()
  @Length(5, 500)
  reason!: string;
}

class AdminClaimsQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: ClaimStatus })
  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;
}

@ApiTags('claims')
@ApiBearerAuth()
@Controller()
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Post('claims')
  @ApiOperation({
    summary:
      'Aciona o seguro (valida apólice, carência, cobertura, prazo e limite)',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateClaimDto) {
    return this.claims.create(user, dto);
  }

  @Get('claims')
  @ApiOperation({ summary: 'Meus sinistros' })
  list(@CurrentUser() user: AuthUser) {
    return this.claims.list(user);
  }

  @Get('claims/:id')
  @ApiOperation({
    summary:
      'Detalhe com linha do tempo, documentos e pagamentos (dono ou admin)',
  })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.claims.get(id, user);
  }

  @Post('claims/:id/documents')
  @ApiOperation({
    summary:
      'Envia documentos (JPG, PNG ou PDF, até 5 MB cada, máximo 5 por sinistro)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', CLAIM_RULES.maxDocuments, {
      storage: memoryStorage(),
      limits: {
        fileSize: CLAIM_RULES.maxFileBytes,
        files: CLAIM_RULES.maxDocuments,
      },
    }),
  )
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: UploadedFile[],
  ) {
    return this.claims.uploadDocuments(id, user, files);
  }

  @Get('claims/:id/documents/:docId')
  @ApiOperation({ summary: 'Baixa um documento (somente dono ou admin)' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const doc = await this.claims.openDocument(id, docId, user);
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(doc.name)}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(doc.stream);
  }

  // ---------- Atendente ----------

  @Roles(Role.ADMIN)
  @Get('admin/claims')
  @ApiOperation({ summary: '[admin] Lista sinistros por status' })
  listAdmin(@Query() q: AdminClaimsQuery) {
    return this.claims.listAdmin(q, q.status);
  }

  @Roles(Role.ADMIN)
  @Post('admin/claims/:id/start-analysis')
  @ApiOperation({ summary: '[admin] aberto → em_analise' })
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.claims.startAnalysis(id, user);
  }

  @Roles(Role.ADMIN)
  @Post('admin/claims/:id/approve')
  @ApiOperation({
    summary: '[admin] em_analise → aprovado → aguardando_franquia',
  })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: DecisionDto,
  ) {
    return this.claims.approve(id, user, dto.reason);
  }

  @Roles(Role.ADMIN)
  @Post('admin/claims/:id/deny')
  @ApiOperation({ summary: '[admin] em_analise → negado' })
  deny(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: DecisionDto,
  ) {
    return this.claims.deny(id, user, dto.reason);
  }
}

@Module({
  imports: [PaymentsModule],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
