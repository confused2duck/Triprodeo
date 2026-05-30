# 🔌 Triprodeo Booking & Inventory API Reference

## Quick Start

**Base URL:** `http://localhost:5000/api`

---

## Booking API

### 1. Create Online Booking

```http
POST /bookings
Content-Type: application/json

{
  "roomId": "string (required)",
  "guestName": "string (required)",
  "guestEmail": "string (required)",
  "guestPhone": "string (required)",
  "guests": "number (required)",
  "checkIn": "YYYY-MM-DD (required)",
  "checkOut": "YYYY-MM-DD (required)",
  "paymentMethod": "CARD | UPI | NETBANKING | WALLET | CASH (optional, default: CARD)",
  "notes": "string (optional)"
}
```

**Success Response (201):**
```json
{
  "id": "uuid",
  "propertyId": "uuid",
  "roomId": "uuid",
  "hostId": "uuid",
  "guestName": "John Doe",
  "guests": 5,
  "rooms": 3,
  "checkIn": "2026-05-20T00:00:00Z",
  "checkOut": "2026-05-23T00:00:00Z",
  "nights": 3,
  "pricePerNight": 5000,
  "totalAmount": 45000,
  "platformFee": 4500,
  "hostEarnings": 40500,
  "source": "ONLINE",
  "status": "PENDING",
  "paymentMethod": "CARD",
  "createdAt": "2026-05-06T16:30:00Z"
}
```

**Error Responses:**
- `400`: Missing required fields or invalid input
- `409`: Insufficient rooms available

---

### 2. Create Walk-in Booking (Host Only)

```http
POST /bookings
Authorization: Bearer <host-token>
Content-Type: application/json

{
  "roomId": "string (required)",
  "guestName": "string (required)",
  "guestEmail": "string (required)",
  "guestPhone": "string (required)",
  "guests": "number (required)",
  "checkIn": "YYYY-MM-DD (required)",
  "checkOut": "YYYY-MM-DD (required)",
  "source": "WALKIN (required)",
  "paymentMethod": "CARD | UPI | CASH (optional, default: CARD)",
  "notes": "string (optional)"
}
```

**Response:** Same as online booking, but `source: "WALKIN"`

---

### 3. Get Booking Details

```http
GET /bookings/:bookingId
Authorization: Bearer <user-token>
```

**Success Response (200):**
```json
{
  "id": "uuid",
  "guestName": "John Doe",
  "property": {
    "name": "Azure Cliff Villa",
    "city": "Goa",
    "state": "Goa",
    "images": ["url1", "url2"]
  },
  "room": {
    "id": "uuid",
    "name": "Luxury Suite",
    "capacity": 2,
    "amenities": ["WiFi", "AC", "Pool"]
  },
  "host": {
    "name": "Ananya Krishnan",
    "email": "ananya@triprodeo.com"
  },
  "status": "PENDING",
  "totalAmount": 45000,
  ...
}
```

---

### 4. Update Booking Status

```http
PATCH /bookings/:bookingId/status
Authorization: Bearer <host-token>
Content-Type: application/json

{
  "status": "PENDING | CONFIRMED | CANCELLED | COMPLETED | NO_SHOW"
}
```

**Success Response (200):**
```json
{
  "id": "uuid",
  "status": "CONFIRMED",
  "updatedAt": "2026-05-06T17:00:00Z"
}
```

---

### 5. Get Host Bookings (Paginated)

```http
GET /bookings?status=PENDING&page=1&limit=20
Authorization: Bearer <host-token>
```

**Query Parameters:**
- `status` (optional): PENDING | CONFIRMED | CANCELLED | COMPLETED
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page

**Success Response (200):**
```json
{
  "bookings": [
    {
      "id": "uuid",
      "guestName": "John Doe",
      "checkIn": "2026-05-20",
      "checkOut": "2026-05-23",
      "rooms": 3,
      "totalAmount": 45000,
      "status": "PENDING",
      "property": {
        "name": "Azure Cliff Villa",
        "images": ["url"]
      }
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

---

## Inventory API

### 1. Get Calendar Availability

```http
GET /inventory/calendar?roomId=UUID&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

**Query Parameters (all required):**
- `roomId`: UUID of room type
- `startDate`: Start date (YYYY-MM-DD format)
- `endDate`: End date (YYYY-MM-DD format)

**Success Response (200):**
```json
[
  {
    "date": "2026-05-15",
    "available": 5
  },
  {
    "date": "2026-05-16",
    "available": 5
  },
  {
    "date": "2026-05-17",
    "available": 3
  },
  {
    "date": "2026-05-18",
    "available": 0
  },
  {
    "date": "2026-05-19",
    "available": 5
  },
  {
    "date": "2026-05-20",
    "available": 2
  },
  {
    "date": "2026-05-21",
    "available": 2
  },
  {
    "date": "2026-05-22",
    "available": 2
  },
  {
    "date": "2026-05-23",
    "available": 5
  },
  {
    "date": "2026-05-24",
    "available": 5
  },
  {
    "date": "2026-05-25",
    "available": 5
  }
]
```

**How to Use:**
1. Extract minimum available across dates needed
2. Disable calendar dates where `available === 0`
3. Show "Only X rooms left" if `available < 3`
4. Calculate: `roomsRequired = ceil(guests / room.capacity)`
5. Validate: `roomsRequired <= minimum_available`

---

## Frontend Integration Example

### Vue/React Hook

```typescript
import { useState, useEffect } from 'react';

export const useRoomAvailability = (roomId: string, checkIn: string, checkOut: string) => {
  const [availability, setAvailability] = useState<Array<{date: string, available: number}>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !checkIn || !checkOut) return;

    const fetchAvailability = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/inventory/calendar?roomId=${roomId}&startDate=${checkIn}&endDate=${checkOut}`
        );
        if (!response.ok) throw new Error('Failed to fetch availability');
        
        const data = await response.json();
        setAvailability(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [roomId, checkIn, checkOut]);

  const minAvailable = availability.length > 0
    ? Math.min(...availability.map(d => d.available))
    : 0;

  return { availability, minAvailable, loading, error };
};
```

### Create Booking Hook

```typescript
export const useCreateBooking = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBooking = async (data: {
    roomId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    guests: number;
    checkIn: string;
    checkOut: string;
    paymentMethod?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Booking failed');
      }

      return await response.json();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createBooking, loading, error };
};
```

---

## Error Handling

### Common Errors

| Code | Scenario | Response |
|------|----------|----------|
| 400 | Missing required fields | `{ "message": "Missing required booking fields" }` |
| 400 | Invalid dates | `{ "message": "Check-out must be after check-in" }` |
| 400 | Invalid guests | `{ "message": "Guests must be at least 1" }` |
| 403 | Host not authenticated | `{ "message": "Walk-in bookings require host authentication" }` |
| 404 | Room not found | `{ "message": "Room not available" }` |
| 404 | Booking not found | `{ "message": "Booking not found" }` |
| 409 | Insufficient rooms | `{ "message": "Only 2 room(s) available for selected dates" }` |
| 409 | Booking conflict | `{ "message": "Unable to create booking safely" }` |
| 500 | Server error | `{ "message": "Internal server error" }` |

---

## Authentication

### For Guest Bookings
- No authentication required
- Booking linked to userId if user logged in

### For Host Operations
```http
Authorization: Bearer <jwt-token>
```

**Get host token:**
```http
POST /auth/host-login
Content-Type: application/json

{
  "email": "ananya@triprodeo.com",
  "password": "host1234"
}
```

Response:
```json
{
  "accessToken": "jwt-token",
  "refreshToken": "jwt-token",
  "host": {
    "id": "uuid",
    "email": "ananya@triprodeo.com",
    "name": "Ananya Krishnan"
  }
}
```

---

## Pricing Calculation

```
Total Price = roomsRequired × roomPrice × nights

Where:
  roomsRequired = ceil(guests / room.capacity)
  roomPrice = room.pricePerNight
  nights = (checkOut - checkIn) / 86400000  // milliseconds to days

Example:
  guests = 5
  room.capacity = 2
  room.pricePerNight = ₹5,000
  checkIn = 2026-05-20
  checkOut = 2026-05-23
  
  roomsRequired = ceil(5/2) = 3
  nights = 3
  totalAmount = 3 × ₹5,000 × 3 = ₹45,000
  platformFee = ₹45,000 × 10% = ₹4,500
  hostEarnings = ₹45,000 - ₹4,500 = ₹40,500
```

---

## Status Workflow

```
PENDING → CONFIRMED → COMPLETED
  ↓          ↓
  CANCELLED  NO_SHOW

PENDING = Booking created, awaiting host confirmation
CONFIRMED = Host confirmed booking
COMPLETED = Guest checked out
CANCELLED = Cancelled by guest or host
NO_SHOW = Guest didn't arrive
```

---

## Rate Limits

- **Guest Bookings**: 10 requests/minute
- **Host Operations**: 30 requests/minute
- **Availability Queries**: 100 requests/minute

---

## Data Types & Formats

```typescript
// Date Format
Date = "YYYY-MM-DD" | "ISO8601"  // e.g., "2026-05-20" or "2026-05-20T00:00:00Z"

// UUID Format
UUID = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

// Payment Methods
PaymentMethod = "CARD" | "UPI" | "NETBANKING" | "WALLET" | "CASH"

// Booking Status
BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW"

// Booking Source
BookingSource = "ONLINE" | "WALKIN"
```

---

## Webhooks (Future)

Once implemented, events will be sent to registered webhook URLs:
- `booking.created`
- `booking.confirmed`
- `booking.cancelled`
- `booking.completed`

---

## Testing with cURL

### Create Booking
```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "550e8400-e29b-41d4-a716-446655440000",
    "guestName": "John Doe",
    "guestEmail": "john@example.com",
    "guestPhone": "+91-9876543210",
    "guests": 4,
    "checkIn": "2026-05-20",
    "checkOut": "2026-05-23",
    "paymentMethod": "CARD"
  }'
```

### Check Availability
```bash
curl "http://localhost:5000/api/inventory/calendar?roomId=550e8400-e29b-41d4-a716-446655440000&startDate=2026-05-15&endDate=2026-05-25"
```

### Get Booking
```bash
curl http://localhost:5000/api/bookings/uuid \
  -H "Authorization: Bearer <token>"
```

---

**Last Updated:** May 6, 2026  
**Version:** 1.0.0
