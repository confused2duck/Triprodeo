import prisma from '../config/database';

const money = (value: number | null | undefined) => Number(value ?? 0);

const formatLocation = (property: { location: string; city: string; state: string }) => {
  const parts = [property.location, property.city, property.state].filter(Boolean);
  return Array.from(new Set(parts)).join(', ');
};

const bookingStatusForDashboard = (status: string) => {
  switch (status) {
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'cancelled';
    case 'COMPLETED':
      return 'completed';
    case 'CONFIRMED':
    case 'PENDING':
    default:
      return 'upcoming';
  }
};

const cancellationDeadline = (checkIn: Date) => {
  const deadline = new Date(checkIn);
  deadline.setDate(deadline.getDate() - 2);
  return deadline.toISOString();
};

export const getUserDashboard = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const [bookings, dayOutingEnquiries] = await prisma.$transaction([
    prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        review: { select: { id: true } },
        room: { select: { name: true, amenities: true, images: true } },
        property: {
          select: {
            id: true,
            name: true,
            location: true,
            city: true,
            state: true,
            images: true,
            amenities: true,
          },
        },
        host: { select: { name: true, avatar: true, phone: true } },
      },
    }),
    prisma.dayOutingEnquiry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            location: true,
            city: true,
            state: true,
            images: true,
            host: { select: { name: true, phone: true } },
          },
        },
      },
    }),
  ]);

  const completedBookings = bookings.filter((booking) => booking.status === 'COMPLETED');
  const completedSpend = completedBookings.reduce((sum, booking) => sum + money(booking.totalAmount), 0);
  const loyaltyPoints = Math.floor(completedSpend / 100);
  const tier =
    loyaltyPoints >= 5000 ? 'Gold' :
    loyaltyPoints >= 1500 ? 'Silver' :
    'Member';
  const nextTier = tier === 'Gold' ? 'Gold' : tier === 'Silver' ? 'Gold' : 'Silver';
  const nextTierPoints = nextTier === 'Gold' ? 5000 : 1500;
  const pointsToNextTier = Math.max(0, nextTierPoints - loyaltyPoints);
  const tierBase = tier === 'Gold' ? 5000 : tier === 'Silver' ? 1500 : 0;
  const tierProgress = nextTier === tier
    ? 100
    : Math.min(100, Math.round(((loyaltyPoints - tierBase) / Math.max(1, nextTierPoints - tierBase)) * 100));

  const totalNights = bookings.reduce((sum, booking) => sum + Number(booking.nights ?? 0), 0);
  const confirmedOrPending = dayOutingEnquiries.filter((enquiry) =>
    enquiry.status === 'pending' || enquiry.status === 'confirmed'
  ).length;

  return {
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      avatar: user.avatar ?? '',
      joinedDate: user.createdAt.toISOString(),
      isVerified: true,
      isSuperGuest: tier === 'Gold',
      totalTrips: bookings.length + dayOutingEnquiries.length,
      totalNights,
    },
    bookings: bookings.map((booking) => ({
      id: booking.id,
      bookingId: booking.id.slice(0, 8).toUpperCase(),
      type: 'stay',
      status: bookingStatusForDashboard(booking.status),
      title: booking.property.name,
      location: formatLocation(booking.property),
      image: booking.property.images[0] ?? booking.room?.images[0] ?? '',
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      guests: booking.guests,
      totalAmount: money(booking.totalAmount),
      paidAmount: booking.status === 'PENDING' ? 0 : money(booking.totalAmount),
      balanceDue: booking.status === 'PENDING' ? money(booking.totalAmount) : 0,
      isPartialPayment: booking.status === 'PENDING',
      hostName: booking.host.name,
      hostAvatar: booking.host.avatar ?? '',
      hostPhone: booking.host.phone ?? '',
      canCancel: booking.status === 'PENDING' || booking.status === 'CONFIRMED',
      cancellationDeadline: cancellationDeadline(booking.checkIn),
      reviewSubmitted: Boolean(booking.review),
      amenities: booking.room?.amenities.length ? booking.room.amenities : booking.property.amenities,
      addOns: [],
      itinerary: [],
    })),
    dayOutingEnquiries: dayOutingEnquiries.map((enquiry) => ({
      id: enquiry.id,
      enquiryId: enquiry.id.slice(0, 8).toUpperCase(),
      propertyId: enquiry.propertyId,
      propertyName: enquiry.property.name,
      location: formatLocation(enquiry.property),
      image: enquiry.property.images[0] ?? '',
      date: enquiry.date.toISOString().slice(0, 10),
      timeSlot: enquiry.timeSlot,
      packageTitle: enquiry.packageTitle ?? '',
      guests: enquiry.guests,
      pricePerPerson: money(enquiry.pricePerPerson),
      totalEstimate: money(enquiry.estimatedTotal),
      status: enquiry.status,
      occasion: enquiry.occasion ?? '',
      submittedAt: enquiry.createdAt.toISOString(),
      hostName: enquiry.property.host.name,
      hostPhone: enquiry.property.host.phone ?? '',
      notes: enquiry.specialRequests ?? '',
    })),
    savedTrips: [],
    wallet: {
      balance: 0,
      pendingCashback: confirmedOrPending * 100,
      totalEarned: 0,
    },
    walletTransactions: [],
    loyaltyPoints: {
      current: loyaltyPoints,
      tier,
      nextTier,
      tierProgress,
      pointsToNextTier,
      expiringSoon: 0,
      expiryDate: '',
    },
    loyaltyTiers: [
      { name: 'Member', minPoints: 0, color: 'bg-stone-300', benefits: ['Member pricing alerts', 'Saved trip planning'] },
      { name: 'Silver', minPoints: 1500, color: 'bg-stone-400', benefits: ['Priority support', 'Early access to offers'] },
      { name: 'Gold', minPoints: 5000, color: 'bg-amber-400', benefits: ['Premium support', 'Exclusive stay perks'] },
    ],
    referralStats: {
      code: `TRIP${user.id.slice(0, 6).toUpperCase()}`,
      totalInvited: 0,
      successfulReferrals: 0,
      totalEarned: 0,
    },
  };
};
