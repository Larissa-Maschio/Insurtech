import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthUser, CurrentUser, Public } from './decorators';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller()
export class AuthController {
  private readonly secureCookie: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.secureCookie = config.get('NODE_ENV') === 'production';
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('auth/register')
  @ApiOperation({ summary: 'Cria a conta do cliente e já inicia a sessão' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withCookie(res, await this.auth.register(dto));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('auth/login')
  @ApiOperation({
    summary:
      'Login: devolve o access token e grava o refresh token em cookie httpOnly',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withCookie(res, await this.auth.login(dto.email, dto.password));
  }

  @Public()
  @HttpCode(200)
  @Post('auth/refresh')
  @ApiOperation({
    summary: 'Renova o access token usando o cookie de refresh (com rotação)',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withCookie(
      res,
      await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]),
    );
  }

  @Public()
  @HttpCode(204)
  @Post('auth/logout')
  @ApiOperation({ summary: 'Revoga o refresh token e limpa o cookie' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(204)
  @Post('auth/forgot-password')
  @ApiOperation({
    summary:
      'Envia e-mail de redefinição (resposta igual exista ou não o e-mail)',
  })
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  @Post('auth/reset-password')
  @ApiOperation({ summary: 'Redefine a senha com o token recebido por e-mail' })
  async reset(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Dados do usuário logado' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  private withCookie(
    res: Response,
    result: {
      accessToken: string;
      refreshToken: string;
      refreshExpiresAt: Date;
      user: unknown;
    },
  ) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secureCookie,
      path: '/api/auth',
      expires: result.refreshExpiresAt,
    });
    return { accessToken: result.accessToken, user: result.user };
  }
}
