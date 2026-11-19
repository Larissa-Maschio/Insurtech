import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { AppException } from '../common/app-exception';
import { ClockService } from '../common/clock.service';
import { addDays } from '../common/dates';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto';

/**
 * Expiração de sessões e links usa o tempo REAL, não o relógio de negócio (ClockService),
 * para que simular a passagem do tempo na demonstração não derrube a sessão do usuário.
 */
const realNow = () => new Date();

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  cpf: u.cpf,
  phone: u.phone,
  role: u.role,
  createdAt: u.createdAt,
});

@Injectable()
export class AuthService {
  private readonly refreshTtlDays: number;
  /** Hash fixo usado quando o e-mail não existe, para o tempo de resposta não revelar isso. */
  private dummyHash: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly clock: ClockService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.refreshTtlDays = Number(config.get('REFRESH_TOKEN_TTL_DAYS') ?? 7);
    this.dummyHash = argon2.hash('senha-que-nao-existe-1');
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { cpf: dto.cpf }] },
    });
    if (existing) {
      const field = existing.email === dto.email ? 'e-mail' : 'CPF';
      throw new AppException(
        'CADASTRO_DUPLICADO',
        `Já existe uma conta com este ${field}.`,
        HttpStatus.CONFLICT,
        {
          field: field === 'e-mail' ? 'email' : 'cpf',
        },
      );
    }
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        cpf: dto.cpf,
        phone: dto.phone,
        passwordHash: await argon2.hash(dto.password),
        termsAcceptedAt: this.clock.now(),
      },
    });
    return this.issueTokens(user);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = user
      ? await argon2.verify(user.passwordHash, password)
      : (await argon2.verify(await this.dummyHash, password), false);
    if (!user || !ok) {
      throw new AppException(
        'CREDENCIAIS_INVALIDAS',
        'E-mail ou senha incorretos.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.issueTokens(user);
  }

  /** Troca um refresh token válido por um novo par (rotação). */
  async refresh(rawToken: string | undefined) {
    const invalid = new AppException(
      'SESSAO_EXPIRADA',
      'Sua sessão expirou. Entre novamente.',
      HttpStatus.UNAUTHORIZED,
    );
    if (!rawToken) throw invalid;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= realNow())
      throw invalid;
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: realNow() },
    });
    return this.issueTokens(stored.user);
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: realNow() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return publicUser(user);
  }

  /** Sempre responde igual, exista ou não o e-mail. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(realNow().getTime() + 60 * 60 * 1000),
      },
    });
    await this.mail.send(
      user.email,
      'Redefinição de senha',
      `<p>Olá, ${user.name}.</p><p>Recebemos um pedido para redefinir sua senha. O link vale por 1 hora e só pode ser usado uma vez.</p><p>Se não foi você, ignore este e-mail.</p>`,
      { label: 'Redefinir senha', path: `/redefinir-senha?token=${token}` },
    );
  }

  async resetPassword(token: string, password: string) {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!reset || reset.usedAt || reset.expiresAt <= realNow()) {
      throw new AppException(
        'LINK_INVALIDO',
        'Este link de redefinição é inválido ou expirou. Peça um novo.',
      );
    }
    const now = realNow();
    await this.prisma.$transaction([
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: now },
      }),
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash: await argon2.hash(password) },
      }),
      // Encerra todas as sessões abertas
      this.prisma.refreshToken.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  private async issueTokens(user: User) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = addDays(realNow(), this.refreshTtlDays);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha256(refreshToken), expiresAt },
    });
    return {
      accessToken,
      refreshToken,
      refreshExpiresAt: expiresAt,
      user: publicUser(user),
    };
  }
}
