import { Controller, Get, Module, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';
import { PlansService } from './plans.service';

@ApiTags('plans')
@Public()
@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista planos ativos com coberturas, franquias e carências',
  })
  list() {
    return this.plans.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de um plano (por id ou código)' })
  get(@Param('id') id: string) {
    return this.plans.get(id);
  }
}

@Module({
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
