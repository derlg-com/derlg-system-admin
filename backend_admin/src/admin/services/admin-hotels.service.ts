import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminHotelsService {
  private readonly logger = new Logger(AdminHotelsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllHotels(filters: {
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const { search, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: any = {};

    const [data, total] = await Promise.all([
      this.prisma.hotels.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          hotel_translations: {
            where: { language: 'en' },
            select: { name: true, address: true },
          },
          _count: {
            select: { hotel_rooms: true },
          },
        },
      }),
      this.prisma.hotels.count({ where }),
    ]);

    const mapped = data.map((hotel) => ({
      id: hotel.id,
      name: hotel.hotel_translations[0]?.name || null,
      address: hotel.hotel_translations[0]?.address || null,
      latitude: Number(hotel.latitude),
      longitude: Number(hotel.longitude),
      star_rating: hotel.star_rating,
      images: hotel.images,
      amenities: hotel.amenities,
      is_published: hotel.is_published,
      room_count: hotel._count.hotel_rooms,
      created_at: hotel.created_at,
      updated_at: hotel.updated_at,
    }));

    return {
      data: mapped,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getHotelById(id: string) {
    const hotel = await this.prisma.hotels.findUnique({
      where: { id },
      include: {
        hotel_translations: {
          select: { language: true, name: true, address: true, description: true },
        },
        hotel_rooms: {
          orderBy: { created_at: 'desc' },
        },
        _count: {
          select: { reviews: true },
        },
      },
    });

    if (!hotel) {
      throw new NotFoundException(`Hotel with id ${id} not found`);
    }

    return {
      id: hotel.id,
      translations: hotel.hotel_translations,
      latitude: Number(hotel.latitude),
      longitude: Number(hotel.longitude),
      star_rating: hotel.star_rating,
      images: hotel.images,
      amenities: hotel.amenities,
      is_published: hotel.is_published,
      rooms: hotel.hotel_rooms.map((room) => ({
        id: room.id,
        hotel_id: room.hotel_id,
        room_type: room.room_type,
        max_occupancy: room.max_occupancy,
        price_usd: Number(room.price_usd),
        amenities: room.amenities,
        images: room.images,
        is_active: room.is_active,
        created_at: room.created_at,
        updated_at: room.updated_at,
      })),
      review_count: hotel._count.reviews,
      created_at: hotel.created_at,
      updated_at: hotel.updated_at,
    };
  }

  async createHotel(dto: {
    name: string;
    latitude: number;
    longitude: number;
    star_rating?: number;
    address?: string;
    description?: string;
    images?: string[];
    amenities?: string[];
    is_published?: boolean;
  }) {
    const now = new Date();
    const hotelId = randomUUID();

    const hotel = await this.prisma.hotels.create({
      data: {
        id: hotelId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        star_rating: dto.star_rating,
        images: dto.images || [],
        amenities: dto.amenities || [],
        is_published: dto.is_published ?? false,
        updated_at: now,
      },
    });

    await this.prisma.hotel_translations.create({
      data: {
        id: randomUUID(),
        hotel_id: hotel.id,
        language: 'en',
        name: dto.name,
        address: dto.address || null,
        description: dto.description || null,
      },
    });

    return {
      id: hotel.id,
      name: dto.name,
      latitude: Number(hotel.latitude),
      longitude: Number(hotel.longitude),
      star_rating: hotel.star_rating,
      address: dto.address,
      description: dto.description,
      images: hotel.images,
      amenities: hotel.amenities,
      is_published: hotel.is_published,
      created_at: hotel.created_at,
      updated_at: hotel.updated_at,
    };
  }

  async updateHotel(
    id: string,
    dto: {
      name?: string;
      latitude?: number;
      longitude?: number;
      star_rating?: number;
      address?: string;
      description?: string;
      images?: string[];
      amenities?: string[];
      is_published?: boolean;
    },
  ) {
    const existing = await this.prisma.hotels.findUnique({
      where: { id },
      include: {
        hotel_translations: {
          where: { language: 'en' },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Hotel with id ${id} not found`);
    }

    const hotel = await this.prisma.hotels.update({
      where: { id },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        star_rating: dto.star_rating,
        images: dto.images,
        amenities: dto.amenities,
        is_published: dto.is_published,
      },
    });

    const enTranslation = existing.hotel_translations[0];
    if (dto.name !== undefined || dto.address !== undefined || dto.description !== undefined) {
      if (enTranslation) {
        await this.prisma.hotel_translations.update({
          where: { id: enTranslation.id },
          data: {
            name: dto.name,
            address: dto.address,
            description: dto.description,
          },
        });
      } else {
        await this.prisma.hotel_translations.create({
          data: {
            id: randomUUID(),
            hotel_id: id,
            language: 'en',
            name: dto.name || '',
            address: dto.address || null,
            description: dto.description || null,
          },
        });
      }
    }

    return {
      id: hotel.id,
      name: dto.name ?? enTranslation?.name,
      latitude: Number(hotel.latitude),
      longitude: Number(hotel.longitude),
      star_rating: hotel.star_rating,
      address: dto.address ?? enTranslation?.address,
      description: dto.description ?? enTranslation?.description,
      images: hotel.images,
      amenities: hotel.amenities,
      is_published: hotel.is_published,
      created_at: hotel.created_at,
      updated_at: hotel.updated_at,
    };
  }

  async getHotelRooms(hotelId: string) {
    const hotel = await this.prisma.hotels.findUnique({
      where: { id: hotelId },
      select: { id: true },
    });

    if (!hotel) {
      throw new NotFoundException(`Hotel with id ${hotelId} not found`);
    }

    const rooms = await this.prisma.hotel_rooms.findMany({
      where: { hotel_id: hotelId },
      orderBy: { created_at: 'desc' },
    });

    return rooms.map((room) => ({
      id: room.id,
      hotel_id: room.hotel_id,
      room_type: room.room_type,
      max_occupancy: room.max_occupancy,
      price_usd: Number(room.price_usd),
      amenities: room.amenities,
      images: room.images,
      is_active: room.is_active,
      created_at: room.created_at,
      updated_at: room.updated_at,
    }));
  }

  async createRoom(
    hotelId: string,
    dto: {
      room_type: string;
      max_occupancy: number;
      price_usd: number;
      amenities?: string[];
      images?: string[];
      is_active?: boolean;
    },
  ) {
    const hotel = await this.prisma.hotels.findUnique({
      where: { id: hotelId },
      select: { id: true },
    });

    if (!hotel) {
      throw new NotFoundException(`Hotel with id ${hotelId} not found`);
    }

    return this.prisma.hotel_rooms.create({
      data: {
        id: randomUUID(),
        hotel_id: hotelId,
        room_type: dto.room_type,
        max_occupancy: dto.max_occupancy,
        price_usd: dto.price_usd,
        amenities: dto.amenities || [],
        images: dto.images || [],
        is_active: dto.is_active ?? true,
        updated_at: new Date(),
      },
    });
  }

  async updateRoom(
    hotelId: string,
    roomId: string,
    dto: {
      room_type?: string;
      max_occupancy?: number;
      price_usd?: number;
      amenities?: string[];
      images?: string[];
      is_active?: boolean;
    },
  ) {
    const room = await this.prisma.hotel_rooms.findFirst({
      where: { id: roomId, hotel_id: hotelId },
    });

    if (!room) {
      throw new NotFoundException(
        `Room with id ${roomId} not found for hotel ${hotelId}`,
      );
    }

    return this.prisma.hotel_rooms.update({
      where: { id: roomId },
      data: {
        room_type: dto.room_type,
        max_occupancy: dto.max_occupancy,
        price_usd: dto.price_usd,
        amenities: dto.amenities,
        images: dto.images,
        is_active: dto.is_active,
      },
    });
  }

  async getRoomAvailability(
    roomId: string,
    startDate: string,
    endDate: string,
  ) {
    const room = await this.prisma.hotel_rooms.findUnique({
      where: { id: roomId },
      include: {
        hotels: {
          select: {
            hotel_translations: {
              where: { language: 'en' },
              select: { name: true },
            },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with id ${roomId} not found`);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const overlappingItems = await this.prisma.booking_items.findMany({
      where: {
        hotel_room_id: roomId,
        date: {
          gte: start,
          lte: end,
        },
        bookings: {
          status: { not: 'cancelled' },
        },
      },
      include: {
        bookings: {
          select: {
            id: true,
            reference: true,
            status: true,
            start_date: true,
            end_date: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const bookedDates = overlappingItems.map((item) => ({
      date: item.date,
      booking_id: item.bookings.id,
      reference: item.bookings.reference,
      status: item.bookings.status,
    }));

    const isAvailable = bookedDates.length === 0 && room.is_active;

    return {
      room_id: roomId,
      room_type: room.room_type,
      hotel_name: room.hotels.hotel_translations[0]?.name || null,
      is_available: isAvailable,
      is_active: room.is_active,
      requested_range: { start_date: start, end_date: end },
      booked_dates: bookedDates,
      total_booked_nights: bookedDates.length,
    };
  }

  async createAuditLog(params: {
    userId?: string;
    eventType: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: params.userId || null,
          event_type: params.eventType as any,
          entity_type: params.entityType,
          entity_id: params.entityId || null,
          metadata: params.metadata || {},
        },
      });
    } catch (err) {
      this.logger.warn(`Audit log creation failed: ${err.message}`);
    }
  }
}
