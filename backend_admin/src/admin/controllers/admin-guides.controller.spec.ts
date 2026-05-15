import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminGuidesController } from './admin-guides.controller';
import { AdminGuidesService } from '../services/admin-guides.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('AdminGuidesController', () => {
  let controller: AdminGuidesController;
  let service: AdminGuidesService;

  const mockGuide = {
    id: 'guide-uuid-1',
    user_id: 'user-uuid-1',
    bio: 'Experienced guide',
    avatar_url: 'avatar.jpg',
    images: ['img1.jpg'],
    price_per_day_usd: 100,
    is_verified: true,
    province: 'Siem Reap',
    provinces: ['Siem Reap'],
    is_active: true,
    languages: ['en'],
    specialties: ['history'],
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockService = {
    getAllGuides: jest.fn(),
    getGuideById: jest.fn(),
    createGuide: jest.fn(),
    updateGuide: jest.fn(),
    getGuideAssignments: jest.fn(),
    getGuideAvailability: jest.fn(),
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminGuidesController],
      providers: [
        { provide: AdminGuidesService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminGuidesController>(AdminGuidesController);
    service = module.get<AdminGuidesService>(AdminGuidesService);
  });

  describe('getAllGuides', () => {
    it('should return paginated guides', async () => {
      mockService.getAllGuides.mockResolvedValue({
        data: [mockGuide],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await controller.getAllGuides();

      expect(result.data).toHaveLength(1);
      expect(mockService.getAllGuides).toHaveBeenCalledWith({});
    });

    it('should pass query filters to service', async () => {
      mockService.getAllGuides.mockResolvedValue({ data: [], meta: { total: 0 } });

      await controller.getAllGuides('en,km', 'history', '2', '50');

      expect(mockService.getAllGuides).toHaveBeenCalledWith({
        languages: 'en,km',
        specialties: 'history',
        page: '2',
        limit: '50',
      });
    });
  });

  describe('getGuideById', () => {
    it('should return a single guide', async () => {
      mockService.getGuideById.mockResolvedValue(mockGuide);

      const result = await controller.getGuideById('guide-uuid-1');

      expect(result.id).toBe('guide-uuid-1');
    });
  });

  describe('createGuide', () => {
    it('should create guide and log audit', async () => {
      mockService.createGuide.mockResolvedValue(mockGuide);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = {
        user_id: 'user-uuid-1',
        province: 'Siem Reap',
        price_per_day_usd: 100,
      };

      const result = await controller.createGuide(dto as any, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data.province).toBe('Siem Reap');
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'GUIDE',
          metadata: expect.objectContaining({ action: 'CREATE_GUIDE' }),
        }),
      );
    });
  });

  describe('updateGuide', () => {
    it('should update guide and log audit', async () => {
      const updated = { ...mockGuide, bio: 'Updated bio' };
      mockService.updateGuide.mockResolvedValue(updated);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const result = await controller.updateGuide(
        'guide-uuid-1',
        { bio: 'Updated bio' } as any,
        'user-1',
      );

      expect(result.success).toBe(true);
      expect(result.data.bio).toBe('Updated bio');
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'GUIDE',
          metadata: expect.objectContaining({ action: 'UPDATE_GUIDE' }),
        }),
      );
    });
  });

  describe('getGuideAssignments', () => {
    it('should return guide assignments', async () => {
      mockService.getGuideAssignments.mockResolvedValue([
        { id: 'item-1', reference: 'BK001' },
      ]);

      const result = await controller.getGuideAssignments('guide-uuid-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getGuideAvailability', () => {
    it('should return availability when dates provided', async () => {
      mockService.getGuideAvailability.mockResolvedValue({
        guide_id: 'guide-uuid-1',
        is_available: true,
        total_booked_days: 0,
      });

      const result = await controller.getGuideAvailability(
        'guide-uuid-1',
        '2026-07-01',
        '2026-07-05',
      );

      expect(result.success).toBe(true);
      expect((result as any).data.is_available).toBe(true);
    });

    it('should return error when dates missing', async () => {
      const result = await controller.getGuideAvailability('guide-uuid-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required query parameters');
    });
  });
});
