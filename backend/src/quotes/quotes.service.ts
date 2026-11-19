import { HttpStatus, Injectable } from '@nestjs/common';
import { PolicyStatus, Prisma } from '@prisma/client';
import { AppException, notFound } from '../common/app-exception';
import { ClockService } from '../common/clock.service';
import { addDays } from '../common/dates';
import { formatBRL } from '../common/money';
import { isValidImei } from '../common/validators/imei';
import { PLAN_INCLUDE, serializePlan } from '../plans/plans.service';
import {
  deductible,
  DEVICE_VALUE_MAX_CENTS,
  DEVICE_VALUE_MIN_CENTS,
  deviceEligibility,
  MAX_DEVICE_AGE_YEARS,
  monthlyPrice,
  QUOTE_VALIDITY_DAYS,
} from '../pricing/pricing';
import { PrismaService } from '../prisma/prisma.service';
import { ImeiProviderError } from './imei/imei-provider';
import { ImeiService } from './imei/imei.service';

/** Status de apólice que ocupam o IMEI (RN04). */
export const BLOCKING_POLICY_STATUSES: PolicyStatus[] = [
  PolicyStatus.ATIVA,
  PolicyStatus.SUSPENSA,
];

const quoteInclude = {
  items: {
    include: { plan: { include: PLAN_INCLUDE } },
    orderBy: { plan: { sortOrder: 'asc' as const } },
  },
} satisfies Prisma.QuoteInclude;

type QuoteFull = Prisma.QuoteGetPayload<{ include: typeof quoteInclude }>;

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imei: ImeiService,
    private readonly clock: ClockService,
  ) {}

  async create(rawImei: string) {
    const imei = rawImei.replace(/\D/g, '');
    if (!isValidImei(imei)) {
      throw new AppException(
        'IMEI_INVALIDO',
        'IMEI inválido. Confira os 15 dígitos (disque *#06# para ver o seu).',
        HttpStatus.BAD_REQUEST,
      );
    }

    let info;
    try {
      info = await this.imei.lookup(imei);
    } catch (err) {
      if (err instanceof ImeiProviderError) {
        throw new AppException(
          'IMEI_SERVICO_INDISPONIVEL',
          err.reason === 'LIMITE'
            ? 'Estamos com muitas consultas no momento. Tente novamente em alguns minutos.'
            : 'Não conseguimos consultar o IMEI agora. Tente novamente em instantes.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw err;
    }

    if (info.blacklisted) {
      throw new AppException(
        'APARELHO_BLOQUEADO',
        'Este aparelho consta como bloqueado (roubo ou perda) e não pode ser segurado.',
      );
    }
    const model =
      info.brand && info.model
        ? await this.prisma.deviceModel.findFirst({
            where: { brand: info.brand, model: info.model },
          })
        : null;
    if (!model) {
      throw new AppException(
        'MODELO_NAO_ENCONTRADO',
        'Ainda não oferecemos seguro para este modelo de aparelho.',
        undefined,
        {
          brand: info.brand,
          model: info.model,
        },
      );
    }

    const now = this.clock.now();
    const issue = deviceEligibility(
      model.valueCents,
      model.releaseYear,
      now.getUTCFullYear(),
    );
    if (issue === 'VALOR_FORA_DA_FAIXA') {
      throw new AppException(
        issue,
        `Aceitamos aparelhos com valor entre ${formatBRL(DEVICE_VALUE_MIN_CENTS)} e ${formatBRL(DEVICE_VALUE_MAX_CENTS)}.`,
      );
    }
    if (issue === 'APARELHO_ANTIGO') {
      throw new AppException(
        issue,
        `Aceitamos modelos lançados há no máximo ${MAX_DEVICE_AGE_YEARS} anos.`,
      );
    }

    const busy = await this.prisma.policy.findFirst({
      where: { device: { imei }, status: { in: BLOCKING_POLICY_STATUSES } },
    });
    if (busy) {
      throw new AppException(
        'APOLICE_EXISTENTE',
        'Este aparelho já possui um seguro ativo.',
      );
    }

    const plans = await this.prisma.plan.findMany({ where: { active: true } });
    const quote = await this.prisma.quote.create({
      data: {
        imei,
        brand: model.brand,
        model: model.model,
        deviceValueCents: model.valueCents,
        expiresAt: addDays(now, QUOTE_VALIDITY_DAYS),
        items: {
          create: plans.map((p) => ({
            planId: p.id,
            monthlyPriceCents: monthlyPrice(model.valueCents, p.monthlyRateBps),
          })),
        },
      },
      include: quoteInclude,
    });
    return this.serialize(quote);
  }

  async get(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: quoteInclude,
    });
    if (!quote) throw notFound('Cotação');
    return this.serialize(quote);
  }

  /** Usado pela compra: devolve a cotação válida e o item do plano escolhido. */
  async getValidItem(quoteId: string, planId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: quoteInclude,
    });
    if (!quote) throw notFound('Cotação');
    if (quote.expiresAt <= this.clock.now()) {
      throw new AppException(
        'COTACAO_EXPIRADA',
        'Esta cotação expirou. Faça uma nova cotação.',
      );
    }
    const item = quote.items.find(
      (i) => i.planId === planId || i.plan.code === planId,
    );
    if (!item)
      throw new AppException(
        'PLANO_INVALIDO',
        'Plano não disponível nesta cotação.',
      );
    return { quote, item };
  }

  serialize(q: QuoteFull) {
    return {
      id: q.id,
      imei: q.imei,
      brand: q.brand,
      model: q.model,
      deviceValueCents: q.deviceValueCents,
      expiresAt: q.expiresAt,
      expired: q.expiresAt <= this.clock.now(),
      plans: q.items.map((i) => {
        const plan = serializePlan(i.plan);
        return {
          ...plan,
          monthlyPriceCents: i.monthlyPriceCents,
          coverages: plan.coverages.map((c) => ({
            ...c,
            deductibleCents: deductible(q.deviceValueCents, c.deductibleBps),
          })),
        };
      }),
    };
  }
}
