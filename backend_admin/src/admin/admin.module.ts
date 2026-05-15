import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';

// Controllers
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminDriversController } from './controllers/admin-drivers.controller';
import { AdminVehiclesController } from './controllers/admin-vehicles.controller';
import { AdminMaintenanceController } from './controllers/admin-maintenance.controller';
import { AdminAssignmentsController } from './controllers/admin-assignments.controller';
import { AdminBookingsController } from './controllers/admin-bookings.controller';
import { AdminHotelsController } from './controllers/admin-hotels.controller';
import { AdminGuidesController } from './controllers/admin-guides.controller';
import { AdminEmergencyController } from './controllers/admin-emergency.controller';
import { AdminCustomersController, AdminLoyaltyController } from './controllers/admin-customers.controller';
import { AdminDiscountsController, AdminStudentVerificationsController } from './controllers/admin-discounts.controller';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { AdminExportController } from './controllers/admin-export.controller';
import { AdminAIMonitoringController } from './controllers/admin-ai-monitoring.controller';

// Services
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminDriversService } from './services/admin-drivers.service';
import { AdminVehiclesService } from './services/admin-vehicles.service';
import { AdminMaintenanceService } from './services/admin-maintenance.service';
import { AdminAssignmentsService } from './services/admin-assignments.service';
import { AdminBookingsService } from './services/admin-bookings.service';
import { AdminHotelsService } from './services/admin-hotels.service';
import { AdminGuidesService } from './services/admin-guides.service';
import { AdminEmergencyService } from './services/admin-emergency.service';
import { AdminCustomersService } from './services/admin-customers.service';
import { AdminDiscountsService } from './services/admin-discounts.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminExportService } from './services/admin-export.service';
import { AdminAIMonitoringService } from './services/admin-ai-monitoring.service';

// Guards
import { AdminGuard } from './guards/admin.guard';
import { AdminRoleGuard } from './guards/admin-role.guard';

// WebSocket
import { AdminGateway } from './websocket/admin.gateway';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminDashboardController,
    AdminDriversController,
    AdminVehiclesController,
    AdminMaintenanceController,
    AdminAssignmentsController,
    AdminBookingsController,
    AdminHotelsController,
    AdminGuidesController,
    AdminEmergencyController,
    AdminCustomersController,
    AdminLoyaltyController,
    AdminDiscountsController,
    AdminStudentVerificationsController,
    AdminAnalyticsController,
    AdminUsersController,
    AdminAuditController,
    AdminExportController,
    AdminAIMonitoringController,
  ],
  providers: [
    // Services
    AdminDashboardService,
    AdminDriversService,
    AdminVehiclesService,
    AdminMaintenanceService,
    AdminAssignmentsService,
    AdminBookingsService,
    AdminHotelsService,
    AdminGuidesService,
    AdminEmergencyService,
    AdminCustomersService,
    AdminDiscountsService,
    AdminAnalyticsService,
    AdminUsersService,
    AdminAuditService,
    AdminExportService,
    AdminAIMonitoringService,
    // Guards
    AdminGuard,
    AdminRoleGuard,
    // WebSocket
    AdminGateway,
  ],
  exports: [AdminGuard, AdminRoleGuard],
})
export class AdminModule {}
