import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { AppException, forbidden } from '../common/app-exception';
import { IS_PUBLIC, ROLES } from './decorators';

/** Guard global: exige JWT válido em todas as rotas, exceto as marcadas com @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      throw new AppException(
        'NAO_AUTENTICADO',
        'Faça login para continuar.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    try {
      const payload = await this.jwt.verifyAsync(token);
      req.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };
      return true;
    } catch {
      throw new AppException(
        'TOKEN_INVALIDO',
        'Sua sessão expirou. Entre novamente.',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}

/** Guard global de papéis: só age em rotas com @Roles(...). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) throw forbidden();
    return true;
  }
}
