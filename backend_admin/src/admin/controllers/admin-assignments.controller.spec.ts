import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminAssignmentsController } from './admin-assignments.controller';
import { AdminAssignmentsService } from '../services/admin-assignments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('AdminAssignmentsController', () => {
  let controller: AdminAssignmentsController;
  let service: AdminAssignmentsService;

  const mockAssignment = {
    id: 'assignment-1',
    driverId: 'driver-1',
    bookingId: 'booking-1',
    vehicleId: 'vehicle-1',
    status: 'PENDING',
  };

  const mockService = {
    getAssignments: jest.fn(),
    assignDriver: jest.fn(),
    completeAssignment: jest.fn(),
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAssignmentsController],
      providers: [
        { provide: AdminAssignmentsService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminAssignmentsController>(AdminAssignmentsController);
    service = module.get<AdminAssignmentsService>(AdminAssignmentsService);
  });

  describe('getAssignments', () => {
    it('should return assignments list', async () => {
      mockService.getAssignments.mockResolvedValue({ data: [mockAssignment], meta: {} });

      const result = await controller.getAssignments();

      expect(result.data).toHaveLength(1);
    });
  });

  describe('assignDriver', () => {
    it('should assign driver and log audit', async () => {
      mockService.assignDriver.mockResolvedValue(mockAssignment);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = {
        driverId: 'driver-1',
        bookingId: 'booking-1',
        vehicleId: 'vehicle-1',
      };

      const result = await controller.assignDriver(dto, 'user-1');

      expect(result.success).toBe(true);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'DRIVER_ASSIGNMENT',
          metadata: expect.objectContaining({ action: 'ASSIGN_DRIVER' }),
        }),
      );
    });
  });

  describe('completeAssignment', () => {
    it('should complete assignment and log audit', async () => {
      mockService.completeAssignment.mockResolvedValue({
        ...mockAssignment,
        status: 'COMPLETED',
      });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const result = await controller.completeAssignment('assignment-1', 'user-1');

      expect(result.success).toBe(true);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'DRIVER_ASSIGNMENT',
          metadata: expect.objectContaining({ action: 'COMPLETE_ASSIGNMENT' }),
        }),
      );
    });
  });
});
