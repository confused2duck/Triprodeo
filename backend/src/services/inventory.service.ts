import { Prisma } from '@prisma/client';
import prisma from '../config/database';

const activeBookingStatuses = ['CONFIRMED', 'PENDING'] as const;

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

export const parseStayDate = (value: string, fieldName: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw Object.assign(new Error(`${fieldName} must be in YYYY-MM-DD format`), { statusCode: 400 });
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    throw Object.assign(new Error(`${fieldName} must be a valid date`), { statusCode: 400 });
  }

  return date;
};

export const getNights = (checkIn: Date, checkOut: Date) => {
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
  if (nights < 1) {
    throw Object.assign(new Error('Check-out must be after check-in'), { statusCode: 400 });
  }
  return nights;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

export const buildAvailabilityCalendar = (start: Date, end: Date, available: number) => {
  const days: { date: string; available: number }[] = [];
  for (let cursor = new Date(start); cursor < end; cursor = addDays(cursor, 1)) {
    days.push({
      date: toDateKey(cursor),
      available: Math.max(0, available),
    });
  }
  return days;
};

export const calculateRoomsRequired = (guests: number, capacity: number) => {
  if (!Number.isInteger(guests) || guests < 1) {
    throw Object.assign(new Error('Guests must be at least 1'), { statusCode: 400 });
  }
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw Object.assign(new Error('Room capacity is invalid'), { statusCode: 500 });
  }
  return Math.ceil(guests / capacity);
};

const getRoomInventoryCount = (room: {
  totalCount: number;
  totalRooms: number;
}) => (room.totalCount > 0 ? room.totalCount : room.totalRooms);

const getRoomNightlyPrice = (room: {
  price: number;
  pricePerNight: number;
}) => (room.price > 0 ? room.price : room.pricePerNight);

export const getRoomForInventory = async (roomId: string, client: PrismaClientLike = prisma) => {
  const room = await client.roomType.findUnique({
    where: { id: roomId },
    include: {
      property: { select: { id: true, hostId: true, status: true } },
    },
  });

  if (!room || room.status !== 'available' || room.property.status !== 'ACTIVE') {
    throw Object.assign(new Error('Room not available'), { statusCode: 404 });
  }

  const inventoryCount = getRoomInventoryCount(room);
  if (inventoryCount < 1) {
    throw Object.assign(new Error('Room not available'), { statusCode: 404 });
  }

  return {
    ...room,
    inventoryCount,
    nightlyPrice: getRoomNightlyPrice(room),
  };
};

export const getPropertyForInventory = async (propertyId: string, client: PrismaClientLike = prisma) => {
  const property = await client.property.findUnique({
    where: { id: propertyId },
    include: {
      roomTypes: true,
    },
  });

  if (!property || property.status !== 'ACTIVE' || property.roomTypes.length === 0) {
    throw Object.assign(new Error('Property not available'), { statusCode: 404 });
  }

  const roomTypes = property.roomTypes
    .filter((room) => room.status === 'available')
    .map((room) => ({
      ...room,
      inventoryCount: getRoomInventoryCount(room),
      nightlyPrice: getRoomNightlyPrice(room),
    }))
    .filter((room) => room.inventoryCount > 0);

  if (roomTypes.length === 0) {
    throw Object.assign(new Error('Property not available'), { statusCode: 404 });
  }

  return {
    ...property,
    roomTypes,
  };
};

export const getBookedRoomsForRange = async (
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  client: PrismaClientLike = prisma
) => {
  const aggregate = await client.booking.aggregate({
    where: {
      roomId,
      status: { in: [...activeBookingStatuses] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    _sum: { rooms: true },
  });

  return aggregate._sum.rooms ?? 0;
};

export const getMinimumAvailableRooms = async (
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  client: PrismaClientLike = prisma
) => {
  const calendar = await getCalendarAvailability(roomId, checkIn, checkOut, client);
  return calendar.reduce(
    (minimum, day) => Math.min(minimum, day.available),
    calendar[0]?.available ?? 0
  );
};

export const getAvailableRooms = async (
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  client: PrismaClientLike = prisma
) => {
  const room = await getRoomForInventory(roomId, client);
  const calendar = await getCalendarAvailability(roomId, checkIn, checkOut, client);
  const availableRooms = calendar.reduce(
    (minimum, day) => Math.min(minimum, day.available),
    room.inventoryCount
  );

  return {
    room,
    totalRooms: room.inventoryCount,
    bookedRooms: room.inventoryCount - availableRooms,
    availableRooms,
  };
};

export const getPropertyAvailabilitySnapshot = async (
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  client: PrismaClientLike = prisma
) => {
  const property = await getPropertyForInventory(propertyId, client);
  const roomSnapshots = await Promise.all(
    property.roomTypes.map(async (room) => {
      const calendar = await getCalendarAvailability(room.id, checkIn, checkOut, client);
      const availableRooms = calendar.reduce(
        (minimum, day) => Math.min(minimum, day.available),
        room.inventoryCount
      );

      return {
        room,
        availableRooms,
        bookedRooms: room.inventoryCount - availableRooms,
        calendar,
      };
    })
  );

  const availableRooms = roomSnapshots.reduce(
    (minimum, snapshot) => Math.min(minimum, snapshot.availableRooms),
    Math.max(...roomSnapshots.map((snapshot) => snapshot.availableRooms))
  );

  return {
    property,
    roomSnapshots,
    totalRooms: property.roomTypes.reduce((sum, room) => sum + room.inventoryCount, 0),
    bookedRooms: property.roomTypes.reduce((sum, room) => sum + room.inventoryCount, 0) - availableRooms,
    availableRooms,
  };
};

export const getPropertyCalendarAvailability = async (
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  client: PrismaClientLike = prisma
) => {
  const snapshot = await getPropertyAvailabilitySnapshot(propertyId, checkIn, checkOut, client);
  const firstCalendar = snapshot.roomSnapshots[0]?.calendar ?? [];

  return firstCalendar.map((day, index) => ({
    ...day,
    available: Math.min(...snapshot.roomSnapshots.map((room) => room.calendar[index]?.available ?? 0)),
  }));
};

export const getAvailabilitySnapshot = async (
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  client: PrismaClientLike = prisma
) => {
  const room = await getRoomForInventory(roomId, client);
  const calendar = await getCalendarAvailability(roomId, checkIn, checkOut, client);
  const availableRooms = calendar.reduce(
    (minimum, day) => Math.min(minimum, day.available),
    room.inventoryCount
  );

  return {
    room,
    totalRooms: room.inventoryCount,
    bookedRooms: room.inventoryCount - availableRooms,
    availableRooms,
    calendar,
  };
};

export const assertRoomsAvailable = async (
  roomId: string,
  requestedRooms: number,
  checkIn: Date,
  checkOut: Date,
  client: PrismaClientLike = prisma
) => {
  if (!Number.isInteger(requestedRooms) || requestedRooms < 1) {
    throw Object.assign(new Error('Requested rooms must be at least 1'), { statusCode: 400 });
  }

  const availability = await getAvailabilitySnapshot(roomId, checkIn, checkOut, client);
  if (requestedRooms > availability.availableRooms) {
    throw Object.assign(
      new Error(`Only ${availability.availableRooms} room(s) available for selected dates`),
      { statusCode: 409 }
    );
  }

  return availability;
};

export const getAvailabilitySummary = async (
  params: {
    roomId?: string;
    propertyId?: string;
    checkIn: Date;
    checkOut: Date;
  },
  client: PrismaClientLike = prisma
) => {
  if (params.roomId) {
    const availability = await getAvailableRooms(params.roomId, params.checkIn, params.checkOut, client);
    return {
      ...availability,
      isAvailable: availability.availableRooms > 0,
      roomId: params.roomId,
    };
  }

  if (!params.propertyId) {
    throw Object.assign(new Error('roomId or propertyId is required'), { statusCode: 400 });
  }

  const availability = await getPropertyAvailabilitySnapshot(params.propertyId, params.checkIn, params.checkOut, client);
  return {
    ...availability,
    isAvailable: availability.availableRooms > 0,
    propertyId: params.propertyId,
  };
};

export const getCalendarAvailability = async (
  roomId: string,
  startDate: string | Date,
  endDate: string | Date,
  client: PrismaClientLike = prisma
) => {
  const start = startDate instanceof Date ? startDate : parseStayDate(startDate, 'startDate');
  const end = endDate instanceof Date ? endDate : parseStayDate(endDate, 'endDate');
  getNights(start, end);

  const room = await getRoomForInventory(roomId, client);
  const bookings = await client.booking.findMany({
    where: {
      roomId,
      status: { in: [...activeBookingStatuses] },
      checkIn: { lt: end },
      checkOut: { gt: start },
    },
    select: { checkIn: true, checkOut: true, rooms: true },
  });

  const days: { date: string; available: number }[] = [];
  for (let cursor = new Date(start); cursor < end; cursor = addDays(cursor, 1)) {
    const nextDay = addDays(cursor, 1);
    const bookedRooms = bookings.reduce((sum, booking) => (
      booking.checkIn < nextDay && booking.checkOut > cursor ? sum + booking.rooms : sum
    ), 0);

    days.push({
      date: toDateKey(cursor),
      available: Math.max(0, room.inventoryCount - bookedRooms),
    });
  }

  return days;
};
