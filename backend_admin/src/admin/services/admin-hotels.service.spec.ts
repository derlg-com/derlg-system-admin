import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminHotelsService } from './admin-hotels.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockHotel = {
  id: 'hotel-uuid-1',
  latitude: 13.3614,
  longitude: 103.857,
  star_rating: 4,
  images: ['img1.jpg'],
  amenities: ['wifi', 'pool'],
  is_published: true,
  created_at: new Date(),
  updated_at: new Date(),
};

const mockTranslation = {
  id: 'trans-1',
  hotel_id: 'hotel-uuid-1',
  language: 'en',
  name: 'Grand Hotel',
  address: '123 Main St',
  description: 'A lovely hotel',
};

const mockRoom = {
  id: 'room-uuid-1',
  hotel_id: 'hotel-uuid-1',
  room_type: 'Deluxe',
  max_occupancy: 2,
  price_usd: 120.0,
  amenities: ['ac', 'tv'],
  images: ['room1.jpg'],
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('AdminHotelsService', () => {
  let service: AdminHotelsService;
  let prisma: PrismaService;

  const mockPrisma = {
    hotels: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    hotel_rooms: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    hotel_translations: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    booking_items: {
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminHotelsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminHotelsService>(AdminHotelsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAllHotels', () => {
    it('should return paginated hotels with names', async () => {
      mockPrisma.hotels.findMany.mockResolvedValue([
        {
          ...mockHotel,
          hotel_translations: [{ name: 'Grand Hotel', address: '123 Main St' }],
          _count: { hotel_rooms: 5 },
        },
      ]);
      mockPrisma.hotels.count.mockResolvedValue(1);

      const result = await service.getAllHotels({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Grand Hotel');
      expect(result.data[0].room_count).toBe(5);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getHotelById', () => {
    it('should return hotel with rooms and translations', async () => {
      mockPrisma.hotels.findUnique.mockResolvedValue({
        ...mockHotel,
        hotel_translations: [mockTranslation],
        hotel_rooms: [mockRoom],
        _count: { reviews: 10 },
      });

      const result = await service.getHotelById('hotel-uuid-1');

      expect(result.id).toBe('hotel-uuid-1');
      expect(result.translations).toHaveLength(1);
      expect(result.rooms).toHaveLength(1);
      expect(result.review_count).toBe(10);
    });

    it('should throw NotFoundException when hotel not found', async () => {
      mockPrisma.hotels.findUnique.mockResolvedValue(null);

      await expect(service.getHotelById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createHotel', () => {
    it('should create hotel and english translation', async () => {
      mockPrisma.hotels.create.mockResolvedValue(mockHotel);
      mockPrisma.hotel_translations.create.mockResolvedValue(mockTranslation);

      const result = await service.createHotel({
        name: 'Grand Hotel',
        latitude: 13.3614,
        longitude: 103.857,
        star_rating: 4,
        address: '123 Main St',
        description: 'A lovely hotel',
        images: ['img1.jpg'],
        amenities: ['wifi', 'pool'],
        is_published: true,
      });

      expect(result.id).toBe('hotel-uuid-1');
      expect(result.name).toBe('Grand Hotel');
      expect(mockPrisma.hotel_translations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hotel_id: 'hotel-uuid-1',
            language: 'en',
            name: 'Grand Hotel',
          }),
        }),
      );
    });
  });

  describe('updateHotel', () => {
    it('should update hotel and translation', async () => {
      mockPrisma.hotels.findUnique.mockResolvedValue({
        ...mockHotel,
        hotel_translations: [mockTranslation],
      });
      mockPrisma.hotels.update.mockResolvedValue({
        ...mockHotel,
        star_rating: 5,
      });
      mockPrisma.hotel_translations.update.mockResolvedValue({
        ...mockTranslation,
        name: 'Grand Hotel Updated',
      });

      const result = await service.updateHotel('hotel-uuid-1', {
        name: 'Grand Hotel Updated',
        star_rating: 5,
      });

      expect(result.star_rating).toBe(5);
      expect(result.name).toBe('Grand Hotel Updated');
      expect(mockPrisma.hotel_translations.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when hotel not found', async () => {
      mockPrisma.hotels.findUnique.mockResolvedValue(null);

      await expect(
        service.updateHotel('invalid-id', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHotelRooms', () => {
    it('should return rooms for a hotel', async () => {
      mockPrisma.hotels.findUnique.mockResolvedValue({ id: 'hotel-uuid-1' });
      mockPrisma.hotel_rooms.findMany.mockResolvedValue([mockRoom]);

      const result = await service.getHotelRooms('hotel-uuid-1');

      expect(result).toHaveLength(1);
      expect(result[0].room_type).toBe('Deluxe');
    });

    it('should throw NotFoundException when hotel not found', async () => {
      mockPrisma.hotels.findUnique.mockResolvedValue(null);

      await expect(service.getHotelRooms('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createRoom', () => {
    it('should create a room for a hotel', async () => {
      mockPrisma.hotels.findUnique.mockResolvedValue({ id: 'hotel-uuid-1' });
      mockPrisma.hotel_rooms.create.mockResolvedValue(mockRoom);

      const result = await service.createRoom('hotel-uuid-1', {
        room_type: 'Deluxe',
        max_occupancy: 2,
        price_usd: 120,
        amenities: ['ac', 'tv'],
        images: ['room1.jpg'],
        is_active: true,
      });

      expect(result.room_type).toBe('Deluxe');
      expect(mockPrisma.hotel_rooms.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hotel_id: 'hotel-uuid-1' }),
        }),
      );
    });

    it('should throw NotFoundException when hotel not found', async () => {
      mockPrisma.hotels.findUnique.mockResolvedValue(null);

      await expect(
        service.createRoom('invalid-id', {
          room_type: 'Deluxe',
          max_occupancy: 2,
          price_usd: 120,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRoom', () => {
    it('should update room fields', async () => {
      mockPrisma.hotel_rooms.findFirst.mockResolvedValue(mockRoom);
      mockPrisma.hotel_rooms.update.mockResolvedValue({
        ...mockRoom,
        price_usd: 150,
      });

      const result = await service.updateRoom('hotel-uuid-1', 'room-uuid-1', {
        price_usd: 150,
      });

      expect(Number(result.price_usd)).toBe(150);
    });

    it('should throw NotFoundException when room not found', async () => {
      mockPrisma.hotel_rooms.findFirst.mockResolvedValue(null);

      await expect(
        service.updateRoom('hotel-uuid-1', 'invalid-room', { price_usd: 150 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRoomAvailability', () => {
    it('should return available when no overlapping bookings', async () => {
      mockPrisma.hotel_rooms.findUnique.mockResolvedValue({
        ...mockRoom,
        hotels: {
          hotel_translations: [{ name: 'Grand Hotel' }],
        },
      });
      mockPrisma.booking_items.findMany.mockResolvedValue([]);

      const result = await service.getRoomAvailability(
        'room-uuid-1',
        '2026-07-01',
        '2026-07-05',
      );

      expect(result.is_available).toBe(true);
      expect(result.total_booked_nights).toBe(0);
    });

    it('should return unavailable when overlapping bookings exist', async () => {
      mockPrisma.hotel_rooms.findUnique.mockResolvedValue({
        ...mockRoom,
        hotels: {
          hotel_translations: [{ name: 'Grand Hotel' }],
        },
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

      const result = await service.getRoomAvailability(
        'room-uuid-1',
        '2026-07-01',
        '2026-07-05',
      );

      expect(result.is_available).toBe(false);
      expect(result.total_booked_nights).toBe(1);
    });

    it('should throw NotFoundException when room not found', async () => {
      mockPrisma.hotel_rooms.findUnique.mockResolvedValue(null);

      await expect(
        service.getRoomAvailability('invalid-room', '2026-07-01', '2026-07-05'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
