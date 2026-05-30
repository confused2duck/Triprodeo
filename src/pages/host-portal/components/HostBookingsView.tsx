import { useEffect, useMemo, useState } from 'react';
import { HostBooking, HostProperty } from '@/pages/admin/types';
import { hostApiFetch } from '@/lib/apiClient';

interface Props {
  bookings: HostBooking[];
  properties: HostProperty[];
  hostId: string;
  onBookingCreated?: (booking: HostBooking) => void;
  canCreateBooking?: boolean;
}

type BookingForm = {
  propertyId: string;
  roomId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guests: number;
  checkIn: string;
  checkOut: string;
  paymentMethod: string;
  notes: string;
};

type AvailabilitySummary = {
  availableRooms?: number;
  totalRooms?: number;
  bookedRooms?: number;
  isAvailable?: boolean;
};

const defaultForm = (propertyId = '', roomId = ''): BookingForm => ({
  propertyId,
  roomId,
  guestName: '',
  guestEmail: '',
  guestPhone: '',
  guests: 2,
  checkIn: '',
  checkOut: '',
  paymentMethod: 'CASH',
  notes: '',
});

const getRoomTypes = (property?: HostProperty) => ((property as any)?.roomTypes ?? []) as Array<{
  id: string;
  name: string;
  capacity?: number;
}>;

const mapBooking = (booking: any): HostBooking => ({
  id: booking.id,
  propertyId: booking.propertyId,
  propertyName: booking.property?.name || booking.propertyName || 'Property',
  hostId: booking.hostId,
  guestName: booking.guestName,
  guestEmail: booking.guestEmail,
  guestPhone: booking.guestPhone,
  guestCount: booking.guestCount ?? booking.guests ?? 1,
  checkIn: typeof booking.checkIn === 'string' ? booking.checkIn : new Date(booking.checkIn).toISOString(),
  checkOut: typeof booking.checkOut === 'string' ? booking.checkOut : new Date(booking.checkOut).toISOString(),
  nights: booking.nights ?? 1,
  pricePerNight: booking.pricePerNight ?? 0,
  totalAmount: booking.totalAmount ?? booking.totalPrice ?? 0,
  platformFee: booking.platformFee ?? booking.serviceFee ?? 0,
  hostEarnings: booking.hostEarnings ?? 0,
  status: String(booking.status || 'pending').toLowerCase() as HostBooking['status'],
  bookedAt: booking.createdAt || new Date().toISOString(),
  paymentMethod: booking.paymentMethod || 'CASH',
});

export default function HostBookingsView({ bookings, properties, hostId, onBookingCreated, canCreateBooking = true }: Props) {
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'pending' | 'completed' | 'cancelled'>('all');
  const [selected, setSelected] = useState<HostBooking | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<BookingForm>(() => defaultForm(properties[0]?.id ?? '', getRoomTypes(properties[0])[0]?.id ?? ''));
  const [availability, setAvailability] = useState<AvailabilitySummary | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const sorted = [...filtered].sort((a, b) => new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime());

  const totalEarnings = bookings.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + b.hostEarnings, 0);
  const pendingEarnings = bookings.filter((b) => b.status === 'confirmed').reduce((s, b) => s + b.hostEarnings, 0);

  const statusColors: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
    completed: 'bg-stone-100 text-stone-600',
  };

  const tabs = ['all', 'confirmed', 'pending', 'completed', 'cancelled'] as const;

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === form.propertyId) ?? properties[0],
    [form.propertyId, properties]
  );
  const roomTypes = getRoomTypes(selectedProperty);
  const selectedRoom = useMemo(
    () => roomTypes.find((room) => room.id === form.roomId) ?? roomTypes[0],
    [form.roomId, roomTypes]
  );
  const roomCapacity = selectedRoom?.capacity ?? selectedProperty?.maxGuests ?? 1;
  const roomsRequired = Math.max(1, Math.ceil(Math.max(1, form.guests) / Math.max(1, roomCapacity)));
  const datesValid = !!form.checkIn && !!form.checkOut && new Date(form.checkOut) > new Date(form.checkIn);
  const availableRooms = availability?.availableRooms ?? null;
  const inventoryOk = availableRooms !== null && availableRooms >= roomsRequired;
  const canSubmit = !!selectedProperty && datesValid && inventoryOk && !loadingAvailability && !submitting;

  useEffect(() => {
    const firstProperty = properties[0];
    if (!form.propertyId && firstProperty) {
      setForm(defaultForm(firstProperty.id, getRoomTypes(firstProperty)[0]?.id ?? ''));
    }
  }, [form.propertyId, properties]);

  useEffect(() => {
    const propertyId = form.propertyId;
    if (!propertyId || !datesValid) {
      setAvailability(null);
      return;
    }

    let cancelled = false;
    setLoadingAvailability(true);
    const query = new URLSearchParams({
      propertyId,
      startDate: form.checkIn,
      endDate: form.checkOut,
    });
    if (form.roomId) query.set('roomId', form.roomId);

    hostApiFetch<AvailabilitySummary>(`/inventory/availability?${query.toString()}`)
      .then((summary) => {
        if (!cancelled) setAvailability(summary);
      })
      .catch(() => {
        if (!cancelled) setAvailability(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingAvailability(false);
      });

    return () => {
      cancelled = true;
    };
  }, [datesValid, form.checkIn, form.checkOut, form.propertyId, form.roomId, hostId]);

  const handleCreateBooking = async () => {
    if (!selectedProperty || !datesValid || !inventoryOk) return;
    setSubmitting(true);
    setError('');

    try {
      const result = await hostApiFetch<any>('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: form.propertyId,
          roomId: form.roomId || undefined,
          guestName: form.guestName.trim(),
          guestEmail: form.guestEmail.trim(),
          guestPhone: form.guestPhone.trim(),
          guests: form.guests,
          roomsRequired,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          source: 'WALKIN',
          paymentMethod: form.paymentMethod,
          notes: form.notes.trim(),
        }),
      });

      const created = mapBooking(result);
      onBookingCreated?.(created);
      setDrawerOpen(false);
      setForm(defaultForm(properties[0]?.id ?? '', getRoomTypes(properties[0])[0]?.id ?? ''));
      setAvailability(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Bookings & Earnings</h2>
          <p className="text-stone-500 text-sm mt-1">Track guest reservations, earnings, and offline walk-ins</p>
        </div>
        {canCreateBooking && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 transition-colors"
          >
            <i className="ri-add-line" />
            Add Booking
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">Total Earnings</p>
          <p className="text-2xl font-bold text-amber-700">₹{totalEarnings.toLocaleString('en-IN')}</p>
          <p className="text-xs text-amber-500 mt-0.5">After 10% platform fee</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-1">Upcoming Payouts</p>
          <p className="text-2xl font-bold text-emerald-700">₹{pendingEarnings.toLocaleString('en-IN')}</p>
          <p className="text-xs text-emerald-500 mt-0.5">From confirmed bookings</p>
        </div>
        <div className="bg-stone-100 rounded-xl p-4">
          <p className="text-xs text-stone-500 font-semibold uppercase tracking-wide mb-1">Total Bookings</p>
          <p className="text-2xl font-bold text-stone-800">{bookings.length}</p>
          <p className="text-xs text-stone-400 mt-0.5">{bookings.filter((b) => b.status === 'confirmed').length} confirmed</p>
        </div>
      </div>

      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-5 w-fit flex-wrap">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap capitalize ${filter === t ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            {t} {t !== 'all' && <span className="ml-1 opacity-60">({bookings.filter((b) => b.status === t).length})</span>}
          </button>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
          <i className="ri-calendar-line text-4xl text-stone-300 mb-3 block" />
          <p className="text-stone-400">No bookings found</p>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((booking) => (
          <div
            key={booking.id}
            className="bg-white rounded-xl border border-stone-200 p-4 cursor-pointer hover:border-stone-300 transition-colors"
            onClick={() => setSelected(selected?.id === booking.id ? null : booking)}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-stone-100 rounded-xl shrink-0">
                <i className="ri-user-line text-stone-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-stone-900 text-sm">{booking.guestName}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[booking.status]}`}>{booking.status}</span>
                </div>
                <p className="text-stone-500 text-xs mt-0.5">{booking.propertyName}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-stone-400 flex-wrap">
                  <span><i className="ri-calendar-line mr-1" />{booking.checkIn} → {booking.checkOut}</span>
                  <span><i className="ri-moon-line mr-1" />{booking.nights} nights</span>
                  <span><i className="ri-group-line mr-1" />{booking.guestCount} guests</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold text-amber-600">₹{booking.hostEarnings.toLocaleString('en-IN')}</p>
                <p className="text-xs text-stone-400">your earnings</p>
                <p className="text-xs text-stone-300 mt-0.5">Total: ₹{booking.totalAmount.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {selected?.id === booking.id && (
              <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Guest Email</p>
                  <p className="text-stone-700 font-medium truncate">{booking.guestEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Phone</p>
                  <p className="text-stone-700 font-medium">{booking.guestPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Payment</p>
                  <p className="text-stone-700 font-medium">{booking.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Booked On</p>
                  <p className="text-stone-700 font-medium">{new Date(booking.bookedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Room Rate</p>
                  <p className="text-stone-700 font-medium">₹{booking.pricePerNight.toLocaleString('en-IN')}/night</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Total Charged</p>
                  <p className="text-stone-700 font-medium">₹{booking.totalAmount.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Platform Fee (10%)</p>
                  <p className="text-red-500 font-medium">-₹{booking.platformFee.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Your Earnings</p>
                  <p className="text-emerald-600 font-bold">₹{booking.hostEarnings.toLocaleString('en-IN')}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {drawerOpen && canCreateBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
          <div className="w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Add Booking</h3>
                <p className="text-sm text-stone-500">Create an offline or walk-in booking with live inventory checks</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="w-9 h-9 rounded-lg bg-stone-100 text-stone-600">
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-stone-700 mb-1.5">Property</span>
                  <select
                    value={form.propertyId}
                    onChange={(e) => setForm((curr) => defaultForm(e.target.value, getRoomTypes(properties.find((p) => p.id === e.target.value))[0]?.id ?? ''))}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-400"
                  >
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>{property.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-stone-700 mb-1.5">Room Type</span>
                  <select
                    value={form.roomId}
                    onChange={(e) => setForm((curr) => ({ ...curr, roomId: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-400"
                  >
                    <option value="">Auto-select</option>
                    {roomTypes.map((room) => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-stone-700 mb-1.5">Guest Name</span>
                  <input value={form.guestName} onChange={(e) => setForm((curr) => ({ ...curr, guestName: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-stone-200" />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-stone-700 mb-1.5">Guest Email</span>
                  <input type="email" value={form.guestEmail} onChange={(e) => setForm((curr) => ({ ...curr, guestEmail: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-stone-200" />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-stone-700 mb-1.5">Guest Phone</span>
                  <input value={form.guestPhone} onChange={(e) => setForm((curr) => ({ ...curr, guestPhone: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-stone-200" />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-stone-700 mb-1.5">Guests</span>
                  <input type="number" min={1} value={form.guests} onChange={(e) => setForm((curr) => ({ ...curr, guests: Number(e.target.value) || 1 }))} className="w-full px-4 py-3 rounded-xl border border-stone-200" />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-stone-700 mb-1.5">Check-in</span>
                  <input type="date" value={form.checkIn} onChange={(e) => setForm((curr) => ({ ...curr, checkIn: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-stone-200" />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-stone-700 mb-1.5">Check-out</span>
                  <input type="date" value={form.checkOut} onChange={(e) => setForm((curr) => ({ ...curr, checkOut: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-stone-200" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-stone-700 mb-1.5">Payment Method</span>
                  <select value={form.paymentMethod} onChange={(e) => setForm((curr) => ({ ...curr, paymentMethod: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-stone-200">
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="NETBANKING">Netbanking</option>
                    <option value="WALLET">Wallet</option>
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="block text-sm font-medium text-stone-700 mb-1.5">Notes</span>
                  <textarea value={form.notes} onChange={(e) => setForm((curr) => ({ ...curr, notes: e.target.value }))} rows={3} className="w-full px-4 py-3 rounded-xl border border-stone-200" />
                </label>
              </div>

              <div className={`rounded-xl px-4 py-3 text-sm ${loadingAvailability ? 'bg-amber-50 text-amber-700' : availability === null ? 'bg-stone-50 text-stone-600' : inventoryOk ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {loadingAvailability
                  ? 'Checking inventory...'
                  : !datesValid
                    ? 'Choose check-in and check-out dates.'
                    : availability === null
                      ? 'Unable to verify inventory.'
                      : availableRooms === 0
                        ? 'SOLD OUT'
                        : inventoryOk
                          ? `Only ${availableRooms} room${availableRooms === 1 ? '' : 's'} left.`
                          : `Only ${availableRooms} room${availableRooms === 1 ? '' : 's'} left for these dates.`}
              </div>

              {error && <div className="rounded-xl border border-red-100 bg-red-50 text-red-600 px-4 py-3 text-sm">{error}</div>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setDrawerOpen(false)} className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-sm font-semibold">Cancel</button>
                <button
                  onClick={handleCreateBooking}
                  disabled={!canSubmit}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
