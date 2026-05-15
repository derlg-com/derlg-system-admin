import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import {
  AdminDiscountsController,
  AdminStudentVerificationsController,
} from './admin-discounts.controller';
import { AdminDiscountsService } from '../services/admin-discounts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { verification_status } from '@prisma/client';

describe('AdminDiscountsController', () => {
  let discountsController: AdminDiscountsController;
  let verificationsController: AdminStudentVerificationsController;
  let service: AdminDiscountsService;

  const mockService = {
    getAllDiscountCodes: jest.fn(),
    createDiscountCode: jest.fn(),
    updateDiscountCode: jest.fn(),
    deactivateDiscountCode: jest.fn(),
    getAllStudentVerifications: jest.fn(),
    reviewStudentVerification: jest.fn(),
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        AdminDiscountsController,
        AdminStudentVerificationsController,
      ],
      providers: [
        { provide: AdminDiscountsService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    discountsController = module.get<AdminDiscountsController>(
      AdminDiscountsController,
    );
    verificationsController = module.get<AdminStudentVerificationsController>(
      AdminStudentVerificationsController,
    );
    service = module.get<AdminDiscountsService>(AdminDiscountsService);
  });

  describe('getAllDiscountCodes', () => {
    it('should return paginated discount codes', async () => {
      mockService.getAllDiscountCodes.mockResolvedValue({
        data: [{ id: 'dc-1', code: 'SUMMER2026' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await discountsController.getAllDiscountCodes();

      expect(result.success).toBe(true);
      expect(result.data.data).toHaveLength(1);
    });

    it('should pass page and limit params', async () => {
      mockService.getAllDiscountCodes.mockResolvedValue({
        data: [],
        meta: { total: 0 },
      });

      await discountsController.getAllDiscountCodes('2', '50');

      expect(mockService.getAllDiscountCodes).toHaveBeenCalledWith({
        page: '2',
        limit: '50',
      });
    });
  });

  describe('createDiscountCode', () => {
    it('should create and log audit', async () => {
      mockService.createDiscountCode.mockResolvedValue({
        id: 'dc-1',
        code: 'SUMMER2026',
      });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = {
        code: 'SUMMER2026',
        discount_type: 'percentage',
        value: 20,
        valid_from: '2026-06-01',
        valid_until: '2026-08-31',
      };

      const result = await discountsController.createDiscountCode(
        dto as any,
        'admin-1',
      );

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('dc-1');
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          entityType: 'DISCOUNT_CODE',
          metadata: expect.objectContaining({ action: 'CREATE_DISCOUNT_CODE' }),
        }),
      );
    });
  });

  describe('updateDiscountCode', () => {
    it('should update and log audit', async () => {
      mockService.updateDiscountCode.mockResolvedValue({
        id: 'dc-1',
        value: 30,
      });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = { value: 30 };

      const result = await discountsController.updateDiscountCode(
        'dc-1',
        dto as any,
        'admin-1',
      );

      expect(result.success).toBe(true);
      expect(result.data.value).toBe(30);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          entityType: 'DISCOUNT_CODE',
          entityId: 'dc-1',
          metadata: expect.objectContaining({ action: 'UPDATE_DISCOUNT_CODE' }),
        }),
      );
    });
  });

  describe('deactivateDiscountCode', () => {
    it('should deactivate and log audit', async () => {
      mockService.deactivateDiscountCode.mockResolvedValue({
        id: 'dc-1',
        code: 'SUMMER2026',
        is_active: false,
      });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const result = await discountsController.deactivateDiscountCode(
        'dc-1',
        'admin-1',
      );

      expect(result.success).toBe(true);
      expect(result.data.is_active).toBe(false);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          entityType: 'DISCOUNT_CODE',
          entityId: 'dc-1',
          metadata: expect.objectContaining({
            action: 'DEACTIVATE_DISCOUNT_CODE',
          }),
        }),
      );
    });
  });

  describe('getAllStudentVerifications', () => {
    it('should return paginated verifications', async () => {
      mockService.getAllStudentVerifications.mockResolvedValue({
        data: [{ id: 'sv-1', status: verification_status.pending }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await verificationsController.getAllStudentVerifications();

      expect(result.success).toBe(true);
      expect(result.data.data).toHaveLength(1);
    });

    it('should pass status and pagination params', async () => {
      mockService.getAllStudentVerifications.mockResolvedValue({
        data: [],
        meta: { total: 0 },
      });

      await verificationsController.getAllStudentVerifications(
        'pending',
        '2',
        '50',
      );

      expect(mockService.getAllStudentVerifications).toHaveBeenCalledWith({
        status: 'pending',
        page: '2',
        limit: '50',
      });
    });
  });

  describe('reviewStudentVerification', () => {
    it('should review and log audit', async () => {
      mockService.reviewStudentVerification.mockResolvedValue({
        id: 'sv-1',
        status: verification_status.approved,
        user_id: 'user-1',
      });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = {
        status: verification_status.approved,
        review_notes: 'Valid ID',
      };

      const result = await verificationsController.reviewStudentVerification(
        'sv-1',
        dto as any,
        'admin-1',
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(verification_status.approved);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          entityType: 'STUDENT_VERIFICATION',
          entityId: 'sv-1',
          metadata: expect.objectContaining({
            action: 'REVIEW_STUDENT_VERIFICATION',
            status: verification_status.approved,
          }),
        }),
      );
    });
  });
});
