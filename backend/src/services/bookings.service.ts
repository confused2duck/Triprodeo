import prisma from '../config/database';
import { BookingSource, BookingStatus, PaymentMethod, Prisma } from '@prisma/client';
import {
  assertRoomsAvailable,
  calculateRoomsRequired,
  getNights,
  getRoomForInventory,
  parseStayDate,
} from './inventory.service';

export const createBooking = async (data: {
  propertyId?: string;
  roomId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCount?: number;
  guests?: number;
  roomsRequired?: number;
  checkIn: string;
  checkOut: string;
  source?: BookingSource | string;
  paymentMethod?: string;
  notes?: string;
  addOnIds?: string[];
  promoCode?: string;
  userId?: string;
  hostId?: string;
}) => {
  const checkIn = parseStayDate(data.checkIn, 'checkIn');
  const checkOut = parseStayDate(data.checkOut, 'checkOut');
  const nights = getNights(checkIn, checkOut);
  const guests = Number(data.guests ?? data.guestCount ?? 1);

  const source = normalizeSource(data.source);
  if (source === 'WALKIN' && !data.hostId) {
    throw Object.assign(new Error('Walk-in bookings require host authentication'), { statusCode: 403 });
  }

  return createBookingWithRetry(async () => {
    return prisma.$transaction(async (tx) => {
      const room = await resolveBookingRoom({
        roomId: data.roomId,
        propertyId: data.propertyId,
        client: tx,
      });
      if (data.hostId && room.property.hostId !== data.hostId) {
        throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
      }

      const roomsRequired = data.roomsRequired
        ? Number(data.roomsRequired)
        : calculateRoomsRequired(guests, room.capacity);

      const expectedRooms = calculateRoomsRequired(guests, room.capacity);
      if (roomsRequired < expectedRooms) {
        throw Object.assign(
          new Error(`${expectedRooms} room(s) required for ${guests} guest(s)`),
          { statusCode: 400 }
        );
      }

      await assertRoomsAvailable(room.id, roomsRequired, checkIn, checkOut, tx);

      const nightlyPrice = room.nightlyPrice;
      const roomSubtotal = roomsRequired * nightlyPrice * nights;
      const addOnIds = Array.isArray(data.addOnIds)
        ? Array.from(new Set(data.addOnIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())))
        : [];
      const addOns = addOnIds.length
        ? await tx.addOn.findMany({
            where: { propertyId: room.propertyId, id: { in: addOnIds } },
            select: { id: true, name: true, price: true },
          })
        : [];
      if (addOns.length !== addOnIds.length) {
        throw Object.assign(new Error('One or more add-ons are unavailable'), { statusCode: 400 });
      }
      const addOnTotal = addOns.reduce((sum, addOn) => sum + addOn.price, 0);
      const totalBeforeDiscount = roomSubtotal + addOnTotal;
      const promoDiscount = getPromoDiscount(data.promoCode, totalBeforeDiscount);
      const totalAmount = totalBeforeDiscount - promoDiscount;
      const platformFee = Math.round(totalAmount * 0.1);
      const hostEarnings = totalAmount - platformFee;
      const bookingNotes = buildBookingNotes(data.notes, addOns, data.promoCode, promoDiscount);

      const booking = await tx.booking.create({
        data: {
          propertyId: room.propertyId,
          roomId: room.id,
          hostId: room.property.hostId,
          ...(data.userId ? { userId: data.userId } : {}),
          guestName: data.guestName,
          guestEmail: data.guestEmail,
          guestPhone: data.guestPhone,
          guestCount: guests,
          guests,
          rooms: roomsRequired,
          source,
          status: source === 'WALKIN' ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
          checkIn,
          checkOut,
          nights,
          pricePerNight: nightlyPrice,
          totalAmount,
          platformFee,
          hostEarnings,
          paymentMethod: normalizePaymentMethod(data.paymentMethod),
          notes: bookingNotes,
        },
        include: { room: true, property: { select: { name: true, city: true, state: true } } },
      });

      await tx.notification.create({
        data: {
          hostId: room.property.hostId,
          type: 'BOOKING',
          title: source === 'WALKIN' ? 'New Walk-in Booking!' : 'New Booking Received!',
          content: `${data.guestName} booked ${roomsRequired} room(s) for ${nights} night(s). Check-in: ${data.checkIn}`,
          actionUrl: `/host-portal?section=bookings`,
          actionLabel: 'View Booking',
        },
      });

      return {
        ...booking,
        roomsRequired,
        totalPrice: totalAmount,
        roomSubtotal,
        addOnTotal,
        discountAmount: promoDiscount,
        serviceFee: platformFee,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
};

const createBookingWithRetry = async <T>(operation: () => Promise<T>) => {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (isSerializationConflict(error) && attempt < maxAttempts) continue;
      throw error;
    }
  }
  throw Object.assign(new Error('Unable to create booking safely'), { statusCode: 409 });
};

const isSerializationConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';

const getDefaultRoomId = async (propertyId?: string) => {
  if (!propertyId) return undefined;

  const room = await prisma.roomType.findFirst({
    where: { propertyId, status: 'available' },
    orderBy: [{ price: 'asc' }, { pricePerNight: 'asc' }],
    select: { id: true },
  });

  return room?.id;
};

const resolveBookingRoom = async (params: {
  roomId?: string;
  propertyId?: string;
  client: Prisma.TransactionClient;
}) => {
  if (params.roomId) {
    return getRoomForInventory(params.roomId, params.client);
  }

  const defaultRoomId = await getDefaultRoomId(params.propertyId);
  if (defaultRoomId) {
    return getRoomForInventory(defaultRoomId, params.client);
  }

  throw Object.assign(new Error('roomId is required'), { statusCode: 400 });
};

const normalizeSource = (source?: BookingSource | string): BookingSource => {
  const normalized = String(source || 'ONLINE').toUpperCase();
  if (normalized !== 'ONLINE' && normalized !== 'WALKIN') {
    throw Object.assign(new Error('source must be ONLINE or WALKIN'), { statusCode: 400 });
  }
  return normalized as BookingSource;
};

const normalizePaymentMethod = (paymentMethod?: string): PaymentMethod => {
  const normalized = String(paymentMethod || 'CARD').toUpperCase();
  if (!Object.values(PaymentMethod).includes(normalized as PaymentMethod)) {
    throw Object.assign(new Error('Invalid payment method'), { statusCode: 400 });
  }
  return normalized as PaymentMethod;
};

const getPromoDiscount = (promoCode: string | undefined, totalBeforeDiscount: number) => {
  const normalized = String(promoCode || '').trim().toUpperCase();
  if (!normalized) return 0;
  if (normalized === 'TRIPRODEO20') return Math.round(totalBeforeDiscount * 0.2);
  if (normalized === 'WELCOME10') return Math.round(totalBeforeDiscount * 0.1);
  throw Object.assign(new Error('Invalid promo code'), { statusCode: 400 });
};

const buildBookingNotes = (
  notes: string | undefined,
  addOns: Array<{ name: string; price: number }>,
  promoCode: string | undefined,
  promoDiscount: number
) => {
  const parts = [notes?.trim()].filter(Boolean) as string[];
  if (addOns.length) {
    parts.push(`Add-ons: ${addOns.map((addOn) => `${addOn.name} (${addOn.price})`).join(', ')}`);
  }
  if (promoDiscount > 0) {
    parts.push(`Promo: ${String(promoCode).trim().toUpperCase()} (-${promoDiscount})`);
  }
  return parts.length ? parts.join('\n') : undefined;
};

export const confirmRazorpayBooking = async (data: {
  bookingId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaid: number;
  currency: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: data.bookingId } });
    if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
    if (booking.status === BookingStatus.CONFIRMED) return booking;
    if (booking.status !== BookingStatus.PENDING) {
      throw Object.assign(new Error('Booking cannot be confirmed'), { statusCode: 409 });
    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CONFIRMED,
        paymentRef: JSON.stringify({
          provider: 'razorpay',
          orderId: data.razorpayOrderId,
          paymentId: data.razorpayPaymentId,
          amountPaid: data.amountPaid,
          currency: data.currency,
          verifiedAt: new Date().toISOString(),
        }),
      },
      include: { room: true, property: { select: { name: true, city: true, state: true } } },
    });

    await tx.notification.create({
      data: {
        hostId: booking.hostId,
        type: 'BOOKING',
        title: 'Booking Confirmed!',
        content: `${booking.guestName} completed payment for booking ${booking.id}.`,
        actionUrl: `/host-portal?section=bookings`,
        actionLabel: 'View Booking',
      },
    });

    return updated;
  });
};

export const getBookingById = async (id: string, requesterId?: string, role?: string, hostId?: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      room: true,
      property: { select: { name: true, images: true, city: true, state: true } },
      host: { select: { name: true, email: true } },
    },
  });
  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });

  if (role === 'user' && booking.userId !== requesterId) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }

  if ((role === 'host' || role === 'staff') && hostId && booking.hostId !== hostId) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }

  return booking;
};

export const updateBookingStatus = async (
  id: string,
  status: BookingStatus,
  hostId: string
) => {
  const booking = await prisma.booking.findFirst({ where: { id, hostId } });
  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });

  return prisma.booking.update({ where: { id }, data: { status } });
};

export const getHostBookings = async (
  hostId: string,
  status?: BookingStatus,
  page = 1,
  limit = 20
) => {
  const where = { hostId, ...(status ? { status } : {}) };
  const [total, bookings] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        room: true,
        property: { select: { name: true, images: true } },
      },
    }),
  ]);
  return { bookings, total, page, limit };
};

export const getAllBookings = async (
  status?: BookingStatus,
  page = 1,
  limit = 20
) => {
  const where = status ? { status } : {};
  const [total, bookings] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        room: { select: { id: true, name: true } },
        property: { select: { id: true, name: true, city: true, state: true } },
      },
    }),
  ]);

  // Transform Prisma response to match HostBooking interface
  const transformedBookings = bookings.map((b) => ({
    id: b.id,
    propertyId: b.propertyId,
    propertyName: b.property.name,
    hostId: b.hostId,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    guestPhone: b.guestPhone,
    guestCount: b.guestCount,
    checkIn: b.checkIn.toISOString().split('T')[0],
    checkOut: b.checkOut.toISOString().split('T')[0],
    nights: b.nights,
    pricePerNight: b.pricePerNight,
    totalAmount: b.totalAmount,
    platformFee: b.platformFee,
    hostEarnings: b.hostEarnings,
    status: b.status.toLowerCase() as 'confirmed' | 'pending' | 'cancelled' | 'completed',
    bookedAt: b.createdAt.toISOString(),
    paymentMethod: b.paymentMethod,
  }));

  return { bookings: transformedBookings, total, page, limit };
};
