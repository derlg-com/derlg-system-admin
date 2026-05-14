import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';

export const ADMIN_ROLES = ['admin', 'support'];

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: no user role found');
    }

    const userRole = String(user.role).toLowerCase();
    if (!ADMIN_ROLES.includes(userRole)) {
      throw new ForbiddenException('Access denied: admin privileges required');
    }

    return true;
  }
}
