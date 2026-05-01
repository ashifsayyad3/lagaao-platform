import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './roles.guard';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest<{ user: JwtPayload }>().user,
);
