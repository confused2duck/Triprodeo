import prisma from '../config/database';
import { parseStayDate } from './inventory.service';

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const;
type DayOutingStatus = typeof STATUSES[number];

const normalizeStatus = (status: unknown): DayOutingStatus => {
  const value = String(status || 'pending').toLowerCase();
  if (!STATUSES.includes(value as DayOutingStatus)) {
    throw Object.assign(new Error('Invalid day outing status'), { statusCode: 400 });
  }
  return value as DayOutingStatus;
};

type DayOutingWithProperty = Awaited<ReturnType<typeof prisma.dayOutingEnquiry.findFirstOrThrow>> & {
  property: {
    name: string;
    location: string;
    images: string[];
    host: { name: string; phone: string | null };
  };
};

const toResponse = (enquiry: DayOutingWithProperty) => ({
  id: enquiry.id,
  enquiryId: enquiry.id,
  propertyId: enquiry.propertyId,
  propertyName: enquiry.property.name,
  propertyLocation: enquiry.property.location,
  location: enquiry.property.location,
  image: enquiry.property.images[0] ?? '',
  date: enquiry.date.toISOString().slice(0, 10),
  timeSlot: enquiry.timeSlot,
  timeRange: enquiry.timeRange,
  packageTitle: enquiry.packageTitle,
  guests: enquiry.guests,
  pricePerPerson: enquiry.pricePerPerson,
  estimatedTotal: enquiry.estimatedTotal,
  status: normalizeStatus(enquiry.status),
  occasion: enquiry.occasion ?? '',
  submittedAt: enquiry.createdAt.toISOString(),
  specialRequests: enquiry.specialRequests ?? '',
  notes: enquiry.specialRequests ?? '',
  guestName: enquiry.guestName,
  guestEmail: enquiry.guestEmail,
  guestPhone: enquiry.guestPhone ?? '',
  hostName: enquiry.property.host.name,
  hostPhone: enquiry.property.host.phone ?? '',
});

export const createDayOutingEnquiry = async (data: {
  propertyId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  date: string;
  timeSlot: string;
  timeRange?: string;
  packageTitle?: string;
  guests: number;
  pricePerPerson: number;
  estimatedTotal?: number;
  occasion?: string;
  specialRequests?: string;
  userId?: string;
}) => {
  const date = parseStayDate(data.date, 'date');
  const guests = Number(data.guests);
  const pricePerPerson = Number(data.pricePerPerson);

  if (!data.propertyId || !data.guestName || !data.guestEmail || !data.date || !data.timeSlot) {
    throw Object.assign(new Error('Missing required day outing fields'), { statusCode: 400 });
  }
  if (!Number.isInteger(guests) || guests < 1) {
    throw Object.assign(new Error('Guests must be at least 1'), { statusCode: 400 });
  }
  if (!Number.isFinite(pricePerPerson) || pricePerPerson < 0) {
    throw Object.assign(new Error('pricePerPerson must be a valid amount'), { statusCode: 400 });
  }

  const property = await prisma.property.findUnique({
    where: { id: data.propertyId },
    select: { id: true, status: true, dayPackage: true },
  });
  if (!property || property.status !== 'ACTIVE') {
    throw Object.assign(new Error('Property not available'), { statusCode: 404 });
  }

  const dayPackage = property.dayPackage as { enabled?: boolean } | null;
  if (!dayPackage?.enabled) {
    throw Object.assign(new Error('Day outing is not enabled for this property'), { statusCode: 400 });
  }

  const enquiry = await prisma.dayOutingEnquiry.create({
    data: {
      propertyId: data.propertyId,
      ...(data.userId ? { userId: data.userId } : {}),
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      guestPhone: data.guestPhone,
      date,
      timeSlot: data.timeSlot,
      timeRange: data.timeRange,
      packageTitle: data.packageTitle,
      guests,
      pricePerPerson,
      estimatedTotal: Number(data.estimatedTotal ?? guests * pricePerPerson),
      occasion: data.occasion,
      specialRequests: data.specialRequests,
    },
    include: {
      property: {
        select: {
          name: true,
          location: true,
          images: true,
          host: { select: { name: true, phone: true } },
        },
      },
    },
  });

  return toResponse(enquiry);
};

export const listDayOutingEnquiries = async (params: {
  role?: string;
  hostId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) => {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const status = params.status && params.status !== 'all' ? normalizeStatus(params.status) : undefined;
  const where = {
    ...(status ? { status } : {}),
    ...(params.role === 'host' || params.role === 'staff'
      ? { property: { hostId: params.hostId } }
      : {}),
  };

  const [total, enquiries] = await prisma.$transaction([
    prisma.dayOutingEnquiry.count({ where }),
    prisma.dayOutingEnquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        property: {
          select: {
            name: true,
            location: true,
            images: true,
            host: { select: { name: true, phone: true } },
          },
        },
      },
    }),
  ]);

  return {
    enquiries: enquiries.map(toResponse),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
};

export const updateDayOutingStatus = async (id: string, statusInput: string, params: {
  role?: string;
  hostId?: string;
}) => {
  const status = normalizeStatus(statusInput);
  const existing = await prisma.dayOutingEnquiry.findFirst({
    where: {
      id,
      ...(params.role === 'host' || params.role === 'staff'
        ? { property: { hostId: params.hostId } }
        : {}),
    },
  });
  if (!existing) throw Object.assign(new Error('Day outing enquiry not found'), { statusCode: 404 });

  const enquiry = await prisma.dayOutingEnquiry.update({
    where: { id },
    data: { status },
    include: {
      property: {
        select: {
          name: true,
          location: true,
          images: true,
          host: { select: { name: true, phone: true } },
        },
      },
    },
  });
  return toResponse(enquiry);
};
