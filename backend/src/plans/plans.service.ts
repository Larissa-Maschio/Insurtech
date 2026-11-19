import { Injectable } from '@nestjs/common';
import { Coverage, Plan, PlanCoverage } from '@prisma/client';
import { notFound } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';

export type PlanWithCoverages = Plan & {
  coverages: (PlanCoverage & { coverage: Coverage })[];
};

export const PLAN_INCLUDE = {
  coverages: {
    include: { coverage: true },
    orderBy: { coverage: { code: 'asc' as const } },
  },
};

export function serializePlan(p: PlanWithCoverages) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    monthlyRateBps: p.monthlyRateBps,
    coverages: p.coverages.map((pc) => ({
      code: pc.coverage.code,
      name: pc.coverage.name,
      description: pc.coverage.description,
      gracePeriodDays: pc.coverage.gracePeriodDays,
      deductibleBps: pc.deductibleBps,
    })),
  };
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const plans = await this.prisma.plan.findMany({
      where: { active: true },
      include: PLAN_INCLUDE,
      orderBy: { sortOrder: 'asc' },
    });
    const allCoverages = await this.prisma.coverage.findMany({
      orderBy: { code: 'asc' },
    });
    return {
      plans: plans.map(serializePlan),
      coverages: allCoverages.map((c) => ({
        code: c.code,
        name: c.name,
        description: c.description,
        gracePeriodDays: c.gracePeriodDays,
      })),
    };
  }

  async get(id: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: PLAN_INCLUDE,
    });
    if (!plan) throw notFound('Plano');
    return serializePlan(plan);
  }
}
