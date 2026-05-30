export interface Property {
  id: string;
  name: string;
  location: string;
  status?: 'approved' | 'pending' | 'rejected' | 'inactive' | 'active';
  hostId?: string;
  fullAddress?: string;
  city: string;
  state: string;
  distanceKm: number;
  pricePerNight: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  images: string[];
  tags: string[];
  amenities: string[];
  type: 'villa' | 'resort' | 'boutique' | 'treehouse' | 'beachfront' | string;
  verified: boolean;
  superhost: boolean;
  isExclusive?: boolean;
  scarcity?: string;
  hasDayPackage?: boolean;
  dayPackagePrice?: number;
  description: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  categoryRatings: {
    cleanliness: number;
    communication: number;
    checkIn: number;
    accuracy: number;
    location: number;
    value: number;
  };
  host: {
    name: string;
    avatar: string;
    joinedYear: number;
    superhost: boolean;
  };
  addOns: {
    id: string;
    name: string;
    price: number;
    image: string;
    description: string;
  }[];
  dayPackage?: {
    enabled?: boolean;
    description?: string;
    timing?: string;
    pricePerPerson?: number;
    maxGuests?: number;
    meals?: string[];
    activities?: string[];
    facilities?: string[];
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
  };
  roomTypes?: Array<{
    id: string;
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
  housePolicies?: string[];
  reviews?: Array<{
    id: string;
    user: string;
    avatar: string;
    location: string;
    date: string;
    rating: number;
    text: string;
    photos?: string[];
  }>;
}

export interface PropertyListResponse {
  properties: Property[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
