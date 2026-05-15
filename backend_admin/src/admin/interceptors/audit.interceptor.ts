import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const path = request.route?.path || request.url;
    const user = request.user;
    const userId = user?.sub;

    // Only log mutating operations
    const mutatingMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
    if (!mutatingMethods.includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const entityType = this.inferEntityType(path);
          const action = this.inferAction(method, path);

          await this.prisma.auditLog.create({
            data: {
              user_id: userId || null,
              event_type: 'admin_action',
              entity_type: entityType,
              entity_id: this.extractEntityId(path, response) || null,
              ipAddress: request.ip || null,
              userAgent: request.headers['user-agent'] || null,
              metadata: {
                action,
                path,
                method,
                success: response?.success ?? true,
              },
            },
          });
        } catch (err) {
          this.logger.warn(`Automatic audit logging failed: ${err.message}`);
        }
      }),
    );
  }

  private inferEntityType(path: string): string {
    const segments = path.split('/').filter(Boolean);
    // e.g. ['v1', 'admin', 'drivers'] → 'DRIVER'
    const resource = segments[2] || 'UNKNOWN';
    const mapping: Record<string, string> = {
      drivers: 'DRIVER',
      vehicles: 'VEHICLE',
      maintenance: 'MAINTENANCE',
      assignments: 'ASSIGNMENT',
      bookings: 'BOOKING',
      hotels: 'HOTEL',
      guides: 'GUIDE',
      emergency: 'EMERGENCY',
      customers: 'CUSTOMER',
      loyalty: 'LOYALTY',
      discounts: 'DISCOUNT_CODE',
      'student-verifications': 'STUDENT_VERIFICATION',
      analytics: 'ANALYTICS',
      users: 'ADMIN_USER',
      'audit-logs': 'AUDIT_LOG',
      export: 'EXPORT',
    };
    return mapping[resource] || resource.toUpperCase();
  }

  private inferAction(method: string, path: string): string {
    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];

    if (method === 'POST') return 'CREATE';
    if (method === 'DELETE') return 'DELETE';
    if (method === 'PATCH') {
      if (lastSegment === 'deactivate') return 'DEACTIVATE';
      if (lastSegment === 'cancel') return 'CANCEL';
      if (lastSegment === 'complete') return 'COMPLETE';
      return 'UPDATE';
    }
    if (method === 'PUT') return 'UPDATE';
    return method;
  }

  private extractEntityId(path: string, response: any): string | undefined {
    // Try to extract ID from response data
    if (response?.data?.id) return response.data.id;
    if (response?.data?.entityId) return response.data.entityId;

    // Try to extract from path params
    const uuidMatch = path.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    if (uuidMatch) return uuidMatch[0];

    return undefined;
  }
}
