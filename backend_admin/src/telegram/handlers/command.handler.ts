import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SessionService } from '../services/session.service';
import { DriverStatus, AssignmentStatus } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';

export interface CommandResponse {
  text: string;
  keyboard?: {
    inline_keyboard: Array<
      Array<{ text: string; callback_data: string }>
    >;
  };
  parse_mode?: 'HTML';
}

@Injectable()
export class CommandHandler {
  private readonly logger = new Logger(CommandHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sessionService: SessionService,
  ) {}

  async handleCommand(
    telegramId: string,
    command: string,
    args?: string[],
  ): Promise<CommandResponse> {
    const cleanCommand = command.toLowerCase().trim();

    switch (cleanCommand) {
      case '/start':
        return this.handleStart(telegramId);
      case '/online':
        return this.handleOnline(telegramId);
      case '/offline':
        return this.handleOffline(telegramId);
      case '/status':
        return this.handleStatus(telegramId);
      case '/mytrip':
        return this.handleMyTrip(telegramId);
      case '/history':
        return this.handleHistory(telegramId);
      case '/earnings':
        return this.handleEarnings(telegramId);
      case '/emergency':
        return this.handleEmergency(telegramId);
      case '/support':
        return this.handleSupport(telegramId);
      case '/language':
        return this.handleLanguage(telegramId);
      case '/location':
        return this.handleLocation(telegramId);
      case '/help':
        return this.handleHelp(telegramId);
      default:
        return {
          text: 'Unknown command. Use /help to see available commands.',
        };
    }
  }

  private async handleStart(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return {
        text:
          'Welcome to DerLg Driver Bot!\n\n' +
          'To get started, please provide your credentials in this format:\n\n' +
          'driver_id: YOUR_ID\npin: YOUR_PIN\n\n' +
          'Example:\ndriver_id: DRV001\npin: 1234\n\n' +
          'Your Fleet Manager will provide these credentials.',
      };
    }

    const vehicle = driver.vehicleId
      ? await this.prisma.transportationVehicle.findUnique({
          where: { id: driver.vehicleId },
          select: { name: true },
        })
      : null;

    const lastUpdate = driver.lastStatusUpdate
      ? formatDistanceToNow(new Date(driver.lastStatusUpdate), {
          addSuffix: true,
        })
      : 'never';

    const statusEmoji =
      driver.status === 'AVAILABLE'
        ? '🟢'
        : driver.status === 'BUSY'
          ? '🔴'
          : '⚪';

    return {
      text:
        `Welcome back, ${driver.driverName}!\n\n` +
        `${statusEmoji} Status: ${driver.status}\n` +
        `Vehicle: ${vehicle?.name || 'Not assigned'}\n` +
        `Last update: ${lastUpdate}\n\n` +
        `Use the buttons below or type a command:`,
      keyboard: {
        inline_keyboard: [
          [
            { text: '🟢 Go Online', callback_data: 'status:online' },
            { text: '🔴 Go Offline', callback_data: 'status:offline' },
          ],
          [
            { text: '📊 View Status', callback_data: 'status:view' },
            { text: '🚗 My Trip', callback_data: 'trip:view' },
          ],
          [
            { text: '📜 History', callback_data: 'history:view' },
            { text: '❓ Help', callback_data: 'help' },
          ],
        ],
      },
    };
  }

  private async handleOnline(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    await this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        status: DriverStatus.AVAILABLE,
        lastStatusUpdate: new Date(),
        lastTelegramActivity: new Date(),
      },
    });

    await this.redis.getClient().publish(
      `driver_status_changed:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        status: DriverStatus.AVAILABLE,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      text:
        'You are now ONLINE\n\n' +
        'You are available for trip assignments. We will notify you when a trip is assigned.',
      keyboard: {
        inline_keyboard: [
          [{ text: '🔴 Go Offline', callback_data: 'status:offline' }],
          [{ text: '📊 View Status', callback_data: 'status:view' }],
        ],
      },
    };
  }

  private async handleOffline(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    const activeAssignments = await this.prisma.driverAssignment.count({
      where: {
        driverId: driver.id,
        status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
      },
    });

    if (activeAssignments > 0) {
      return {
        text:
          'Cannot go offline\n\n' +
          'You have an active trip in progress. Please complete the trip first.',
        keyboard: {
          inline_keyboard: [
            [{ text: '🚗 View Trip Details', callback_data: 'trip:view' }],
          ],
        },
      };
    }

    await this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        status: DriverStatus.OFFLINE,
        lastStatusUpdate: new Date(),
        lastTelegramActivity: new Date(),
      },
    });

    await this.redis.getClient().publish(
      `driver_status_changed:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        status: DriverStatus.OFFLINE,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      text:
        'You are now OFFLINE\n\n' +
        "You won't receive trip assignments. Tap below when ready to work:",
      keyboard: {
        inline_keyboard: [
          [{ text: '🟢 Go Online', callback_data: 'status:online' }],
        ],
      },
    };
  }

  private async handleStatus(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    const vehicle = driver.vehicleId
      ? await this.prisma.transportationVehicle.findUnique({
          where: { id: driver.vehicleId },
          select: { name: true },
        })
      : null;

    const activeAssignment = await this.prisma.driverAssignment.findFirst({
      where: {
        driverId: driver.id,
        status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
      },
      orderBy: { assignmentTimestamp: 'desc' },
    });

    const activeBooking = activeAssignment?.bookingId
      ? await this.prisma.booking.findUnique({
          where: { id: activeAssignment.bookingId },
          select: { reference: true },
        })
      : null;

    const statusEmoji =
      driver.status === 'AVAILABLE'
        ? '🟢'
        : driver.status === 'BUSY'
          ? '🔴'
          : '⚪';

    const lastUpdate = driver.lastStatusUpdate
      ? formatDistanceToNow(new Date(driver.lastStatusUpdate), {
          addSuffix: true,
        })
      : 'never';

    let text =
      `Your Status\n\n` +
      `${statusEmoji} Status: ${driver.status}\n` +
      `Vehicle: ${vehicle?.name || 'Not assigned'}\n` +
      `Last update: ${lastUpdate}\n`;

    if (activeBooking) {
      text += `\nActive trip: ${activeBooking.reference || 'N/A'}`;
    }

    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

    if (driver.status !== DriverStatus.AVAILABLE) {
      buttons.push([
        { text: '🟢 Go Online', callback_data: 'status:online' },
      ]);
    }

    if (driver.status !== DriverStatus.OFFLINE) {
      buttons.push([
        { text: '🔴 Go Offline', callback_data: 'status:offline' },
      ]);
    }

    buttons.push([
      { text: '🚗 My Trip', callback_data: 'trip:view' },
      { text: '📜 History', callback_data: 'history:view' },
    ]);

    return { text, keyboard: { inline_keyboard: buttons } };
  }

  private async handleMyTrip(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    const assignment = await this.prisma.driverAssignment.findFirst({
      where: {
        driverId: driver.id,
        status: AssignmentStatus.ACCEPTED,
      },
      orderBy: { assignmentTimestamp: 'desc' },
    });

    if (!assignment) {
      const isOffline = driver.status === DriverStatus.OFFLINE;
      return {
        text:
          `No active trips\n\n` +
          `Status: ${driver.status}\n` +
          (isOffline
            ? 'You are currently offline. Go online to receive assignments.'
            : 'You have no active assignments at the moment.'),
        keyboard: {
          inline_keyboard: isOffline
            ? [[{ text: '🟢 Go Online', callback_data: 'status:online' }]]
            : [[{ text: '📊 View Status', callback_data: 'status:view' }]],
        },
      };
    }

    const booking = assignment.bookingId
      ? await this.prisma.booking.findUnique({
          where: { id: assignment.bookingId },
          select: {
            reference: true,
            start_date: true,
            passenger_count: true,
            totalUsd: true,
            users: { select: { full_name: true, phone: true } },
          },
        })
      : null;
    const pickupTime = booking?.start_date
      ? new Date(booking.start_date).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'TBD';

    return {
      text:
        `Active Trip\n\n` +
        `Booking: ${booking?.reference || 'N/A'}\n` +
        `Customer: ${booking?.users?.full_name || 'N/A'}\n` +
        `Passengers: ${booking?.passenger_count || 1}\n` +
        `Pickup: ${pickupTime}\n` +
        `Total: $${booking?.totalUsd || 0}\n\n` +
        `Customer phone: ${booking?.users?.phone || 'N/A'}`,
      keyboard: {
        inline_keyboard: [
          [
            { text: '🚀 Start Trip', callback_data: `trip:start:${assignment.id}` },
            { text: '✅ Complete Trip', callback_data: `trip:complete:${assignment.id}` },
          ],
          [
            { text: '📞 Contact Support', callback_data: 'support:contact' },
            { text: '🚨 Emergency', callback_data: 'emergency:alert' },
          ],
        ],
      },
    };
  }

  private async handleHistory(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    const assignments = await this.prisma.driverAssignment.findMany({
      where: {
        driverId: driver.id,
        status: AssignmentStatus.COMPLETED,
      },
      orderBy: { completionTimestamp: 'desc' },
      take: 10,
    });

    if (assignments.length === 0) {
      return {
        text: 'No trip history\n\nYou have not completed any trips yet.',
      };
    }

    const bookingIds = assignments.map((a) => a.bookingId).filter(Boolean);
    const bookings = bookingIds.length
      ? await this.prisma.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, reference: true },
        })
      : [];
    const bookingMap = new Map(bookings.map((b) => [b.id, b]));

    const lines = assignments.map((a, i) => {
      const date = a.completionTimestamp
        ? new Date(a.completionTimestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : 'N/A';
      const ref = bookingMap.get(a.bookingId)?.reference;
      return `${i + 1}. ${date} — ${ref || a.id.slice(0, 8)}`;
    });

    return {
      text: `Trip History (last ${assignments.length})\n\n${lines.join('\n')}`,
      keyboard: {
        inline_keyboard: [
          [
            { text: '📅 Today', callback_data: 'history:today' },
            { text: '📆 This Week', callback_data: 'history:week' },
            { text: '🗓️ This Month', callback_data: 'history:month' },
          ],
        ],
      },
    };
  }

  private async handleEarnings(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [todayCount, weekCount, monthCount] = await Promise.all([
      this.prisma.driverAssignment.count({
        where: {
          driverId: driver.id,
          status: AssignmentStatus.COMPLETED,
          completionTimestamp: { gte: today },
        },
      }),
      this.prisma.driverAssignment.count({
        where: {
          driverId: driver.id,
          status: AssignmentStatus.COMPLETED,
          completionTimestamp: { gte: weekAgo },
        },
      }),
      this.prisma.driverAssignment.count({
        where: {
          driverId: driver.id,
          status: AssignmentStatus.COMPLETED,
          completionTimestamp: { gte: monthAgo },
        },
      }),
    ]);

    return {
      text:
        `Earnings Summary\n\n` +
        `Today: ${todayCount} trips\n` +
        `This Week: ${weekCount} trips\n` +
        `This Month: ${monthCount} trips`,
    };
  }

  private async handleEmergency(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    return {
      text:
        'Emergency Alert\n\n' +
        'Tap the button below to send an emergency alert to dispatch. They will contact you immediately.\n\n' +
        'Emergency Contacts:\n' +
        'Police: 117\n' +
        'Ambulance: 119\n' +
        'Tourist Police: 012 942 484',
      keyboard: {
        inline_keyboard: [
          [{ text: '🚨 SEND EMERGENCY ALERT', callback_data: 'emergency:alert' }],
        ],
      },
    };
  }

  private async handleSupport(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    await this.sessionService.setSession(telegramId, 'support_request');

    return {
      text:
        'Support Request\n\n' +
        'Please describe your issue or question. Type your message and we will create a support ticket for you.',
    };
  }

  private async handleLanguage(telegramId: string): Promise<CommandResponse> {
    return {
      text: 'Select Language\n\nChoose your preferred language:',
      keyboard: {
        inline_keyboard: [
          [{ text: '🇰🇭 ខ្មែរ (Khmer)', callback_data: 'lang:km' }],
          [{ text: '🇬🇧 English', callback_data: 'lang:en' }],
          [{ text: '🇨🇳 中文 (Chinese)', callback_data: 'lang:zh' }],
        ],
      },
    };
  }

  private async handleLocation(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    const locationData = await this.redis
      .getClient()
      .get(`driver_location:${driver.id}`);

    if (locationData) {
      const loc = JSON.parse(locationData);
      const time = loc.timestamp
        ? formatDistanceToNow(new Date(loc.timestamp), { addSuffix: true })
        : 'recently';

      return {
        text:
          `Your Location\n\n` +
          `Lat: ${loc.latitude}\n` +
          `Lng: ${loc.longitude}\n` +
          `Updated: ${time}`,
      };
    }

    return {
      text:
        'Location Sharing\n\n' +
        'You are not currently sharing your location. Share your live location during trips so dispatch can track your progress.',
      keyboard: {
        inline_keyboard: [
          [{ text: '📍 Share Location', callback_data: 'location:share' }],
        ],
      },
    };
  }

  private async handleHelp(telegramId: string): Promise<CommandResponse> {
    return {
      text:
        'Available Commands\n\n' +
        '/online — Go online and receive assignments\n' +
        '/offline — Go offline\n' +
        '/status — Check your current status\n' +
        '/mytrip — View active trip details\n' +
        '/history — View completed trips\n' +
        '/earnings — View earnings summary\n' +
        '/location — View or share location\n' +
        '/emergency — Send emergency alert\n' +
        '/support — Create support ticket\n' +
        '/language — Change language\n' +
        '/help — Show this help message',
    };
  }
}
