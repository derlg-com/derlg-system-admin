import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminGuidesService } from './admin-guides.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockGuide = {
  id: 'guide-uuid-1',
  user_id: 'user-uuid-1',
  bio: 'Experienced guide',
  avatar_url: 'avatar.jpg',
  images: ['img1.jpg'],
  price_per_day_usd: 100.0,
  is_verified: true,
  province: 'Siem Reap',
  provinces: ['Siem Reap', 'Phnom Penh'],
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};

const mockUser = {
  id: 'user-uuid-1',
  email: 'guide@example.com',
  full_name: 'John Guide',
  phone: '+85512345678',
};

const mockLanguage = { id: 'lang-1', guide_id: 'guide-uuid-1', language: 'en' };
const mockSpecialty = { id: 'spec-1', guide_id: 'guide-uuid-1', speciality: 'history' };

describe('AdminGuidesService', () => {
  let service: AdminGuidesService;
  let prisma: PrismaService;

  const mockPrisma = {
    guides: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    guide_languages: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    guide_specialities: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    booking_items: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuidesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminGuidesService>(AdminGuidesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAllGuides', () => {
    it('should return paginated guides with languages and specialties', async () => {
      mockPrisma.guides.findMany.mockResolvedValue([
        {
          ...mockGuide,
          guide_languages: [mockLanguage],
          guide_specialities: [mockSpecialty],
          _count: { booking_items: 3, reviews: 5 },
        },
      ]);
      mockPrisma.guides.count.mockResolvedValue(1);

      const result = await service.getAllGuides({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].languages).toEqual(['en']);
      expect(result.data[0].specialties).toEqual(['history']);
      expect(result.data[0].assignment_count).toBe(3);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by languages', async () => {
      mockPrisma.guides.findMany.mockResolvedValue([]);
      mockPrisma.guides.count.mockResolvedValue(0);

      await service.getAllGuides({ languages: 'en,km' });

      expect(mockPrisma.guides.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            guide_languages: expect.objectContaining({
              some: expect.objectContaining({
                language: expect.objectContaining({ in: ['en', 'km'] }),
              }),
            }),
          }),
        }),
      );
    });

    it('should filter by specialties', async () => {
      mockPrisma.guides.findMany.mockResolvedValue([]);
      mockPrisma.guides.count.mockResolvedValue(0);

      await service.getAllGuides({ specialties: 'history,nature' });

      expect(mockPrisma.guides.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            guide_specialities: expect.objectContaining({
              some: expect.objectContaining({
                speciality: expect.objectContaining({ in: ['history', 'nature'] }),
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('getGuideById', () => {
    it('should return guide with user info and metrics', async () => {
      mockPrisma.guides.findUnique.mockResolvedValue({
        ...mockGuide,
        guide_languages: [mockLanguage],
        guide_specialities: [mockSpecialty],
        booking_items: [],
        reviews: [{ id: 'rev-1', rating: 5 }, { id: 'rev-2', rating: 4 }],
        _count: { booking_items: 3, reviews: 2 },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getGuideById('guide-uuid-1');

      expect(result.id).toBe('guide-uuid-1');
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('guide@example.com');
      expect(result.languages).toEqual(['en']);
      expect(result.specialties).toEqual(['history']);
      expect(result.average_rating).toBe(4.5);
      expect(result.assignment_count).toBe(3);
      expect(result.review_count).toBe(2);
    });

    it('should throw NotFoundException when guide not found', async () => {
      mockPrisma.guides.findUnique.mockResolvedValue(null);

      await expect(service.getGuideById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createGuide', () => {
    it('should create guide with languages and specialties', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.guides.findUnique.mockResolvedValue(null);
      mockPrisma.guides.create.mockResolvedValue(mockGuide);
      mockPrisma.guide_languages.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.guide_specialities.createMany.mockResolvedValue({ count: 1 });

      const result = await service.createGuide({
        user_id: 'user-uuid-1',
        bio: 'Experienced guide',
        languages: ['en', 'km'],
        specialties: ['history'],
        province: 'Siem Reap',
        price_per_day_usd: 100,
      });

      expect(result.id).toBe('guide-uuid-1');
      expect(result.languages).toEqual(['en', 'km']);
      expect(result.specialties).toEqual(['history']);
      expect(mockPrisma.guide_languages.createMany).toHaveBeenCalled();
      expect(mockPrisma.guide_specialities.createMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createGuide({
          user_id: 'invalid-user',
          province: 'Siem Reap',
          price_per_day_usd: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when guide already exists for user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.guides.findUnique.mockResolvedValue(mockGuide);

      await expect(
        service.createGuide({
          user_id: 'user-uuid-1',
          province: 'Siem Reap',
          price_per_day_usd: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateGuide', () => {
    it('should update guide and replace languages/specialties', async () => {
      mockPrisma.guides.findUnique.mockResolvedValue({
        ...mockGuide,
        guide_languages: [mockLanguage],
        guide_specialities: [mockSpecialty],
      });
      mockPrisma.guides.update.mockResolvedValue({
        ...mockGuide,
        bio: 'Updated bio',
      });
      mockPrisma.guide_languages.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.guide_languages.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.guide_specialities.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.guide_specialities.createMany.mockResolvedValue({ count: 2 });

      const result = await service.updateGuide('guide-uuid-1', {
        bio: 'Updated bio',
        languages: ['zh'],
        specialties: ['nature', 'food'],
      });

      expect(result.bio).toBe('Updated bio');
      expect(result.languages).toEqual(['zh']);
      expect(result.specialties).toEqual(['nature', 'food']);
      expect(mockPrisma.guide_languages.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.guide_specialities.deleteMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException when guide not found', async () => {
      mockPrisma.guides.findUnique.mockResolvedValue(null);

      await expect(
        service.updateGuide('invalid-id', { bio: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getGuideAssignments', () => {
    it('should return guide assignments from booking items', async () => {
      mockPrisma.guides.findUnique.mockResolvedValue({ id: 'guide-uuid-1' });
      mockPrisma.booking_items.findMany.mockResolvedValue([
        {
          id: 'item-1',
          booking_id: 'booking-1',
          date: new Date('2026-07-01'),
          quantity: 1,
          unit_price_usd: 100,
          subtotal_usd: 100,
          bookings: {
            id: 'booking-1',
            reference: 'BK001',
            status: 'confirmed',
            start_date: new Date('2026-07-01'),
            end_date: new Date('2026-07-05'),
            userId: 'user-1',
          },
          hotel_rooms: null,
        },
      ]);

      const result = await service.getGuideAssignments('guide-uuid-1');

      expect(result).toHaveLength(1);
      expect(result[0].reference).toBe('BK001');
    });

    it('should throw NotFoundException when guide not found', async () => {
      mockPrisma.guides.findUnique.mockResolvedValue(null);

      await expect(service.getGuideAssignments('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getGuideAvailability', () => {
    it('should return available when no overlapping bookings', async () => {
      mockPrisma.guides.findUnique.mockResolvedValue({
        id: 'guide-uuid-1',
        is_active: true,
      });
      mockPrisma.booking_items.findMany.mockResolvedValue([]);

      const result = await service.getGuideAvailability(
        'guide-uuid-1',
        '2026-07-01',
        '2026-07-05',
      );

      expect(result.is_available).toBe(true);
      expect(result.total_booked_days).toBe(0);
    });

    it('should return unavailable when overlapping bookings exist', async () => {
      mockPrisma.guides.findUnique.mockResolvedValue({
        id: 'guide-uuid-1',
        is_active: true,
      });
      mockPrisma.booking_items.findMany.mockResolvedValue([
        {
          date: new Date('2026-07-02'),
          bookings: {
            id: 'booking-1',
            reference: 'BK001',
            status: 'confirmed',
            start_date: new Date('2026-07-01'),
            end_date: new Date('2026-07-05'),
          },
        },
      ]);

      const result = await service.getGuideAvailability(
        'guide-uuid-1',
        '2026-07-01',
        '2026-07-05',
      );

      expect(result.is_available).toBe(false);
      expect(result.total_booked_days).toBe(1);
    });

    it('should throw NotFoundException when guide not found', async () => {
      mockPrisma.guides.findUnique.mockResolvedValue(null);

      await expect(
        service.getGuideAvailability('invalid-id', '2026-07-01', '2026-07-05'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
