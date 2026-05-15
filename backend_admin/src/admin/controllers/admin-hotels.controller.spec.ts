import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminHotelsController } from './admin-hotels.controller';
import { AdminHotelsService } from '../services/admin-hotels.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('AdminHotelsController', () => {
  let controller: AdminHotelsController;
  let service: AdminHotelsService;

  const mockHotel = {
    id: 'hotel-uuid-1',
    name: 'Grand Hotel',
    latitude: 13.3614,
    longitude: 103.857,
    star_rating: 4,
    address: '123 Main St',
    images: ['img1.jpg'],
    amenities: ['wifi'],
    is_published: true,
    room_count: 5,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockRoom = {
    id: 'room-uuid-1',
    hotel_id: 'hotel-uuid-1',
    room_type: 'Deluxe',
    max_occupancy: 2,
    price_usd: 120,
    amenities: ['ac'],
    images: ['room1.jpg'],
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockService = {
    getAllHotels: jest.fn(),
    getHotelById: jest.fn(),
    createHotel: jest.fn(),
    updateHotel: jest.fn(),
    getHotelRooms: jest.fn(),
    createRoom: jest.fn(),
    updateRoom: jest.fn(),
    getRoomAvailability: jest.fn(),
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminHotelsController],
      providers: [
        { provide: AdminHotelsService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: { getClient: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminHotelsController>(AdminHotelsController);
    service = module.get<AdminHotelsService>(AdminHotelsService);
  });

  describe('getAllHotels', () => {
    it('should return paginated hotels', async () => {
      mockService.getAllHotels.mockResolvedValue({
        data: [mockHotel],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await controller.getAllHotels();

      expect(result.data).toHaveLength(1);
      expect(mockService.getAllHotels).toHaveBeenCalledWith({});
    });

    it('should pass query params to service', async () => {
      mockService.getAllHotels.mockResolvedValue({ data: [], meta: { total: 0 } });

      await controller.getAllHotels('Grand', '2', '50');

      expect(mockService.getAllHotels).toHaveBeenCalledWith({
        search: 'Grand',
        page: '2',
        limit: '50',
      });
    });
  });

  describe('getHotelById', () => {
    it('should return a single hotel', async () => {
      mockService.getHotelById.mockResolvedValue(mockHotel);

      const result = await controller.getHotelById('hotel-uuid-1');

      expect(result.id).toBe('hotel-uuid-1');
    });
  });

  describe('createHotel', () => {
    it('should create hotel and log audit', async () => {
      mockService.createHotel.mockResolvedValue(mockHotel);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = {
        name: 'Grand Hotel',
        latitude: 13.3614,
        longitude: 103.857,
        star_rating: 4,
      };

      const result = await controller.createHotel(dto as any, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Grand Hotel');
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'HOTEL',
          metadata: expect.objectContaining({ action: 'CREATE_HOTEL' }),
        }),
      );
    });
  });

  describe('updateHotel', () => {
    it('should update hotel and log audit', async () => {
      const updated = { ...mockHotel, star_rating: 5 };
      mockService.updateHotel.mockResolvedValue(updated);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const result = await controller.updateHotel(
        'hotel-uuid-1',
        { star_rating: 5 } as any,
        'user-1',
      );

      expect(result.success).toBe(true);
      expect(result.data.star_rating).toBe(5);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'HOTEL',
          metadata: expect.objectContaining({ action: 'UPDATE_HOTEL' }),
        }),
      );
    });
  });

  describe('getHotelRooms', () => {
    it('should return rooms for a hotel', async () => {
      mockService.getHotelRooms.mockResolvedValue([mockRoom]);

      const result = await controller.getHotelRooms('hotel-uuid-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('createRoom', () => {
    it('should create room and log audit', async () => {
      mockService.createRoom.mockResolvedValue(mockRoom);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const dto = {
        room_type: 'Deluxe',
        max_occupancy: 2,
        price_usd: 120,
      };

      const result = await controller.createRoom('hotel-uuid-1', dto as any, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data.room_type).toBe('Deluxe');
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'HOTEL_ROOM',
          metadata: expect.objectContaining({ action: 'CREATE_ROOM' }),
        }),
      );
    });
  });

  describe('updateRoom', () => {
    it('should update room and log audit', async () => {
      const updated = { ...mockRoom, price_usd: 150 };
      mockService.updateRoom.mockResolvedValue(updated);
      mockService.createAuditLog.mockResolvedValue(undefined);

      const result = await controller.updateRoom(
        'hotel-uuid-1',
        'room-uuid-1',
        { price_usd: 150 } as any,
        'user-1',
      );

      expect(result.success).toBe(true);
      expect(result.data.price_usd).toBe(150);
      expect(mockService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          entityType: 'HOTEL_ROOM',
          metadata: expect.objectContaining({ action: 'UPDATE_ROOM' }),
        }),
      );
    });
  });

  describe('getRoomAvailability', () => {
    it('should return availability when dates provided', async () => {
      mockService.getRoomAvailability.mockResolvedValue({
        room_id: 'room-uuid-1',
        is_available: true,
        total_booked_nights: 0,
      });

      const result = await controller.getRoomAvailability(
        'hotel-uuid-1',
        'room-uuid-1',
        '2026-07-01',
        '2026-07-05',
      );

      expect(result.success).toBe(true);
      expect((result as any).data.is_available).toBe(true);
    });

    it('should return error when dates missing', async () => {
      const result = await controller.getRoomAvailability(
        'hotel-uuid-1',
        'room-uuid-1',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required query parameters');
    });
  });
});
