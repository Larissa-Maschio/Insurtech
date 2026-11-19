import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  FeedbackStatus,
  Role,
  TicketCategory,
  TicketStatus,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuthUser, CurrentUser, Public, Roles } from '../auth/decorators';
import { PaginationQuery } from '../common/pagination';
import { SupportService } from './support.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class CreateTicketDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(3, 150)
  subject!: string;

  @ApiProperty({ enum: TicketCategory })
  @IsEnum(TicketCategory)
  category!: TicketCategory;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(5, 4000)
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  policyId?: string;
}

class MessageDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 4000)
  body!: string;
}

class TicketStatusDto {
  @ApiProperty({ enum: TicketStatus })
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}

class TicketsQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}

class FeedbackDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  comment?: string;
}

class FeedbackQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: FeedbackStatus })
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;
}

class ModerateDto {
  @ApiProperty({ enum: ['APROVADO', 'REJEITADO'] })
  @IsIn(['APROVADO', 'REJEITADO'])
  status!: FeedbackStatus;
}

@ApiTags('support')
@Controller()
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Public()
  @Get('faqs')
  @ApiOperation({ summary: 'Perguntas frequentes' })
  faqs() {
    return this.support.faqs();
  }

  @Public()
  @Get('feedbacks')
  @ApiOperation({ summary: 'Avaliações aprovadas (públicas) e média' })
  feedbacks(@Query() q: PaginationQuery) {
    return this.support.publicFeedbacks(q);
  }

  @ApiBearerAuth()
  @Post('feedbacks')
  @ApiOperation({
    summary: 'Cliente com apólice envia avaliação (fica pendente de moderação)',
  })
  createFeedback(@CurrentUser() user: AuthUser, @Body() dto: FeedbackDto) {
    return this.support.createFeedback(user, dto.rating, dto.comment);
  }

  @ApiBearerAuth()
  @Post('tickets')
  @ApiOperation({ summary: 'Abre chamado de suporte' })
  createTicket(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.support.createTicket(user, dto);
  }

  @ApiBearerAuth()
  @Get('tickets')
  @ApiOperation({ summary: 'Meus chamados (admin vê todos)' })
  listTickets(@CurrentUser() user: AuthUser, @Query() q: TicketsQuery) {
    return this.support.listTickets(user, q, q.status);
  }

  @ApiBearerAuth()
  @Get('tickets/:id')
  getTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.support.getTicket(id, user);
  }

  @ApiBearerAuth()
  @Post('tickets/:id/messages')
  @ApiOperation({
    summary: 'Envia mensagem no chamado (cliente dono ou atendente)',
  })
  addMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: MessageDto,
  ) {
    return this.support.addMessage(id, user, dto.body);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('admin/tickets/:id/status')
  @ApiOperation({ summary: '[admin] Muda o status do chamado' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: TicketStatusDto,
  ) {
    return this.support.setTicketStatus(id, user, dto.status);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('admin/feedbacks')
  @ApiOperation({ summary: '[admin] Avaliações para moderação' })
  adminFeedbacks(@Query() q: FeedbackQuery) {
    return this.support.adminFeedbacks(q, q.status);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('admin/feedbacks/:id')
  @ApiOperation({ summary: '[admin] Aprova ou rejeita avaliação' })
  moderate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateDto) {
    return this.support.moderateFeedback(id, dto.status);
  }
}

@Module({ controllers: [SupportController], providers: [SupportService] })
export class SupportModule {}
