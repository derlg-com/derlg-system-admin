import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminCustomersService } from './admin-customers.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockUser = {
  id: 'user-uuid-1',
  email: 'user@example.com',
  full_name: 'John Doe',
  phone: '+85512345678',
  avatar_url: 'avatar.jpg',
  loyalty_points: 500,
  is_student_verified: false,
  role: 'user',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockBooking = {
  id: 'booking-1',
  reference: 'BK001',
  status: 'confirmed',
  totalUsd: 250.0,
  start_date: new Date('2026-07-01'),
  end_date: new Date('2026-07-05'),
  createdAt: new Date(),
};

const mockReview = {
  id: 'review-1',
  user_id: 'user-uuid-1',
  rating: 5,
  text: 'Great experience',
  hotel_id: null,
  guide_id: null,
  trip_id: null,
  images: [],
  is_verified_booking: true,
  created_at: new Date(),
  updated_at: new Date(),
};

const mockLoyaltyTx = {
  id: 'tx-1',
  user_id: 'user-uuid-1',
  type: 'earned',
  points: 100,
  balance_after: 500,
  reference: null,
  created_at: new Date(),
};

describe('AdminCustomersService', () => {
  let service: AdminCustomersService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    reviews: {
      findMany: jest.fn(),
    },
    loyalty_transactions: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCustomersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminCustomersService>(AdminCustomersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAllCustomers', () => {
    it('should return paginated customers with counts', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          ...mockUser,
          _count: { bookings: 3, reviews: 2 },
        },
      ]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.getAllCustomers({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].booking_count).toBe(3);
      expect(result.data[0].review_count).toBe(2);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by search term', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.getAllCustomers({ search: 'John' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ full_name: expect.any(Object) }),
              expect.objectContaining({ email: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('getCustomerById', () => {
    it('should return customer with bookings, loyalty txs, and reviews', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        bookings: [mockBooking],
        loyalty_transactions: [mockLoyaltyTx],
        reviews: [mockReview],
        _count: { bookings: 1, reviews: 1 },
      });

      const result = await service.getCustomerById('user-uuid-1');

      expect(result.id).toBe('user-uuid-1');
      expect(result.bookings).toHaveLength(1);
      expect(result.loyalty_transactions).toHaveLength(1);
      expect(result.reviews).toHaveLength(1);
      expect(result.total_spent_usd).toBe(250);
    });

    it('should throw NotFoundException when customer not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getCustomerById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCustomerReviews', () => {
    it('should return reviews for a customer', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-uuid-1' });
      mockPrisma.reviews.findMany.mockResolvedValue([mockReview]);

      const result = await service.getCustomerReviews('user-uuid-1');

      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe(5);
    });

    it('should throw NotFoundException when customer not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getCustomerReviews('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('adjustLoyaltyPoints', () => {
    it('should add points and create transaction', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        loyalty_points: 500,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-uuid-1',
        loyalty_points: 600,
      });
      mockPrisma.loyalty_transactions.create.mockResolvedValue({
        id: 'tx-2',
        points: 100,
      });
      mockPrisma.$transaction.mockImplementation((ops) =>
        Promise.all(ops),
      );

      const result = await service.adjustLoyaltyPoints({
        user_id: 'user-uuid-1',
        points: 100,
        description: 'Bonus points',
      });

      expect(result.previous_balance).toBe(500);
      expect(result.adjustment).toBe(100);
      expect(result.new_balance).toBe(600);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should subtract points without going below zero', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        loyalty_points: 50,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-uuid-1',
        loyalty_points: 0,
      });
      mockPrisma.loyalty_transactions.create.mockResolvedValue({
        id: 'tx-2',
        points: -100,
      });
      mockPrisma.$transaction.mockImplementation((ops) =>
        Promise.all(ops),
      );

      const result = await service.adjustLoyaltyPoints({
        user_id: 'user-uuid-1',
        points: -100,
        description: 'Redemption',
      });

      expect(result.previous_balance).toBe(50);
      expect(result.new_balance).toBe(0);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.adjustLoyaltyPoints({
          user_id: 'invalid-id',
          points: 100,
          description: 'Bonus',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
