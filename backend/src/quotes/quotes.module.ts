import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, Length } from 'class-validator';
import { Public } from '../auth/decorators';
import { HttpImeiProvider } from './imei/http-imei.provider';
import { ImeiProvider } from './imei/imei-provider';
import { ImeiService } from './imei/imei.service';
import { MockImeiProvider } from './imei/mock-imei.provider';
import { QuotesService } from './quotes.service';

class CreateQuoteDto {
  @ApiProperty({
    example: '350000011234568',
    description: '15 dígitos (máscara é ignorada)',
  })
  @IsString()
  @Length(15, 20)
  imei!: string;
}

@ApiTags('quotes')
@Public()
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Cotação pública: valida o IMEI, consulta o aparelho e devolve os planos com preço e franquia',
  })
  create(@Body() dto: CreateQuoteDto) {
    return this.quotes.create(dto.imei);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retoma uma cotação salva' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.get(id);
  }
}

@Module({
  controllers: [QuotesController],
  providers: [
    QuotesService,
    ImeiService,
    MockImeiProvider,
    HttpImeiProvider,
    {
      provide: ImeiProvider,
      inject: [ConfigService, MockImeiProvider, HttpImeiProvider],
      useFactory: (
        config: ConfigService,
        mock: MockImeiProvider,
        http: HttpImeiProvider,
      ) => (config.get('IMEI_PROVIDER') === 'http' ? http : mock),
    },
  ],
  exports: [QuotesService],
})
export class QuotesModule {}
