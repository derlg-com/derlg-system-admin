import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import {
  AdminCustomersController,
  AdminLoyaltyController,
} from './admin-customers.controller';
import { AdminCustomersService } from '../services/admin-customers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('AdminCustomersController', () => {
  let customerController: AdminCustomersController;
  let loyaltyController: AdminLoyaltyController;
  let service: AdminCustomersService;

  const mockCustomer = {
    id: 'user-uuid-1',
    email: 'user@example.com',
    full_name: 'John Doe',
    phone: '+85512345678',
    loyalty_points: 500,
    booking_count: 3,
    review_count: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockService = {
    getAllCustomers: jest.fn(),
    getCustomerById: jest.fn(),
    getCustomerReviews: jest.fn(),
    adjustLoyaltyPoints: jest.fn(),
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCustomersController, AdminLoyaltyController],
      providers: [
        { provide: AdminCustomersService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    customerController = module.get<AdminCustomersController>(AdminCustomersController);
    loyaltyController = module.get<AdminLoyaltyController>(AdminLoyaltyController);
    service = module.get<AdminCustomersService>(AdminCustomersService);
  });

  describe('getAllCustomers', () => {
    it('should return paginated customers', async () => {
      mockService.getAllCustomers.mockResolvedValue({
        data: [mockCustomer],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await customerController.getAllCustomers();

      expect(result.data).toHaveLength(1);
      expect(mockService.getAllCustomers).toHaveBeenCalledWith({});
    });

    it('should pass search and pagination params', async () => {
      mockService.getAllCustomers.mockResolvedValue({
        data: [],
        meta: { total: 0 },
      });

      await customerController.getAllCustomers('John', '2', '50');

      expect(mockService.getAllCustomers).toHaveBeenCalledWith({
        search: 'John',
        page: '2',
        limit: '50',
      });
    });
  });

  describe('getCustomerById', () => {
    it('should return a single customer', async () => {
      mockService.getCustomerById.mockResolvedValue(mockCustomer);

      const result = await customerController.getCustomerById('user-uuid-1');

      expect(result.id).toBe('user-uuid-1');
    });
  });

  describe('getCustomerReviews', () => {
    it('should return reviews for a customer', async () => {
      mockService.getCustomerReviews.mockResolvedValue([
        { id: 'review-1', rating: 5 },
      ]);

      const result = await customerController.getCustomerReviews('user-uuid-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('AdminLoyaltyController', () => {
    it('should adjust loyalty and log audit', async () => {
      mockService.adjustLoyaltyPoints.mockResolvedValue({
        user_id: 'user-uuid-1',
        previous_balance: 500,
        adjustment: 100,
        new_balance: 600,
        description: 'Bonus points',
      });
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = {
        user_id: 'user-uuid-1',
        points: 100,
        description: 'Bonus points',
      };

      const result = await loyaltyController.adjustLoyaltyPoints(dto as any, 'admin-1');

      expect(result.success).toBe(true);
      expect(result.data.new_balance).toBe(600);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          entityType: 'USER',
          metadata: expect.objectContaining({ action: 'ADJUST_LOYALTY' }),
        }),
      );
    });
  });
});
