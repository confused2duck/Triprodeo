import crypto from 'crypto';
import { env } from '../config/env';
import prisma from '../config/database';
import * as bookingsService from './bookings.service';

type RazorpayOrder = {
  id: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  status: string;
};

type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

const ensureRazorpayConfigured = () => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw Object.assign(new Error('Razorpay keys are not configured'), { statusCode: 503 });
  }
};

const razorpayAuthHeader = () => ({
  Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
});

const callRazorpay = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  ensureRazorpayConfigured();
  const response = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    ...init,
    headers: {
      ...razorpayAuthHeader(),
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  const payload = await response.json().catch(() => ({})) as {
    error?: { description?: string };
  };
  if (!response.ok) {
    const message = typeof payload?.error?.description === 'string'
      ? payload.error.description
      : `Razorpay request failed: ${response.status}`;
    throw Object.assign(new Error(message), { statusCode: 502 });
  }
  return payload as T;
};

const toPaise = (amount: number) => Math.round(amount * 100);

const getPaymentPercent = (value: unknown) => {
  const percent = Number(value ?? 100);
  if (!Number.isFinite(percent)) return 100;
  return Math.min(100, Math.max(30, Math.round(percent)));
};

const readPaymentRef = (value: string | null) => {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
};

export const createRazorpayBookingOrder = async (data: {
  propertyId?: string;
  roomId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guests?: number;
  guestCount?: number;
  roomsRequired?: number;
  checkIn: string;
  checkOut: string;
  notes?: string;
  addOnIds?: string[];
  promoCode?: string;
  paymentPercent?: number;
  userId?: string;
}) => {
  ensureRazorpayConfigured();

  const booking = await bookingsService.createBooking({
    propertyId: data.propertyId,
    roomId: data.roomId,
    guestName: data.guestName,
    guestEmail: data.guestEmail,
    guestPhone: data.guestPhone,
    guestCount: data.guestCount,
    guests: data.guests,
    roomsRequired: data.roomsRequired,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    source: 'ONLINE',
    paymentMethod: 'CARD',
    notes: data.notes,
    addOnIds: data.addOnIds,
    promoCode: data.promoCode,
    userId: data.userId,
  });

  try {
    const paymentPercent = getPaymentPercent(data.paymentPercent);
    const payableAmount = Math.max(1, toPaise(Number(booking.totalAmount) * (paymentPercent / 100)));
    const order = await callRazorpay<RazorpayOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: payableAmount,
        currency: env.RAZORPAY_CURRENCY,
        receipt: booking.id,
        notes: {
          bookingId: booking.id,
          propertyId: booking.propertyId,
          roomId: booking.roomId ?? '',
        },
      }),
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentRef: JSON.stringify({
          provider: 'razorpay',
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          paymentPercent,
          status: order.status,
          createdAt: new Date().toISOString(),
        }),
      },
    });

    return {
      booking,
      keyId: env.RAZORPAY_KEY_ID,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      },
    };
  } catch (error) {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } }).catch(() => undefined);
    throw error;
  }
};

export const verifyRazorpayBookingPayment = async (data: {
  bookingId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) => {
  ensureRazorpayConfigured();

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${data.razorpayOrderId}|${data.razorpayPaymentId}`)
    .digest('hex');
  const actual = data.razorpaySignature;
  const signatureMatches =
    expected.length === actual.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));

  if (!signatureMatches) {
    throw Object.assign(new Error('Payment signature verification failed'), { statusCode: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });

  const paymentRef = readPaymentRef(booking.paymentRef);
  if (paymentRef.orderId !== data.razorpayOrderId) {
    throw Object.assign(new Error('Razorpay order does not match booking'), { statusCode: 400 });
  }

  const payment = await callRazorpay<RazorpayPayment>(`/payments/${encodeURIComponent(data.razorpayPaymentId)}`);
  if (payment.order_id !== data.razorpayOrderId) {
    throw Object.assign(new Error('Payment belongs to a different Razorpay order'), { statusCode: 400 });
  }
  if (!['captured', 'authorized'].includes(payment.status)) {
    throw Object.assign(new Error(`Payment is not successful (${payment.status})`), { statusCode: 400 });
  }
  if (payment.amount < Number(paymentRef.amount ?? 0) || payment.currency !== paymentRef.currency) {
    throw Object.assign(new Error('Payment amount verification failed'), { statusCode: 400 });
  }

  return bookingsService.confirmRazorpayBooking({
    bookingId: booking.id,
    razorpayOrderId: data.razorpayOrderId,
    razorpayPaymentId: data.razorpayPaymentId,
    amountPaid: payment.amount,
    currency: payment.currency,
  });
};
