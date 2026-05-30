import { apiFetch, authHeader, hostApiFetch, hostAuthHeader, setUserSession, userApiFetch } from '@/lib/apiClient';
import type { Booking, DayOutingEnquiry, SavedTrip } from '@/types/dashboard';

export interface PropertyApiPayload {
  id?: string;
  hostId?: string;
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
  verified?: boolean;
  superhost?: boolean;
  isExclusive?: boolean;
  status?: 'approved' | 'pending' | 'rejected' | 'inactive' | 'active';
  housePolicies?: string[];
  dayPackage?: unknown;
  addOns?: unknown[];
  roomTypes?: unknown[];
}

export interface StaffApiPayload {
  propertyId: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  shift?: string;
  salary?: number;
  notes?: string;
  loginEmail?: string;
  loginPassword?: string;
  hasPortalAccess?: boolean;
  permissions?: string[];
}

export interface HostSummaryApi {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  package?: string;
  status?: string;
  joinedAt?: string;
}

export interface UserDashboardProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string | null;
  joinedDate: string;
  isVerified: boolean;
  isSuperGuest: boolean;
  totalTrips: number;
  totalNights: number;
}

export interface UserDashboardData {
  profile: UserDashboardProfile;
  bookings: Booking[];
  dayOutingEnquiries: DayOutingEnquiry[];
  savedTrips: SavedTrip[];
  wallet: { balance: number; pendingCashback: number; totalEarned: number };
  walletTransactions: Array<{ id: string; type: string; amount: number; description: string; date: string; status: string }>;
  loyaltyPoints: {
    current: number;
    tier: string;
    nextTier: string;
    tierProgress: number;
    pointsToNextTier: number;
    expiringSoon: number;
    expiryDate: string;
  };
  loyaltyTiers: Array<{ name: string; minPoints: number; color: string; benefits: string[] }>;
  referralStats: { code: string; totalInvited: number; successfulReferrals: number; totalEarned: number };
}

export async function getProperties(params: Record<string, string | number | undefined> = {}, withAuth = false) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return apiFetch(`/properties${query ? `?${query}` : ''}`, withAuth ? { headers: authHeader() } : undefined);
}

export async function getOwnerProperties(ownerId: string) {
  return hostApiFetch(`/properties?ownerId=${encodeURIComponent(ownerId)}`, { headers: hostAuthHeader() });
}

export async function getPropertyById(id: string) {
  return apiFetch(`/properties/${encodeURIComponent(id)}`);
}

export async function createProperty(payload: PropertyApiPayload) {
  return apiFetch('/properties', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(payload),
  });
}

export async function updateProperty(id: string, payload: Partial<PropertyApiPayload>) {
  return apiFetch(`/properties/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify(payload),
  });
}

export async function approveProperty(id: string) {
  return apiFetch(`/properties/${encodeURIComponent(id)}/approve`, {
    method: 'PATCH',
    headers: authHeader(),
  });
}

export async function getStaff(propertyId?: string) {
  const qs = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : '';
  return hostApiFetch(`/staff${qs}`, { headers: hostAuthHeader() });
}

export async function getHostBookings(page = 1, limit = 20, status?: string) {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(page));
  searchParams.set('limit', String(limit));
  if (status) searchParams.set('status', status);
  return hostApiFetch(`/bookings/host/list?${searchParams.toString()}`, { headers: hostAuthHeader() });
}

export async function createRazorpayBookingOrder(payload: {
  propertyId: string;
  roomId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guests: number;
  roomsRequired: number;
  checkIn: string;
  checkOut: string;
  notes?: string;
  addOnIds?: string[];
  promoCode?: string;
  paymentPercent?: number;
}) {
  return userApiFetch<{
    keyId: string;
    booking: { id: string; totalAmount: number };
    order: { id: string; amount: number; currency: string; receipt?: string };
  }>('/bookings/razorpay/order', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyRazorpayBookingPayment(payload: {
  bookingId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  return userApiFetch<{ id: string }>('/bookings/razorpay/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createStaff(payload: StaffApiPayload) {
  return hostApiFetch('/staff', {
    method: 'POST',
    headers: hostAuthHeader(),
    body: JSON.stringify(payload),
  });
}

export async function updateStaff(id: string, payload: Partial<StaffApiPayload>) {
  return hostApiFetch(`/staff/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: hostAuthHeader(),
    body: JSON.stringify(payload),
  });
}

export async function deleteStaff(id: string) {
  return hostApiFetch(`/staff/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: hostAuthHeader(),
  });
}

export async function getHosts() {
  return apiFetch<{ hosts: HostSummaryApi[]; total: number; page: number; limit: number }>('/cms/hosts', {
    headers: authHeader(),
  });
}

export async function createHost(payload: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatar?: string;
  package?: 'basic' | 'standard' | 'premium';
  status?: 'active' | 'suspended';
}) {
  return apiFetch('/cms/hosts', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(payload),
  });
}

export async function updateHostAccount(id: string, payload: {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  avatar?: string;
  package?: 'basic' | 'standard' | 'premium';
  status?: 'active' | 'suspended';
}) {
  return apiFetch(`/cms/hosts/${encodeURIComponent(id)}/account`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify(payload),
  });
}

export async function updateHostProfile(id: string, payload: { name?: string; phone?: string; avatar?: string }) {
  return apiFetch(`/cms/hosts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify(payload),
  });
}

export async function updateHostStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
  return apiFetch(`/cms/hosts/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify({ status }),
  });
}

export async function deleteHost(id: string) {
  return apiFetch(`/cms/hosts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeader(),
  });
}

export async function loginUser(payload: { email: string; password: string }) {
  const result = await apiFetch<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; name: string; avatar?: string | null };
  }>('/auth/user/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setUserSession({
    ...result.user,
    token: result.accessToken,
    refreshToken: result.refreshToken,
  });
  return result;
}

export async function getUserDashboard() {
  return userApiFetch<UserDashboardData>('/dashboard/me');
}

export async function signupUser(payload: { name: string; email: string; password: string; phone?: string }) {
  const result = await apiFetch<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; name: string; avatar?: string | null };
  }>('/auth/user/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setUserSession({
    ...result.user,
    token: result.accessToken,
    refreshToken: result.refreshToken,
  });
  return result;
}

export function logoutUser() {
  setUserSession(null);
}
