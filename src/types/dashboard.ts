export interface DayOutingEnquiry {
  id: string;
  enquiryId: string;
  propertyId: string;
  propertyName: string;
  location: string;
  image: string;
  date: string;
  timeSlot: string;
  guests: number;
  pricePerPerson: number;
  totalEstimate: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  occasion?: string;
  submittedAt: string;
  hostName?: string;
  hostPhone?: string;
  notes?: string;
}

export interface Booking {
  id: string;
  bookingId: string;
  type: 'stay' | 'experience' | 'bundle';
  status: 'confirmed' | 'completed' | 'cancelled' | 'upcoming';
  title: string;
  location: string;
  image: string;
  checkIn?: string;
  checkOut?: string;
  date?: string;
  time?: string;
  guests: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue?: number;
  isPartialPayment: boolean;
  hostName: string;
  hostAvatar: string;
  hostPhone?: string;
  canCancel: boolean;
  cancellationDeadline?: string;
  reviewSubmitted?: boolean;
  amenities?: string[];
  addOns?: string[];
  itinerary?: string[];
}

export interface SavedTrip {
  id: string;
  title: string;
  location: string;
  image: string;
  type: 'property' | 'experience' | 'bundle';
  price: number;
  rating: number;
  savedDate: string;
  dates?: string;
  guests?: number;
  notes?: string;
}
