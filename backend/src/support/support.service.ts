import { Injectable } from '@nestjs/common';
import {
  FeedbackStatus,
  PolicyStatus,
  Prisma,
  Role,
  TicketCategory,
  TicketStatus,
} from '@prisma/client';
import { AuthUser } from '../auth/decorators';
import { AppException, forbidden, notFound } from '../common/app-exception';
import { paginated, PaginationQuery } from '../common/pagination';
import { assertTransition, TICKET_TRANSITIONS } from '../domain/transitions';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const ticketInclude = {
  user: { select: { id: true, name: true, email: true } },
  policy: { select: { id: true, number: true } },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, name: true, role: true } } },
  },
} satisfies Prisma.TicketInclude;
type TicketFull = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  faqs() {
    return this.prisma.faq.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, question: true, answer: true },
    });
  }

  // ---------- Tickets ----------

  async createTicket(
    user: AuthUser,
    dto: {
      subject: string;
      category: TicketCategory;
      message: string;
      policyId?: string;
    },
  ) {
    if (dto.policyId) {
      const policy = await this.prisma.policy.findUnique({
        where: { id: dto.policyId },
      });
      if (!policy || policy.userId !== user.id) throw notFound('Apólice');
    }
    const ticket = await this.prisma.ticket.create({
      data: {
        userId: user.id,
        policyId: dto.policyId,
        subject: dto.subject,
        category: dto.category,
        messages: { create: { authorId: user.id, body: dto.message } },
      },
      include: ticketInclude,
    });
    return this.serialize(ticket);
  }

  async listTickets(user: AuthUser, q: PaginationQuery, status?: TicketStatus) {
    const where: Prisma.TicketWhereInput = {
      ...(user.role === Role.ADMIN ? {} : { userId: user.id }),
      ...(status ? { status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: ticketInclude,
        orderBy: { updatedAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return paginated(
      rows.map((t) => this.serialize(t, { summary: true })),
      total,
      q,
    );
  }

  async getTicket(id: string, user: AuthUser) {
    return this.serialize(await this.findTicket(id, user));
  }

  /** Cliente responde (reabre se estava resolvido); atendente responde (passa a em andamento e avisa por e-mail). */
  async addMessage(id: string, user: AuthUser, body: string) {
    const ticket = await this.findTicket(id, user);
    const isAdmin = user.role === Role.ADMIN;
    let status = ticket.status;
    if (isAdmin && ticket.status === TicketStatus.ABERTO)
      status = TicketStatus.EM_ANDAMENTO;
    if (!isAdmin && ticket.status === TicketStatus.RESOLVIDO)
      status = TicketStatus.ABERTO;

    await this.prisma.ticket.update({
      where: { id },
      data: { status, messages: { create: { authorId: user.id, body } } },
    });
    if (isAdmin) {
      await this.mail.send(
        ticket.user.email,
        `Nova resposta no seu chamado: ${ticket.subject}`,
        `<p>Olá, ${ticket.user.name}.</p><p>Nossa equipe respondeu ao seu chamado.</p>`,
        { label: 'Ver resposta', path: `/conta/suporte/${id}` },
      );
    }
    return this.getTicket(id, user);
  }

  async setTicketStatus(id: string, admin: AuthUser, status: TicketStatus) {
    const ticket = await this.findTicket(id, admin);
    assertTransition(TICKET_TRANSITIONS, ticket.status, status, 'o chamado');
    await this.prisma.ticket.update({ where: { id }, data: { status } });
    if (status === TicketStatus.RESOLVIDO) {
      await this.mail.send(
        ticket.user.email,
        `Chamado resolvido: ${ticket.subject}`,
        `<p>Olá, ${ticket.user.name}.</p><p>Seu chamado foi marcado como resolvido. Se precisar, é só responder para reabri-lo.</p>`,
        { label: 'Ver chamado', path: `/conta/suporte/${id}` },
      );
    }
    return this.getTicket(id, admin);
  }

  private async findTicket(id: string, user: AuthUser): Promise<TicketFull> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: ticketInclude,
    });
    if (!ticket) throw notFound('Chamado');
    if (user.role !== Role.ADMIN && ticket.userId !== user.id)
      throw forbidden();
    return ticket;
  }

  private serialize(t: TicketFull, opts: { summary?: boolean } = {}) {
    const last = t.messages[t.messages.length - 1];
    return {
      id: t.id,
      subject: t.subject,
      category: t.category,
      status: t.status,
      policy: t.policy,
      customer: { name: t.user.name, email: t.user.email },
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      lastMessageAt: last?.createdAt ?? t.createdAt,
      lastMessageByStaff: last?.author.role === Role.ADMIN,
      ...(opts.summary
        ? { messageCount: t.messages.length }
        : {
            messages: t.messages.map((m) => ({
              id: m.id,
              body: m.body,
              createdAt: m.createdAt,
              author:
                m.author.role === Role.ADMIN ? 'Atendimento' : m.author.name,
              fromStaff: m.author.role === Role.ADMIN,
            })),
          }),
    };
  }

  // ---------- Feedback ----------

  async publicFeedbacks(q: PaginationQuery) {
    const where = { status: FeedbackStatus.APROVADO };
    const [rows, total, agg] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        include: { user: { select: { name: true } } },
      }),
      this.prisma.feedback.count({ where }),
      this.prisma.feedback.aggregate({ where, _avg: { rating: true } }),
    ]);
    const page = paginated(
      rows.map((f) => ({
        id: f.id,
        rating: f.rating,
        comment: f.comment,
        // Apenas o primeiro nome e a inicial do sobrenome (LGPD).
        author: shortName(f.user.name),
        createdAt: f.createdAt,
      })),
      total,
      q,
    );
    return {
      ...page,
      averageRating: agg._avg.rating
        ? Number(agg._avg.rating.toFixed(1))
        : null,
    };
  }

  /** Só cliente que já teve apólice ativa pode avaliar (RN12). */
  async createFeedback(user: AuthUser, rating: number, comment?: string) {
    const hadPolicy = await this.prisma.policy.count({
      where: {
        userId: user.id,
        startsAt: { not: null },
        status: {
          in: [
            PolicyStatus.ATIVA,
            PolicyStatus.SUSPENSA,
            PolicyStatus.CANCELADA,
            PolicyStatus.ENCERRADA,
          ],
        },
      },
    });
    if (!hadPolicy) {
      throw new AppException(
        'SEM_APOLICE',
        'Apenas clientes com apólice contratada podem enviar avaliação.',
      );
    }
    const f = await this.prisma.feedback.create({
      data: { userId: user.id, rating, comment: comment || null },
    });
    return { id: f.id, status: f.status };
  }

  async adminFeedbacks(q: PaginationQuery, status?: FeedbackStatus) {
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.feedback.count({ where }),
    ]);
    return paginated(
      rows.map((f) => ({
        id: f.id,
        rating: f.rating,
        comment: f.comment,
        status: f.status,
        createdAt: f.createdAt,
        customer: f.user,
      })),
      total,
      q,
    );
  }

  async moderateFeedback(id: string, status: FeedbackStatus) {
    const f = await this.prisma.feedback.findUnique({ where: { id } });
    if (!f) throw notFound('Avaliação');
    return this.prisma.feedback.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
  }
}

function shortName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.pop();
  return last ? `${first} ${last[0]}.` : first;
}
