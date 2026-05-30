import prisma from '../config/database';
import { Prisma, PropertyStatus } from '@prisma/client';
import { getAvailableRooms, getCalendarAvailability, parseStayDate, getNights } from './inventory.service';

type PublicPropertyStatus = 'approved' | 'active' | 'pending' | 'rejected' | 'inactive';

const statusToPrisma: Record<PublicPropertyStatus, PropertyStatus> = {
  approved: 'ACTIVE',
  active: 'ACTIVE',
  pending: 'PENDING',
  rejected: 'REJECTED',
  inactive: 'INACTIVE',
};

const propertyTypeToPrisma = (type?: unknown): string => {
  const normalized = typeof type === 'string' ? type.trim().toLowerCase() : '';
  return normalized || 'villa';
};

const baseWhere: Prisma.PropertyWhereInput = {
  status: 'ACTIVE',
  verified: true,
};

const dedupeProperties = <T extends { id: string }>(items: T[]) =>
  Array.from(new Map(items.map((item) => [item.id, item])).values());

const withComputedRating = <T extends { rating?: number | null; reviewCount?: number | null; reviews?: Array<{ rating: number | null }>; _count?: { reviews?: number } }>(property: T) => {
  const reviews = Array.isArray(property.reviews) ? property.reviews.filter((review) => typeof review.rating === 'number') : [];
  const averageRating = reviews.length
    ? Math.round((reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length) * 10) / 10
    : Number(property.rating ?? 0);
  const { reviews: _reviews, ...rest } = property as T & { reviews?: Array<{ rating: number | null }> };
  return {
    ...rest,
    rating: averageRating,
    reviewCount: property._count?.reviews ?? property.reviewCount ?? reviews.length,
  };
};

const propertyEditorInclude = {
  host: { select: { name: true, avatar: true, joinedAt: true } },
  roomTypes: true,
  addOns: true,
} satisfies Prisma.PropertyInclude;

const toPropertyVisibilityWhere = (status?: string, ownerId?: string, role?: string): Prisma.PropertyWhereInput => {
  if (role === 'admin') {
    const where: Prisma.PropertyWhereInput = {};
    if (status && status !== 'all') {
      const prismaStatus = statusToPrisma[status as PublicPropertyStatus];
      if (prismaStatus) {
        where.status = prismaStatus;
        if (prismaStatus === 'ACTIVE' && status === 'approved') where.verified = true;
      }
    }
    if (ownerId) where.hostId = ownerId;
    return where;
  }

  if (role === 'host') {
    return {
      hostId: ownerId,
      ...(status && status !== 'all'
        ? { status: statusToPrisma[status as PublicPropertyStatus] }
        : {}),
    };
  }

  if (status === 'pending' || status === 'rejected' || status === 'inactive') {
    return { status: statusToPrisma[status as PublicPropertyStatus] };
  }

  // Public and user-facing traffic only see approved listings.
  return baseWhere;
};

export const getAllProperties = async (filters: {
  location?: string;
  city?: string;
  type?: string;
  status?: string;
  ownerId?: string;
  role?: string;
  minPrice?: number;
  maxPrice?: number;
  minGuests?: number;
  rating?: number;
  checkIn?: string;
  checkOut?: string;
  amenities?: string[];
  tag?: string;
  page?: number;
  limit?: number;
  sort?: string;
}) => {
  const {
    location,
    city,
    type,
    status,
    ownerId,
    role,
    minPrice,
    maxPrice,
    minGuests,
    rating,
    checkIn,
    checkOut,
    amenities,
    tag,
    page = 1,
    limit = 20,
    sort = 'rating',
  } = filters;

  const where: Prisma.PropertyWhereInput = toPropertyVisibilityWhere(status, ownerId, role);

  if (location) {
    where.OR = [
      { city: { contains: location, mode: 'insensitive' } },
      { state: { contains: location, mode: 'insensitive' } },
      { location: { contains: location, mode: 'insensitive' } },
    ];
  }
  if (city) where.city = { contains: city, mode: 'insensitive' };
  if (type) where.type = { equals: propertyTypeToPrisma(type), mode: 'insensitive' };
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.pricePerNight = {};
    if (minPrice !== undefined) where.pricePerNight = { ...where.pricePerNight as object, gte: minPrice };
    if (maxPrice !== undefined) where.pricePerNight = { ...where.pricePerNight as object, lte: maxPrice };
  }
  if (minGuests && !(checkIn && checkOut)) where.maxGuests = { gte: minGuests };
  if (rating) where.rating = { gte: rating };
  if (amenities && amenities.length > 0) where.amenities = { hasEvery: amenities };
  if (tag) where.tags = { has: tag };

  const orderBy: Prisma.PropertyOrderByWithRelationInput =
    sort === 'price_asc'
      ? { pricePerNight: 'asc' }
      : sort === 'price_desc'
      ? { pricePerNight: 'desc' }
      : sort === 'newest'
      ? { createdAt: 'desc' }
      : { rating: 'desc' };

  const include = {
    host: { select: { name: true, avatar: true } },
    roomTypes: { where: { status: 'available' } },
    reviews: { select: { rating: true } },
    _count: { select: { reviews: true } },
  } satisfies Prisma.PropertyInclude;

  const needsAvailabilityFilter = Boolean(checkIn && checkOut && minGuests);
  if (!needsAvailabilityFilter) {
    let [total, properties] = await prisma.$transaction([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include,
      }),
    ]);

    let uniqueProperties = dedupeProperties(properties.map(withComputedRating));

    const isPublicApprovedListing =
      !role &&
      !ownerId &&
      (!status || status === 'approved' || status === 'active') &&
      !tag &&
      uniqueProperties.length === 0;

    if (isPublicApprovedListing) {
      const fallbackWhere: Prisma.PropertyWhereInput = {
        ...activeWhere,
        tags: { hasSome: publicFallbackTags },
      };
      const fallbackProperties = await prisma.property.findMany({
        where: fallbackWhere,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include,
      });
      uniqueProperties = dedupeProperties(fallbackProperties.map(withComputedRating));
      total = await prisma.property.count({ where: fallbackWhere });
    }

    if (sort === 'rating') uniqueProperties.sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
    return { properties: uniqueProperties, total, page, limit, pages: Math.ceil(total / limit) };
  }

  const checkInDate = parseStayDate(checkIn!, 'checkIn');
  const checkOutDate = parseStayDate(checkOut!, 'checkOut');
  getNights(checkInDate, checkOutDate);

  const candidates = await prisma.property.findMany({
      where,
      orderBy,
      include,
  });

  const availability = await Promise.all(
    candidates.map(async (property) => {
      const roomChecks = await Promise.all(property.roomTypes.map(async (room) => {
      const roomsRequired = Math.ceil((minGuests ?? 1) / room.capacity);
        const { availableRooms } = await getAvailableRooms(room.id, checkInDate, checkOutDate);
        return roomsRequired <= availableRooms;
      }));
      return { property, available: roomChecks.some(Boolean) };
    })
  );

  const filtered = availability.filter((item) => item.available).map((item) => item.property);

  const computed = filtered.map(withComputedRating);
  if (sort === 'rating') computed.sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
  const paginated = computed.slice((page - 1) * limit, page * limit);
  const uniqueFiltered = dedupeProperties(paginated);
  return { properties: uniqueFiltered, total: computed.length, page, limit, pages: Math.ceil(computed.length / limit) };
};

const activeWhere: Prisma.PropertyWhereInput = {
  status: 'ACTIVE',
  verified: true,
};

const publicFallbackTags = [
  'Private Stays',
  'Corporate Getaways',
  'School Trips',
  'Pet Friendly',
  'Beach front',
  'Beach Front',
];

export const getPropertyLocations = async () => {
  const rows = await prisma.property.findMany({
    where: activeWhere,
    select: { location: true, city: true, state: true },
    orderBy: { location: 'asc' },
  });

  return Array.from(
    new Set(
      rows
        .flatMap((p) => [p.location, p.city, p.state])
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));
};

export const getPropertyTags = async () => {
  const rows = await prisma.property.findMany({
    where: activeWhere,
    select: { tags: true },
  });

  return Array.from(new Set(rows.flatMap((p) => p.tags))).sort((a, b) => a.localeCompare(b));
};

export const getExclusiveProperties = async (limit = 12) => {
  return prisma.property.findMany({
    where: { ...activeWhere, isExclusive: true },
    orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: { host: { select: { name: true, avatar: true, joinedAt: true } } },
  });
};

export const getPropertiesByTag = async (tag: string, limit = 12) => {
  return prisma.property.findMany({
    where: { ...activeWhere, tags: { has: tag } },
    orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: { host: { select: { name: true, avatar: true, joinedAt: true } } },
  });
};

export const getPropertyById = async (id: string) => {
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, name: true, avatar: true, joinedAt: true } },
      roomTypes: { where: { status: 'available' } },
      addOns: true,
      reviews: {
        orderBy: { date: 'desc' },
        take: 20,
      },
      seoMeta: true,
    },
  });
  if (!property) throw Object.assign(new Error('Property not found'), { statusCode: 404 });
  return property;
};

export const getPropertyReviews = async (
  id: string,
  page = 1,
  limit = 10
) => {
  const [total, reviews] = await prisma.$transaction([
    prisma.review.count({ where: { propertyId: id } }),
    prisma.review.findMany({
      where: { propertyId: id },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { reviews, total, page, limit };
};

export const getPropertyAvailability = async (
  id: string,
  checkIn: string,
  checkOut: string
) => {
  const rooms = await prisma.roomType.findMany({
    where: { propertyId: id, status: 'available' },
    select: { id: true, name: true },
  });
  const roomAvailability = await Promise.all(
    rooms.map(async (room) => ({
      room,
      calendar: await getCalendarAvailability(room.id, checkIn, checkOut),
    }))
  );

  return {
    available: roomAvailability.some(({ calendar }) => calendar.some((day) => day.available > 0)),
    rooms: roomAvailability,
  };
};

export const createProperty = async (hostId: string, data: Prisma.PropertyCreateInput) => {
  return prisma.property.create({
    data: { ...data, host: { connect: { id: hostId } } },
  });
};

export const createPropertyRecord = async (data: {
  id?: string;
  hostId: string;
  name: string;
  location: string;
  city?: string;
  state?: string;
  pricePerNight: number;
  description?: string;
  type?: string;
  images?: string[];
  tags?: string[];
  amenities?: string[];
  fullAddress?: string;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  status?: PublicPropertyStatus;
  verified?: boolean;
  superhost?: boolean;
  isExclusive?: boolean;
  housePolicies?: string[];
  dayPackage?: Prisma.InputJsonValue | Prisma.JsonObject;
  addOns?: Array<{ name: string; price: number; image?: string; description?: string }>;
  roomTypes?: Array<{
    id?: string;
    name: string;
    pricePerNight: number;
    capacity: number;
    totalRooms?: number;
    bedType?: string;
    size?: string;
    description?: string;
    photos?: string[];
    amenities?: string[];
  }>;
}) => {
  return prisma.property.create({
    data: {
      ...(data.id ? { id: data.id } : {}),
      hostId: data.hostId,
      name: data.name,
      location: data.location,
      city: data.city ?? data.location,
      state: data.state ?? '',
      country: 'India',
      pricePerNight: data.pricePerNight,
      description: data.description ?? '',
      type: propertyTypeToPrisma(data.type),
      images: data.images?.length ? data.images : [],
      tags: data.tags ?? [],
      amenities: data.amenities ?? [],
      fullAddress: data.fullAddress ?? '',
      bedrooms: data.bedrooms ?? 1,
      bathrooms: data.bathrooms ?? 1,
      maxGuests: data.roomTypes?.length
        ? Math.max(1, data.roomTypes.reduce((total, room) => total + (Number(room.capacity) || 1) * (Number(room.totalRooms) || 1), 0))
        : data.maxGuests ?? 2,
      status: data.status ? statusToPrisma[data.status] : 'PENDING',
      verified: data.verified ?? false,
      superhost: data.superhost ?? false,
      isExclusive: data.isExclusive ?? false,
      housePolicies: data.housePolicies ?? [],
      dayPackage: data.dayPackage ?? undefined,
      addOns: data.addOns?.length
        ? {
            create: data.addOns.map((addOn) => ({
              name: addOn.name,
              price: addOn.price,
              image: addOn.image,
              description: addOn.description,
            })),
          }
        : undefined,
      roomTypes: data.roomTypes?.length
        ? {
            create: data.roomTypes.map((room) => ({
              ...(room.id ? { id: room.id } : {}),
              name: room.name,
              totalRooms: room.totalRooms ?? 1,
              totalCount: room.totalRooms ?? 1,
              pricePerNight: room.pricePerNight,
              price: room.pricePerNight,
              capacity: room.capacity,
              bedType: room.bedType ?? 'King Bed',
              size: room.size,
              description: room.description,
              amenities: room.amenities ?? [],
              images: room.photos ?? [],
            })),
          }
        : undefined,
    },
    include: propertyEditorInclude,
  });
};

export const updatePropertyRecord = async (id: string, data: Record<string, unknown>) => {
  const {
    hostId: _hostId,
    host: _host,
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    bookings: _bookings,
    reviews: _reviews,
    staff: _staff,
    menuItems: _menuItems,
    inventory: _inventory,
    seoMeta: _seoMeta,
    roomTypes,
    addOns,
    ...updatable
  } = data;

  const allowedFields = [
    'name', 'location', 'fullAddress', 'city', 'state', 'country', 'latitude', 'longitude',
    'pricePerNight', 'originalPrice', 'description', 'images', 'tags', 'amenities',
    'bedrooms', 'bathrooms', 'maxGuests', 'verified', 'superhost', 'isExclusive',
    'scarcity', 'housePolicies', 'dayPackage', 'rating', 'reviewCount',
  ] as const;

  const payload: Prisma.PropertyUpdateInput = {};
  for (const key of allowedFields) {
    if (key in updatable && updatable[key] !== undefined) {
      (payload as Record<string, unknown>)[key] = updatable[key];
    }
  }

  if ('type' in data) {
    payload.type = propertyTypeToPrisma(data.type);
  }
  const status = typeof data.status === 'string' ? data.status.toLowerCase() : undefined;
  if (status && status in statusToPrisma) {
    payload.status = statusToPrisma[status as PublicPropertyStatus];
    payload.verified = status === 'approved' ? true : (data.verified as boolean | undefined) ?? undefined;
  }

  const exists = await prisma.property.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    throw Object.assign(new Error('Property not found'), { statusCode: 404 });
  }

  return prisma.$transaction(async (tx) => {
    let derivedMaxGuests: number | undefined;
    const property = await tx.property.update({
      where: { id },
      data: payload,
    });

    if (Array.isArray(roomTypes)) {
      derivedMaxGuests = Math.max(1, (roomTypes as any[]).reduce((total, room) => total + (Number(room.capacity) || 1) * (Number(room.totalRooms ?? room.totalCount ?? 1) || 1), 0));
      const existingRooms = await tx.roomType.findMany({ where: { propertyId: id }, select: { id: true } });
      const existingIds = new Set(existingRooms.map((room) => room.id));
      const incomingIds = new Set<string>();

      for (const room of roomTypes as any[]) {
        const roomPayload = {
          name: String(room.name || 'Room Type'),
          totalRooms: Number(room.totalRooms ?? room.totalCount ?? 1),
          totalCount: Number(room.totalRooms ?? room.totalCount ?? 1),
          pricePerNight: Number(room.pricePerNight ?? room.price ?? 0),
          price: Number(room.pricePerNight ?? room.price ?? 0),
          capacity: Number(room.capacity ?? 2),
          bedType: String(room.bedType || 'King Bed'),
          size: room.size ? String(room.size) : null,
          amenities: Array.isArray(room.amenities) ? room.amenities : [],
          images: Array.isArray(room.photos) ? room.photos : Array.isArray(room.images) ? room.images : [],
          description: room.description ? String(room.description) : null,
          status: 'available',
        };

        if (room.id && existingIds.has(String(room.id))) {
          incomingIds.add(String(room.id));
          await tx.roomType.update({ where: { id: String(room.id) }, data: roomPayload });
        } else {
          const created = await tx.roomType.create({
            data: {
              ...(room.id ? { id: String(room.id) } : {}),
              propertyId: id,
              ...roomPayload,
            },
            select: { id: true },
          });
          incomingIds.add(created.id);
        }
      }

      const missingIds = existingRooms.map((room) => room.id).filter((roomId) => !incomingIds.has(roomId));
      if (missingIds.length > 0) {
        await tx.roomType.deleteMany({ where: { id: { in: missingIds }, bookings: { none: {} } } });
        await tx.roomType.updateMany({ where: { id: { in: missingIds } }, data: { status: 'inactive' } });
      }
    }

    if (derivedMaxGuests !== undefined) {
      await tx.property.update({ where: { id }, data: { maxGuests: derivedMaxGuests } });
    }

    if (Array.isArray(addOns)) {
      await tx.addOn.deleteMany({ where: { propertyId: id } });
      if (addOns.length > 0) {
        await tx.addOn.createMany({
          data: addOns
            .filter((addOn: any) => addOn?.name)
            .map((addOn: any) => ({
              propertyId: id,
              name: String(addOn.name),
              price: Number(addOn.price ?? 0),
              image: addOn.image ? String(addOn.image) : null,
              description: addOn.description ? String(addOn.description) : null,
            })),
        });
      }
    }

    return tx.property.findUniqueOrThrow({
      where: { id: property.id },
      include: propertyEditorInclude,
    });
  });
};

export const approvePropertyRecord = async (id: string) => {
  return prisma.property.update({
    where: { id },
    data: { status: 'ACTIVE', verified: true },
  });
};

export const updateProperty = async (id: string, hostId: string, data: Prisma.PropertyUpdateInput) => {
  const property = await prisma.property.findFirst({ where: { id, hostId } });
  if (!property) throw Object.assign(new Error('Property not found'), { statusCode: 404 });
  return prisma.property.update({ where: { id }, data });
};

export const deleteProperty = async (id: string, hostId: string) => {
  const property = await prisma.property.findFirst({ where: { id, hostId } });
  if (!property) throw Object.assign(new Error('Property not found'), { statusCode: 404 });
  return prisma.property.update({
    where: { id },
    data: { status: PropertyStatus.INACTIVE },
  });
};

export const recalcPropertyRating = async (propertyId: string) => {
  const agg = await prisma.review.aggregate({
    where: { propertyId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      rating: agg._avg.rating ?? 0,
      reviewCount: agg._count.rating,
    },
  });
};
