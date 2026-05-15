import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { AdminDiscountsService } from './admin-discounts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { verification_status } from '@prisma/client';

const mockDiscountCode = {
  id: 'dc-uuid-1',
  code: 'SUMMER2026',
  discount_type: 'percentage',
  value: 20,
  max_uses: 100,
  current_uses: 10,
  min_booking_usd: 50,
  valid_from: new Date('2026-06-01'),
  valid_until: new Date('2026-08-31'),
  is_active: true,
  festival_id: null,
  booking_type: null,
  user_id: null,
  created_at: new Date(),
};

const mockStudentVerification = {
  id: 'sv-uuid-1',
  user_id: 'user-uuid-1',
  id_card_image_url: 'https://example.com/id.jpg',
  selfie_image_url: 'https://example.com/selfie.jpg',
  status: verification_status.pending,
  reviewed_by_id: null,
  review_notes: null,
  reviewed_at: null,
  expires_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  users: {
    id: 'user-uuid-1',
    email: 'student@example.com',
    full_name: 'Student User',
    phone: '+85512345678',
    is_student_verified: false,
  },
};

describe('AdminDiscountsService', () => {
  let service: AdminDiscountsService;
  let prisma: PrismaService;

  const mockPrisma = {
    discount_codes: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    student_verifications: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDiscountsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminDiscountsService>(AdminDiscountsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAllDiscountCodes', () => {
    it('should return paginated discount codes', async () => {
      mockPrisma.discount_codes.findMany.mockResolvedValue([mockDiscountCode]);
      mockPrisma.discount_codes.count.mockResolvedValue(1);

      const result = await service.getAllDiscountCodes({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].code).toBe('SUMMER2026');
      expect(result.data[0].value).toBe(20);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should parse page and limit from strings', async () => {
      mockPrisma.discount_codes.findMany.mockResolvedValue([]);
      mockPrisma.discount_codes.count.mockResolvedValue(0);

      await service.getAllDiscountCodes({ page: '2', limit: '50' });

      expect(mockPrisma.discount_codes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50,
          take: 50,
        }),
      );
    });

    it('should clamp limit to max 100', async () => {
      mockPrisma.discount_codes.findMany.mockResolvedValue([]);
      mockPrisma.discount_codes.count.mockResolvedValue(0);

      await service.getAllDiscountCodes({ limit: '200' });

      expect(mockPrisma.discount_codes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('createDiscountCode', () => {
    it('should create a discount code', async () => {
      mockPrisma.discount_codes.findUnique.mockResolvedValue(null);
      mockPrisma.discount_codes.create.mockResolvedValue(mockDiscountCode);

      const dto = {
        code: 'SUMMER2026',
        discount_type: 'percentage',
        value: 20,
        max_uses: 100,
        min_booking_usd: 50,
        valid_from: '2026-06-01',
        valid_until: '2026-08-31',
      };

      const result = await service.createDiscountCode(dto);

      expect(result.code).toBe('SUMMER2026');
      expect(mockPrisma.discount_codes.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when code already exists', async () => {
      mockPrisma.discount_codes.findUnique.mockResolvedValue(mockDiscountCode);

      const dto = {
        code: 'SUMMER2026',
        discount_type: 'percentage',
        value: 20,
        valid_from: '2026-06-01',
        valid_until: '2026-08-31',
      };

      await expect(service.createDiscountCode(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateDiscountCode', () => {
    it('should update a discount code', async () => {
      mockPrisma.discount_codes.findUnique.mockResolvedValue(mockDiscountCode);
      mockPrisma.discount_codes.update.mockResolvedValue({
        ...mockDiscountCode,
        value: 30,
      });

      const result = await service.updateDiscountCode('dc-uuid-1', {
        value: 30,
      });

      expect(result.value).toBe(30);
      expect(mockPrisma.discount_codes.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dc-uuid-1' },
          data: expect.objectContaining({ value: 30 }),
        }),
      );
    });

    it('should throw NotFoundException when discount code not found', async () => {
      mockPrisma.discount_codes.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDiscountCode('invalid-id', { value: 30 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updating to an existing code', async () => {
      mockPrisma.discount_codes.findUnique
        .mockResolvedValueOnce(mockDiscountCode)
        .mockResolvedValueOnce({ id: 'dc-uuid-2', code: 'WINTER2026' });

      await expect(
        service.updateDiscountCode('dc-uuid-1', { code: 'WINTER2026' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow keeping the same code', async () => {
      mockPrisma.discount_codes.findUnique.mockResolvedValue(mockDiscountCode);
      mockPrisma.discount_codes.update.mockResolvedValue(mockDiscountCode);

      const result = await service.updateDiscountCode('dc-uuid-1', {
        code: 'SUMMER2026',
      });

      expect(result).toBeDefined();
    });
  });

  describe('deactivateDiscountCode', () => {
    it('should deactivate a discount code', async () => {
      mockPrisma.discount_codes.findUnique.mockResolvedValue(mockDiscountCode);
      mockPrisma.discount_codes.update.mockResolvedValue({
        ...mockDiscountCode,
        is_active: false,
      });

      const result = await service.deactivateDiscountCode('dc-uuid-1');

      expect(result.is_active).toBe(false);
      expect(mockPrisma.discount_codes.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dc-uuid-1' },
          data: { is_active: false },
        }),
      );
    });

    it('should throw NotFoundException when discount code not found', async () => {
      mockPrisma.discount_codes.findUnique.mockResolvedValue(null);

      await expect(
        service.deactivateDiscountCode('invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllStudentVerifications', () => {
    it('should return paginated verifications with user info', async () => {
      mockPrisma.student_verifications.findMany.mockResolvedValue([
        mockStudentVerification,
      ]);
      mockPrisma.student_verifications.count.mockResolvedValue(1);

      const result = await service.getAllStudentVerifications({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].user.email).toBe('student@example.com');
      expect(result.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.student_verifications.findMany.mockResolvedValue([]);
      mockPrisma.student_verifications.count.mockResolvedValue(0);

      await service.getAllStudentVerifications({
        status: verification_status.approved,
      });

      expect(mockPrisma.student_verifications.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: verification_status.approved },
        }),
      );
    });
  });

  describe('reviewStudentVerification', () => {
    it('should approve verification and update user flag', async () => {
      mockPrisma.student_verifications.findUnique.mockResolvedValue({
        ...mockStudentVerification,
        users: { id: 'user-uuid-1', is_student_verified: false },
      });
      mockPrisma.student_verifications.update.mockResolvedValue({
        ...mockStudentVerification,
        status: verification_status.approved,
        reviewed_by_id: 'admin-1',
        review_notes: 'Valid student ID',
        reviewed_at: new Date(),
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-uuid-1',
        is_student_verified: true,
      });

      const result = await service.reviewStudentVerification(
        'sv-uuid-1',
        {
          status: verification_status.approved,
          review_notes: 'Valid student ID',
        },
        'admin-1',
      );

      expect(result.status).toBe(verification_status.approved);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-uuid-1' },
          data: { is_student_verified: true },
        }),
      );
    });

    it('should reject verification and update user flag', async () => {
      mockPrisma.student_verifications.findUnique.mockResolvedValue({
        ...mockStudentVerification,
        users: { id: 'user-uuid-1', is_student_verified: true },
      });
      mockPrisma.student_verifications.update.mockResolvedValue({
        ...mockStudentVerification,
        status: verification_status.rejected,
        review_notes: 'Invalid ID',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-uuid-1',
        is_student_verified: false,
      });

      const result = await service.reviewStudentVerification(
        'sv-uuid-1',
        {
          status: verification_status.rejected,
          review_notes: 'Invalid ID',
        },
      );

      expect(result.status).toBe(verification_status.rejected);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-uuid-1' },
          data: { is_student_verified: false },
        }),
      );
    });

    it('should throw NotFoundException when verification not found', async () => {
      mockPrisma.student_verifications.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewStudentVerification('invalid-id', {
          status: verification_status.approved,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createAuditLog', () => {
    it('should create audit log', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      await service.createAuditLog({
        userId: 'admin-1',
        eventType: 'admin_action',
        entityType: 'DISCOUNT_CODE',
        entityId: 'dc-1',
        metadata: { action: 'CREATE' },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should not throw on audit log failure', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.createAuditLog({
          eventType: 'admin_action',
          entityType: 'DISCOUNT_CODE',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
