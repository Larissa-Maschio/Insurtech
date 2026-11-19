import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClaimStatus,
  CoverageCode,
  Payment,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  PolicyStatus,
  Prisma,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { join, resolve } from 'path';
import { AuthUser } from '../auth/decorators';
import { AppException, forbidden, notFound } from '../common/app-exception';
import { ClockService } from '../common/clock.service';
import { humanCode } from '../common/codes';
import { addDays, daysBetween } from '../common/dates';
import { formatBRL } from '../common/money';
import { paginated, PaginationQuery } from '../common/pagination';
import { assertTransition, CLAIM_TRANSITIONS } from '../domain/transitions';
import { MailService } from '../mail/mail.service';
import {
  PaymentHandler,
  PaymentsService,
  serializePayment,
} from '../payments/payments.service';
import { deductible } from '../pricing/pricing';
import { PrismaService } from '../prisma/prisma.service';

/** Regras do sinistro (RN10). */
export const CLAIM_RULES = {
  reportWithinDays: 30,
  maxClaimsPer12Months: 2,
  maxDocuments: 5,
  maxFileBytes: 5 * 1024 * 1024,
};

export const REQUIRED_DOCUMENTS: Record<CoverageCode, string[]> = {
  ROUBO: ['Boletim de ocorrência', 'Documento de identidade com foto'],
  FURTO_QUALIFICADO: [
    'Boletim de ocorrência',
    'Documento de identidade com foto',
  ],
  FURTO_SIMPLES: ['Boletim de ocorrência', 'Documento de identidade com foto'],
  QUEBRA_ACIDENTAL: ['Fotos do aparelho (mínimo 2)'],
  DANO_LIQUIDO: ['Fotos do aparelho (mínimo 2)'],
};

const THEFT_TYPES: CoverageCode[] = [
  CoverageCode.ROUBO,
  CoverageCode.FURTO_QUALIFICADO,
  CoverageCode.FURTO_SIMPLES,
];

const ALLOWED_FILES: {
  mime: string;
  ext: string;
  magic: (b: Buffer) => boolean;
}[] = [
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    ext: 'png',
    magic: (b) =>
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'application/pdf',
    ext: 'pdf',
    magic: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  },
];

const claimInclude = {
  policy: { include: { device: true, plan: true, user: true } },
  documents: { orderBy: { createdAt: 'asc' as const } },
  events: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { name: true, role: true } } },
  },
  payments: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.ClaimInclude;
type ClaimFull = Prisma.ClaimGetPayload<{ include: typeof claimInclude }>;

export interface CreateClaimInput {
  policyId: string;
  type: CoverageCode;
  occurredAt: Date;
  location: string;
  description: string;
}

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class ClaimsService implements PaymentHandler, OnModuleInit {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly clock: ClockService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.uploadDir = resolve(config.get('UPLOAD_DIR') ?? './storage');
  }

  onModuleInit() {
    this.payments.registerHandler(PaymentPurpose.FRANQUIA, this);
  }

  /** Abertura com todas as validações de elegibilidade (RN10). */
  async create(user: AuthUser, input: CreateClaimInput) {
    const policy = await this.prisma.policy.findUnique({
      where: { id: input.policyId },
      include: {
        plan: { include: { coverages: { include: { coverage: true } } } },
        device: true,
      },
    });
    if (!policy) throw notFound('Apólice');
    if (policy.userId !== user.id) throw forbidden();

    const now = this.clock.now();
    if (policy.status !== PolicyStatus.ATIVA || !policy.startsAt) {
      const reason =
        policy.status === PolicyStatus.SUSPENSA
          ? 'Sua apólice está suspensa por falta de pagamento. Regularize a mensalidade para acionar o seguro.'
          : 'É preciso ter uma apólice ativa para acionar o seguro.';
      throw new AppException('APOLICE_INATIVA', reason);
    }

    const pc = policy.plan.coverages.find(
      (c) => c.coverage.code === input.type,
    );
    if (!pc) {
      throw new AppException(
        'COBERTURA_NAO_CONTRATADA',
        `O plano ${policy.plan.name} não inclui esta cobertura.`,
      );
    }

    const graceEnds = addDays(policy.startsAt, pc.coverage.gracePeriodDays);
    if (now < graceEnds) {
      throw new AppException(
        'EM_CARENCIA',
        `Esta cobertura está em carência até ${graceEnds.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}.`,
        undefined,
        { graceEndsAt: graceEnds },
      );
    }

    if (input.occurredAt > now) {
      throw new AppException(
        'DATA_INVALIDA',
        'A data do ocorrido não pode estar no futuro.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (input.occurredAt < policy.startsAt) {
      throw new AppException(
        'EVENTO_FORA_DA_VIGENCIA',
        'O ocorrido é anterior ao início da sua apólice.',
      );
    }
    if (daysBetween(input.occurredAt, now) > CLAIM_RULES.reportWithinDays) {
      throw new AppException(
        'FORA_DO_PRAZO',
        `O acionamento precisa ser feito em até ${CLAIM_RULES.reportWithinDays} dias após o ocorrido.`,
      );
    }

    const open = await this.prisma.claim.count({
      where: {
        policyId: policy.id,
        status: { notIn: [ClaimStatus.NEGADO, ClaimStatus.CONCLUIDO] },
      },
    });
    if (open > 0) {
      throw new AppException(
        'SINISTRO_EM_ANDAMENTO',
        'Já existe um sinistro em andamento para esta apólice.',
        HttpStatus.CONFLICT,
      );
    }
    const recent = await this.prisma.claim.count({
      where: {
        policyId: policy.id,
        status: { not: ClaimStatus.NEGADO },
        createdAt: { gte: addDays(now, -365) },
      },
    });
    if (recent >= CLAIM_RULES.maxClaimsPer12Months) {
      throw new AppException(
        'LIMITE_DE_SINISTROS',
        `O limite de ${CLAIM_RULES.maxClaimsPer12Months} sinistros a cada 12 meses foi atingido.`,
      );
    }

    const claim = await this.prisma.claim.create({
      data: {
        number: humanCode('SN', now),
        createdAt: now,
        policyId: policy.id,
        userId: user.id,
        type: input.type,
        occurredAt: input.occurredAt,
        location: input.location,
        description: input.description,
        deductibleCents: deductible(policy.deviceValueCents, pc.deductibleBps),
        events: {
          create: {
            toStatus: ClaimStatus.ABERTO,
            actorId: user.id,
            note: 'Sinistro aberto pelo cliente',
          },
        },
      },
    });
    await this.mail.send(
      user.email,
      `Sinistro ${claim.number} recebido`,
      `<p>Olá, ${user.name}.</p><p>Recebemos o acionamento do seu seguro. Envie os documentos solicitados para agilizar a análise.</p>`,
      { label: 'Acompanhar sinistro', path: `/conta/sinistros/${claim.id}` },
    );
    return this.get(claim.id, user);
  }

  async uploadDocuments(id: string, user: AuthUser, files: UploadedFile[]) {
    const claim = await this.findOwned(id, user, { ownerOnly: true });
    if (
      !([ClaimStatus.ABERTO, ClaimStatus.EM_ANALISE] as ClaimStatus[]).includes(
        claim.status,
      )
    ) {
      throw new AppException(
        'ENVIO_ENCERRADO',
        'Não é mais possível enviar documentos para este sinistro.',
      );
    }
    if (!files?.length)
      throw new AppException(
        'SEM_ARQUIVOS',
        'Selecione ao menos um arquivo.',
        HttpStatus.BAD_REQUEST,
      );
    if (claim.documents.length + files.length > CLAIM_RULES.maxDocuments) {
      throw new AppException(
        'LIMITE_DE_ARQUIVOS',
        `Envie no máximo ${CLAIM_RULES.maxDocuments} arquivos por sinistro.`,
      );
    }

    const accepted = files.map((f) => {
      if (f.size > CLAIM_RULES.maxFileBytes) {
        throw new AppException(
          'ARQUIVO_GRANDE_DEMAIS',
          `"${f.originalname}" tem mais de 5 MB.`,
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      // Confere o conteúdo real (assinatura do arquivo), não só a extensão ou o mimetype informado.
      const type = ALLOWED_FILES.find((t) => t.magic(f.buffer));
      if (!type) {
        throw new AppException(
          'TIPO_DE_ARQUIVO_INVALIDO',
          `"${f.originalname}" não é JPG, PNG ou PDF.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      return { file: f, type };
    });

    const dir = join(this.uploadDir, 'claims', claim.id);
    await fs.mkdir(dir, { recursive: true });
    for (const { file, type } of accepted) {
      const name = `${randomUUID()}.${type.ext}`;
      await fs.writeFile(join(dir, name), file.buffer);
      await this.prisma.claimDocument.create({
        data: {
          claimId: claim.id,
          originalName: file.originalname.slice(0, 255),
          mimeType: type.mime,
          sizeBytes: file.size,
          storagePath: join('claims', claim.id, name),
        },
      });
    }
    return this.get(claim.id, user);
  }

  /** Entrega o arquivo apenas ao dono do sinistro ou a um admin. */
  async openDocument(id: string, docId: string, user: AuthUser) {
    const claim = await this.findOwned(id, user);
    const doc = claim.documents.find((d) => d.id === docId);
    if (!doc) throw notFound('Documento');
    const full = resolve(this.uploadDir, doc.storagePath);
    if (!full.startsWith(this.uploadDir)) throw forbidden();
    return {
      stream: createReadStream(full),
      mimeType: doc.mimeType,
      name: doc.originalName,
    };
  }

  async list(user: AuthUser) {
    const claims = await this.prisma.claim.findMany({
      where: { userId: user.id },
      include: claimInclude,
      orderBy: { createdAt: 'desc' },
    });
    return claims.map((c) => this.serialize(c));
  }

  async listAdmin(q: PaginationQuery, status?: ClaimStatus) {
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.claim.findMany({
        where,
        include: claimInclude,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.claim.count({ where }),
    ]);
    return paginated(
      rows.map((c) => this.serialize(c)),
      total,
      q,
    );
  }

  async get(id: string, user: AuthUser) {
    return this.serialize(await this.findOwned(id, user));
  }

  // ---------- Ações do atendente ----------

  async startAnalysis(id: string, admin: AuthUser) {
    const claim = await this.findOwned(id, admin);
    await this.transition(
      claim,
      ClaimStatus.EM_ANALISE,
      admin.id,
      'Análise iniciada',
    );
    await this.notify(
      claim,
      'Seu sinistro está em análise',
      '<p>Nossa equipe começou a analisar o seu sinistro.</p>',
    );
    return this.get(id, admin);
  }

  async approve(id: string, admin: AuthUser, reason: string) {
    const claim = await this.findOwned(id, admin);
    await this.transition(claim, ClaimStatus.APROVADO, admin.id, reason, {
      decisionReason: reason,
    });
    if (claim.deductibleCents > 0) {
      await this.transition(
        { ...claim, status: ClaimStatus.APROVADO },
        ClaimStatus.AGUARDANDO_FRANQUIA,
        null,
        `Franquia de ${formatBRL(claim.deductibleCents)} disponível para pagamento`,
      );
      await this.notify(
        claim,
        'Sinistro aprovado',
        `<p>Seu sinistro foi aprovado. Pague a franquia de ${formatBRL(claim.deductibleCents)} para seguirmos com a ${THEFT_TYPES.includes(claim.type) ? 'reposição do aparelho' : 'reparo do aparelho'}.</p>`,
      );
    } else {
      await this.complete({ ...claim, status: ClaimStatus.APROVADO });
    }
    return this.get(id, admin);
  }

  async deny(id: string, admin: AuthUser, reason: string) {
    const claim = await this.findOwned(id, admin);
    await this.transition(claim, ClaimStatus.NEGADO, admin.id, reason, {
      decisionReason: reason,
    });
    await this.notify(
      claim,
      'Sinistro negado',
      `<p>Após análise, seu sinistro foi negado.</p><p><strong>Motivo:</strong> ${escapeHtml(reason)}</p>`,
    );
    return this.get(id, admin);
  }

  async payDeductible(user: AuthUser, id: string, method: PaymentMethod) {
    const claim = await this.findOwned(id, user, { ownerOnly: true });
    if (claim.status !== ClaimStatus.AGUARDANDO_FRANQUIA) {
      throw new AppException(
        'SEM_FRANQUIA_ABERTA',
        'Não há franquia a pagar para este sinistro.',
      );
    }
    await this.payments.expirePending({ claimId: claim.id });
    const payment = await this.payments.createCharge({
      purpose: PaymentPurpose.FRANQUIA,
      claimId: claim.id,
      attempt: claim.payments.length + 1,
      amountCents: claim.deductibleCents,
      method,
      description: `Franquia do sinistro ${claim.number}`,
      payer: {
        email: claim.policy.user.email,
        name: claim.policy.user.name,
        cpf: claim.policy.user.cpf,
      },
    });
    return serializePayment(payment);
  }

  // ---------- Reações ao pagamento da franquia ----------

  async onApproved(payment: Payment) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: payment.claimId! },
      include: claimInclude,
    });
    if (!claim || claim.status !== ClaimStatus.AGUARDANDO_FRANQUIA) return;
    await this.complete(claim);
  }

  async onFailed(payment: Payment) {
    if (payment.status !== PaymentStatus.RECUSADO) return;
    const claim = await this.prisma.claim.findUnique({
      where: { id: payment.claimId! },
      include: claimInclude,
    });
    if (claim) {
      await this.notify(
        claim,
        'Pagamento da franquia recusado',
        '<p>O pagamento da franquia foi recusado. Tente novamente com outra forma de pagamento.</p>',
      );
    }
  }

  private async complete(claim: ClaimFull) {
    const isTheft = THEFT_TYPES.includes(claim.type);
    const note = isTheft
      ? 'Franquia quitada. Reposição do aparelho encaminhada.'
      : 'Franquia quitada. Reparo do aparelho encaminhado à assistência técnica.';
    await this.transition(claim, ClaimStatus.CONCLUIDO, null, note);

    if (isTheft) {
      // Aparelho substituído: a apólice deste IMEI é encerrada (RN10).
      await this.prisma.policy.update({
        where: { id: claim.policyId },
        data: { status: PolicyStatus.ENCERRADA },
      });
      const sub = await this.prisma.subscription.findUnique({
        where: { policyId: claim.policyId },
      });
      if (sub && sub.status !== SubscriptionStatus.CANCELADA) {
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: SubscriptionStatus.CANCELADA,
            canceledAt: this.clock.now(),
          },
        });
        await this.payments.expirePending({ subscriptionId: sub.id });
      }
    }
    await this.notify(
      claim,
      'Sinistro concluído',
      `<p>${note}</p>${isTheft ? '<p>Sua apólice para o aparelho antigo foi encerrada. Faça uma nova cotação para segurar o novo aparelho.</p>' : ''}`,
    );
  }

  private async transition(
    claim: { id: string; status: ClaimStatus },
    to: ClaimStatus,
    actorId: string | null,
    note: string,
    extra: Prisma.ClaimUpdateInput = {},
  ) {
    assertTransition(CLAIM_TRANSITIONS, claim.status, to, 'o sinistro');
    // Update condicional: evita duas decisões concorrentes sobre o mesmo sinistro.
    const { count } = await this.prisma.claim.updateMany({
      where: { id: claim.id, status: claim.status },
      data: { status: to, ...(extra as Prisma.ClaimUpdateManyMutationInput) },
    });
    if (count === 0) {
      throw new AppException(
        'CONFLITO',
        'O sinistro foi alterado por outra pessoa. Recarregue a página.',
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.claimEvent.create({
      data: {
        claimId: claim.id,
        fromStatus: claim.status,
        toStatus: to,
        actorId,
        note,
      },
    });
  }

  private async notify(claim: ClaimFull, subject: string, body: string) {
    await this.mail.send(
      claim.policy.user.email,
      `${subject} – ${claim.number}`,
      `<p>Olá, ${claim.policy.user.name}.</p>${body}`,
      { label: 'Ver sinistro', path: `/conta/sinistros/${claim.id}` },
    );
  }

  private async findOwned(
    id: string,
    user: AuthUser,
    opts: { ownerOnly?: boolean } = {},
  ) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
      include: claimInclude,
    });
    if (!claim) throw notFound('Sinistro');
    const isOwner = claim.userId === user.id;
    if (!isOwner && (opts.ownerOnly || user.role !== Role.ADMIN))
      throw forbidden();
    return claim;
  }

  serialize(c: ClaimFull) {
    return {
      id: c.id,
      number: c.number,
      status: c.status,
      type: c.type,
      occurredAt: c.occurredAt,
      location: c.location,
      description: c.description,
      deductibleCents: c.deductibleCents,
      decisionReason: c.decisionReason,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      requiredDocuments: REQUIRED_DOCUMENTS[c.type],
      policy: {
        id: c.policy.id,
        number: c.policy.number,
        status: c.policy.status,
        plan: c.policy.plan.name,
        device: `${c.policy.device.brand} ${c.policy.device.model}`,
        imei: c.policy.device.imei,
      },
      customer: { name: c.policy.user.name, email: c.policy.user.email },
      documents: c.documents.map((d) => ({
        id: d.id,
        name: d.originalName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        createdAt: d.createdAt,
      })),
      events: c.events.map((e) => ({
        id: e.id,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        note: e.note,
        actor: e.actor
          ? e.actor.role === Role.ADMIN
            ? 'Atendente'
            : e.actor.name
          : 'Sistema',
        createdAt: e.createdAt,
      })),
      payments: c.payments.map(serializePayment),
    };
  }
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        ch
      ]!,
  );
}
