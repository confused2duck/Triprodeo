import { getProperties as fetchPropertiesRaw, getPropertyById } from '@/services/api';
import { apiFetch } from '@/lib/apiClient';
import { Property, PropertyListResponse } from '@/types/property';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop';

interface ApiProperty {
  id: string;
  name: string;
  location: string;
  status?: string;
  hostId?: string;
  fullAddress?: string;
  city?: string;
  state?: string;
  pricePerNight: number;
  originalPrice?: number | null;
  rating?: number;
  reviewCount?: number;
  images?: string[];
  tags?: string[];
  amenities?: string[];
  type?: string;
  verified?: boolean;
  superhost?: boolean;
  isExclusive?: boolean;
  scarcity?: string | null;
  dayPackage?: {
    enabled?: boolean;
    pricePerPerson?: number;
    activities?: string[];
    meals?: string[];
    facilities?: string[];
    description?: string;
    timing?: string;
    image?: string;
    packages?: Array<{
      id: string;
      title: string;
      description?: string;
      timing?: string;
      pricePerPerson?: number;
      maxGuests?: number;
      meals?: string[];
      activities?: string[];
      facilities?: string[];
      image?: string;
    }>;
  } | null;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  host?: {
    name?: string;
    avatar?: string | null;
    joinedAt?: string;
    superhost?: boolean;
  };
  addOns?: Array<{ id: string; name: string; price: number; image?: string | null; description?: string | null }>;
  reviews?: Array<{
    id: string;
    guestName?: string;
    guestAvatar?: string | null;
    guestLocation?: string | null;
    date?: string;
    rating: number;
    comment?: string;
  }>;
  roomTypes?: Array<{
    id: string;
    name: string;
    pricePerNight: number;
    capacity: number;
    totalRooms?: number;
    bedType?: string;
    size?: string | null;
    description?: string | null;
    photos?: string[];
    images?: string[];
    amenities?: string[];
  }>;
  housePolicies?: string[];
}

interface ApiListResponse {
  properties: ApiProperty[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const PUBLIC_PROPERTY_FALLBACK_TAGS = [
  'Private Stays',
  'Corporate Getaways',
  'School Trips',
  'Pet Friendly',
  'Beach front',
  'Beach Front',
];

export interface PropertyQuery {
  location?: string;
  type?: string;
  status?: string;
  rating?: number;
  minPrice?: number;
  maxPrice?: number;
  minGuests?: number;
  checkIn?: string;
  checkOut?: string;
  amenities?: string[];
  tag?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export function normalizeProperty(p: ApiProperty): Property {
  const dayPackage = p.dayPackage && typeof p.dayPackage === 'object' ? p.dayPackage : undefined;
  return {
    id: p.id,
    name: p.name,
    location: p.location,
    fullAddress: p.fullAddress,
    city: p.city ?? p.location,
    state: p.state ?? '',
    distanceKm: 10,
    pricePerNight: p.pricePerNight,
    originalPrice: p.originalPrice ?? undefined,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    images: p.images?.length ? p.images : [FALLBACK_IMAGE],
    tags: p.tags ?? [],
    amenities: p.amenities ?? [],
    type: (p.type ?? 'villa').toLowerCase(),
    status: p.status?.toLowerCase() as Property['status'],
    hostId: p.hostId,
    verified: p.verified ?? false,
    superhost: p.superhost ?? false,
    isExclusive: p.isExclusive ?? false,
    scarcity: p.scarcity ?? undefined,
    hasDayPackage: dayPackage?.enabled === true,
    dayPackagePrice: dayPackage?.pricePerPerson,
    description: p.description ?? '',
    bedrooms: p.bedrooms ?? 1,
    bathrooms: p.bathrooms ?? 1,
    maxGuests: p.maxGuests ?? 2,
    categoryRatings: {
      cleanliness: p.rating ?? 4.5,
      communication: p.rating ?? 4.5,
      checkIn: p.rating ?? 4.5,
      accuracy: p.rating ?? 4.5,
      location: p.rating ?? 4.5,
      value: p.rating ?? 4.5,
    },
    host: {
      name: p.host?.name ?? 'Triprodeo Host',
      avatar: p.host?.avatar ?? '',
      joinedYear: p.host?.joinedAt ? new Date(p.host.joinedAt).getFullYear() : 2024,
      superhost: p.superhost ?? false,
    },
    addOns: (p.addOns ?? []).map((addOn) => ({
      id: addOn.id,
      name: addOn.name,
      price: addOn.price,
      image: addOn.image ?? '',
      description: addOn.description ?? '',
    })),
    reviews: (p.reviews ?? []).map((review) => ({
      id: review.id,
      user: review.guestName ?? 'Guest',
      avatar: review.guestAvatar ?? '',
      location: review.guestLocation ?? '',
      date: review.date ? new Date(review.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '',
      rating: review.rating,
      text: review.comment ?? '',
    })),
    dayPackage: p.dayPackage
      ? {
          enabled: p.dayPackage.enabled,
          description: p.dayPackage.description,
          timing: p.dayPackage.timing,
          pricePerPerson: p.dayPackage.pricePerPerson,
          meals: p.dayPackage.meals,
          activities: p.dayPackage.activities,
          facilities: p.dayPackage.facilities,
          image: p.dayPackage.image,
          packages: p.dayPackage.packages,
        }
      : undefined,
    roomTypes: p.roomTypes?.map((room) => ({
      id: room.id,
      name: room.name,
      pricePerNight: room.pricePerNight,
      capacity: room.capacity,
      totalRooms: room.totalRooms,
      bedType: room.bedType,
      size: room.size ?? undefined,
      description: room.description ?? undefined,
      photos: room.photos ?? room.images ?? [],
      amenities: room.amenities,
    })),
    housePolicies: p.housePolicies ?? [],
  };
}

function normalizeList(data: ApiListResponse): PropertyListResponse {
  return {
    ...data,
    properties: data.properties.map(normalizeProperty),
  };
}

const dedupeApiProperties = (properties: ApiProperty[]) =>
  Array.from(new Map(properties.map((property) => [property.id, property])).values());

const matchesText = (value: string | undefined, target: string) =>
  Boolean(value?.toLowerCase().includes(target.toLowerCase()));

const applyFallbackFilters = (properties: Property[], params: PropertyQuery) => {
  let list = [...properties];

  if (params.location) {
    const target = params.location.toLowerCase();
    list = list.filter((p) =>
      matchesText(p.name, target) ||
      matchesText(p.location, target) ||
      matchesText(p.city, target) ||
      matchesText(p.state, target)
    );
  }

  if (params.tag) {
    const target = params.tag.trim().toLowerCase();
    list = list.filter((p) => p.tags.some((tag) => tag.trim().toLowerCase() === target));
  }

  if (params.minPrice !== undefined) list = list.filter((p) => p.pricePerNight >= Number(params.minPrice));
  if (params.maxPrice !== undefined) list = list.filter((p) => p.pricePerNight <= Number(params.maxPrice));
  if (params.minGuests !== undefined) list = list.filter((p) => p.maxGuests >= Number(params.minGuests));
  if (params.rating !== undefined) list = list.filter((p) => p.rating >= Number(params.rating));
  if (params.amenities?.length) {
    list = list.filter((p) => params.amenities!.every((amenity) => p.amenities.some((a) => a.toLowerCase().includes(amenity.toLowerCase()))));
  }

  if (params.sort === 'price_asc') list.sort((a, b) => a.pricePerNight - b.pricePerNight);
  else if (params.sort === 'price_desc') list.sort((a, b) => b.pricePerNight - a.pricePerNight);
  else list.sort((a, b) => b.rating - a.rating);

  return list;
};

async function fetchPublicFallbackProperties(params: PropertyQuery): Promise<PropertyListResponse | null> {
  const tags = params.tag ? [params.tag] : PUBLIC_PROPERTY_FALLBACK_TAGS;
  const perTagLimit = Math.max(params.limit ?? 100, 100);
  const results = await Promise.allSettled(
    tags.map((tag) => apiFetch<ApiProperty[]>(`/properties/tag/${encodeURIComponent(tag)}?limit=${perTagLimit}`))
  );

  const apiProperties = dedupeApiProperties(
    results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  );

  if (apiProperties.length === 0) return null;

  const filtered = applyFallbackFilters(apiProperties.map(normalizeProperty), params);
  const page = params.page ?? 1;
  const limit = params.limit ?? filtered.length;
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  return {
    properties: paginated,
    total: filtered.length,
    page,
    limit,
    pages: Math.ceil(filtered.length / limit),
  };
}

export async function fetchProperties(params: PropertyQuery = {}): Promise<PropertyListResponse> {
  const data = (await fetchPropertiesRaw(params as Record<string, string | number | undefined>)) as ApiListResponse;
  const normalized = normalizeList(data);
  const canUsePublicFallback = !params.status || params.status === 'approved' || params.status === 'active';

  if (normalized.properties.length === 0 && canUsePublicFallback) {
    const fallback = await fetchPublicFallbackProperties(params);
    if (fallback) return fallback;
  }

  return normalized;
}

export async function fetchPropertyLocations(): Promise<string[]> {
  return apiFetch<string[]>('/properties/locations').catch(async () => {
    const data = (await fetchPropertiesRaw({ status: 'approved', limit: 500 })) as ApiListResponse;
    const props = normalizeList(data).properties;
    return Array.from(new Set(props.flatMap((p) => [p.location, p.city, p.state]).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }) as Promise<string[]>;
}

export async function fetchExclusiveProperties(limit = 8): Promise<Property[]> {
  try {
    const data = (await apiFetch<ApiProperty[]>(`/properties/exclusive?limit=${limit}`));
    return data.map(normalizeProperty);
  } catch {
    const data = (await fetchPropertiesRaw({ status: 'approved', limit: 100 })) as ApiListResponse;
    return normalizeList(data).properties.filter((p) => p.isExclusive).slice(0, limit);
  }
}

export async function fetchPropertiesByTag(tag: string, limit = 8): Promise<Property[]> {
  try {
    const data = (await apiFetch<ApiProperty[]>(`/properties/tag/${encodeURIComponent(tag)}?limit=${limit}`));
    return data.map(normalizeProperty);
  } catch {
    const data = (await fetchPropertiesRaw({ status: 'approved', tag, limit })) as ApiListResponse;
    return normalizeList(data).properties.filter((p) => p.tags.includes(tag)).slice(0, limit);
  }
}

export async function fetchPropertyTags(): Promise<string[]> {
  return apiFetch<string[]>('/properties/tags').catch(async () => {
    const data = (await fetchPropertiesRaw({ status: 'approved', limit: 500 })) as ApiListResponse;
    return Array.from(new Set(normalizeList(data).properties.flatMap((p) => p.tags))).sort((a, b) => a.localeCompare(b));
  }) as Promise<string[]>;
}

export async function fetchPropertyById(id: string): Promise<Property> {
  const data = await getPropertyById(id);
  return normalizeProperty(data as ApiProperty);
}
