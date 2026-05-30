# 🎯 Triprodeo Booking Engine - Implementation Guide

## ✅ SYSTEM STATUS: PRODUCTION-READY

Your booking engine is **fully implemented** with a robust, scalable architecture. This document explains how everything works.

---

## 📋 TABLE OF CONTENTS

1. [Database Structure](#database-structure)
2. [Core Inventory Logic](#core-inventory-logic)
3. [API Endpoints](#api-endpoints)
4. [Booking Flow](#booking-flow)
5. [Frontend Integration](#frontend-integration)
6. [Testing the System](#testing-the-system)
7. [Admin Walk-in Bookings](#admin-walk-in-bookings)

---

## 🗄️ DATABASE STRUCTURE

### RoomType Model
```prisma
model RoomType {
  id             String    @id @default(uuid())
  propertyId     String
  property       Property  @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  name           String
  totalRooms     Int       @default(1)          // Legacy field (use totalCount)
  totalCount     Int       @default(0)          // SINGLE SOURCE OF TRUTH for available inventory
  pricePerNight  Float
  price          Float     @default(0)          // Legacy field (use pricePerNight)
  capacity       Int       @default(2)          // Guests per room
  bedType        String
  size           String?
  amenities      String[]
  images         String[]
  description    String?
  status         String    @default("available")
  createdAt      DateTime  @default(now())
  
  bookings       Booking[]
  
  @@map("room_types")
}
```

### Booking Model
```prisma
model Booking {
  id            String        @id @default(uuid())
  propertyId    String
  property      Property      @relation(fields: [propertyId], references: [id])
  roomId        String?
  room          RoomType?      @relation(fields: [roomId], references: [id])
  hostId        String
  host          Host          @relation(fields: [hostId], references: [id])
  userId        String?
  user          User?         @relation(fields: [userId], references: [id])
  guestName     String
  guestEmail    String
  guestPhone    String
  guestCount    Int
  guests        Int           @default(1)
  rooms         Int           @default(1)       // NUMBER OF ROOMS BOOKED
  source        BookingSource @default(ONLINE)  // ONLINE or WALKIN
  checkIn       DateTime
  checkOut      DateTime
  nights        Int
  pricePerNight Float
  totalAmount   Float
  platformFee   Float         // 10% of totalAmount
  hostEarnings  Float         // totalAmount - platformFee
  status        BookingStatus @default(PENDING) // PENDING, CONFIRMED, CANCELLED, COMPLETED
  paymentMethod PaymentMethod @default(CARD)
  paymentRef    String?
  notes         String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  
  messages      Message[]
  review        Review?
  
  @@map("bookings")
}
```

### Key Enums
```prisma
enum BookingSource {
  ONLINE    // Customer bookings via website
  WALKIN    // Reception/dashboard bookings
}

enum BookingStatus {
  PENDING      // Awaiting confirmation
  CONFIRMED    // Confirmed by host
  CANCELLED    // Cancelled by guest/host
  COMPLETED    // Completed stay
  NO_SHOW      // Guest didn't show up
}
```

---

## 🔄 CORE INVENTORY LOGIC

### 1. Single Source of Truth

**NO stored "available rooms"** - Always calculated dynamically:

```
availableRooms = totalCount - sum(rooms booked for overlapping dates)
```

### 2. Availability Calculation

File: `backend/src/services/inventory.service.ts`

```typescript
export const getCalendarAvailability = async (
  roomId: string,
  startDate: string | Date,
  endDate: string | Date,
  client: PrismaClientLike = prisma
) => {
  // For each date in range:
  // 1. Find all bookings that overlap this date
  // 2. Sum the rooms booked across those bookings
  // 3. Calculate: available = totalCount - bookedRooms
  
  const days: { date: string; available: number }[] = [];
  for (let cursor = new Date(start); cursor < end; cursor = addDays(cursor, 1)) {
    const nextDay = addDays(cursor, 1);
    const bookedRooms = bookings.reduce((sum, booking) => (
      booking.checkIn < nextDay && booking.checkOut > cursor ? sum + booking.rooms : sum
    ), 0);
    
    days.push({
      date: toDateKey(cursor),
      available: Math.max(0, room.inventoryCount - bookedRooms),
    });
  }
  return days;
};
```

### 3. Room Capacity Based Booking

```typescript
export const calculateRoomsRequired = (guests: number, capacity: number) => {
  return Math.ceil(guests / capacity);
};

// Example:
// 6 guests, 2-person rooms = ceil(6/2) = 3 rooms required
// 5 guests, 2-person rooms = ceil(5/2) = 3 rooms required
// 2 guests, 2-person rooms = ceil(2/2) = 1 room required
```

### 4. Overbooking Prevention

File: `backend/src/services/inventory.service.ts`

```typescript
export const assertRoomsAvailable = async (
  roomId: string,
  requestedRooms: number,
  checkIn: Date,
  checkOut: Date,
  client: PrismaClientLike = prisma
) => {
  const availability = await getAvailabilitySnapshot(roomId, checkIn, checkOut, client);
  
  if (requestedRooms > availability.availableRooms) {
    throw Object.assign(
      new Error(`Only ${availability.availableRooms} room(s) available for selected dates`),
      { statusCode: 409 }
    );
  }
  
  return availability;
};
```

### 5. Pricing Logic

```typescript
// In createBooking() from bookings.service.ts

const totalAmount = roomsRequired * room.nightlyPrice * nights;
const platformFee = Math.round(totalAmount * 0.1);  // 10% platform fee
const hostEarnings = totalAmount - platformFee;

// Example:
// 2 rooms × ₹5,000/night × 3 nights = ₹30,000
// Platform Fee (10%) = ₹3,000
// Host Earnings = ₹27,000
```

---

## 🔌 API ENDPOINTS

### Booking Endpoints

#### 1. Create Booking (Online)
```
POST /api/bookings
Content-Type: application/json

{
  "roomId": "room-uuid",
  "guestName": "John Doe",
  "guestEmail": "john@example.com",
  "guestPhone": "+91-9876543210",
  "guests": 5,
  "checkIn": "2026-05-20",
  "checkOut": "2026-05-23",
  "source": "ONLINE",
  "paymentMethod": "CARD",
  "notes": "Early check-in requested"
}

Response (201):
{
  "id": "booking-uuid",
  "roomId": "room-uuid",
  "propertyId": "property-uuid",
  "hostId": "host-uuid",
  "guests": 5,
  "rooms": 3,           // Automatically calculated: ceil(5/room.capacity)
  "checkIn": "2026-05-20",
  "checkOut": "2026-05-23",
  "nights": 3,
  "pricePerNight": 5000,
  "totalAmount": 45000, // 3 rooms × ₹5,000 × 3 nights
  "platformFee": 4500,
  "hostEarnings": 40500,
  "source": "ONLINE",
  "status": "PENDING",
  "createdAt": "2026-05-06T16:30:00Z"
}
```

#### 2. Create Booking (Walk-in from Reception)
```
POST /api/bookings
Content-Type: application/json
Authorization: Bearer <host-token>

{
  "roomId": "room-uuid",
  "guestName": "Jane Smith",
  "guestEmail": "jane@example.com",
  "guestPhone": "+91-9876543211",
  "guests": 2,
  "checkIn": "2026-05-15",
  "checkOut": "2026-05-17",
  "source": "WALKIN",        // Indicates walk-in booking
  "paymentMethod": "CASH"
}

Response (201):
{
  "id": "booking-uuid",
  "source": "WALKIN",
  "rooms": 1,
  "totalAmount": 10000,
  ...
}
```

#### 3. Get Booking Details
```
GET /api/bookings/:bookingId
Authorization: Bearer <user-token>

Response (200):
{
  "id": "booking-uuid",
  "guestName": "John Doe",
  "property": {
    "name": "Azure Cliff Villa",
    "city": "Goa",
    "images": ["..."]
  },
  "room": {
    "name": "Luxury Suite",
    "capacity": 2,
    "amenities": ["WiFi", "AC", "Pool Access"]
  },
  "status": "CONFIRMED",
  ...
}
```

#### 4. Update Booking Status
```
PATCH /api/bookings/:bookingId/status
Authorization: Bearer <host-token>
Content-Type: application/json

{
  "status": "CONFIRMED"  // or CANCELLED, COMPLETED, NO_SHOW
}

Response (200):
{
  "id": "booking-uuid",
  "status": "CONFIRMED",
  ...
}
```

### Inventory Endpoints

#### 1. Get Calendar Availability
```
GET /api/inventory/calendar?roomId=room-uuid&startDate=2026-05-15&endDate=2026-05-25

Response (200):
[
  {
    "date": "2026-05-15",
    "available": 3      // 3 rooms available on this date
  },
  {
    "date": "2026-05-16",
    "available": 2      // 2 rooms available on this date
  },
  {
    "date": "2026-05-17",
    "available": 0      // Fully booked on this date
  },
  ...
]
```

---

## 🎯 BOOKING FLOW

### Step 1: User Selects Dates & Guests
```
- User selects: checkIn = 2026-05-20, checkOut = 2026-05-23, guests = 5
- Frontend calculates: nights = 3
```

### Step 2: Fetch Availability
```typescript
// Frontend calls:
GET /api/inventory/calendar?roomId=room-uuid&startDate=2026-05-20&endDate=2026-05-23

// Response shows availability for each night
[
  { "date": "2026-05-20", "available": 5 },
  { "date": "2026-05-21", "available": 5 },
  { "date": "2026-05-22", "available": 4 }  // Only 4 available this night
]

// Minimum available = 4 (the lowest across all nights)
```

### Step 3: Calculate Rooms Required
```typescript
// Frontend calculates:
roomCapacity = 2  // from room config
guests = 5
roomsRequired = ceil(5 / 2) = 3 rooms

// Display to user:
"3 rooms required for 5 guests"
```

### Step 4: Validate Against Availability
```typescript
// Frontend checks:
if (roomsRequired > minAvailableRooms) {
  // Show error: "Only 4 rooms available for these dates"
  return;
}

// All checks pass - enable booking button
```

### Step 5: Create Booking
```typescript
// Frontend submits:
POST /api/bookings
{
  "roomId": "room-uuid",
  "guests": 5,
  "roomsRequired": 3,  // Pre-calculated
  "checkIn": "2026-05-20",
  "checkOut": "2026-05-23",
  "source": "ONLINE",
  ...
}

// Backend validates:
✓ Room exists and is available
✓ roomsRequired matches calculated value = ceil(5 / room.capacity)
✓ roomsRequired <= availableRooms for date range
✓ Transaction isolation to prevent race conditions

// Backend creates booking with:
{
  "rooms": 3,
  "totalAmount": 3 × ₹5000 × 3 = ₹45,000,
  "status": "PENDING"
}
```

### Step 6: Update Inventory
```
Inventory automatically updated:
- Existing Bookings for Room A:
  2026-05-20: 2 rooms → now 5 rooms booked
  2026-05-21: 1 room  → now 4 rooms booked
  2026-05-22: 0 rooms → now 3 rooms booked

- New Available Rooms:
  2026-05-20: 5 - 5 = 0 available ✓
  2026-05-21: 5 - 4 = 1 available ✓
  2026-05-22: 4 - 3 = 1 available ✓
```

---

## 💻 FRONTEND INTEGRATION

### Key Files

#### 1. Property Page (`src/pages/property/page.tsx`)

```typescript
// State management
const [guests, setGuests] = useState(2);
const [checkIn, setCheckIn] = useState('');
const [checkOut, setCheckOut] = useState('');
const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
const [availableRooms, setAvailableRooms] = useState<number | null>(null);

// Calculated values
const roomCapacity = selectedRoom?.capacity ?? maxGuests;
const roomsRequired = Math.max(1, Math.ceil(guests / Math.max(1, roomCapacity)));

// Display to user
<p>
  {roomsRequired} {roomsRequired === 1 ? 'room' : 'rooms'} required 
  for {guests} {guests === 1 ? 'guest' : 'guests'}
</p>
<p className="text-2xl font-bold">
  ₹{effectivePrice} × {roomsRequired} × {nights} = ₹{totalPrice}
</p>
```

#### 2. Availability Calendar (`src/pages/property/components/PropertyAvailabilityCalendar.tsx`)

```typescript
// Fetch availability from backend
const fetchAvailability = async () => {
  const response = await apiFetch(
    `/inventory/calendar?roomId=${roomId}&startDate=${startDate}&endDate=${endDate}`
  );
  
  const calendar = response.data;
  
  // Find minimum available rooms across all dates
  const minAvailable = Math.min(...calendar.map(d => d.available));
  
  // Disable dates where available = 0
  calendar.forEach(day => {
    if (day.available === 0) {
      disableDateInCalendar(day.date);
    }
  });
};
```

#### 3. Booking Widget

```typescript
// Before submission, validate:
if (!checkIn || !checkOut) {
  showError("Select both check-in and check-out dates");
  return;
}

if (roomsRequired > availableRooms) {
  showError(`Only ${availableRooms} rooms available for these dates`);
  return;
}

// Submit booking
const bookingPayload = {
  roomId: selectedRoom.id,
  guestName: userProfile.name,
  guestEmail: userProfile.email,
  guestPhone: userProfile.phone,
  guests: guests,
  roomsRequired: roomsRequired,
  checkIn: checkIn,
  checkOut: checkOut,
  source: "ONLINE",
  paymentMethod: "CARD"
};

const response = await apiFetch('/bookings', {
  method: 'POST',
  body: JSON.stringify(bookingPayload)
});

if (response.success) {
  redirectToPayment(response.data.id);
}
```

---

## 🧪 TESTING THE SYSTEM

### Test Scenario 1: Normal Booking

**Setup:**
- Room A: capacity 2, totalCount 5, price ₹5,000/night
- No existing bookings

**Action:**
```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "room-a-uuid",
    "guestName": "Test User",
    "guestEmail": "test@example.com",
    "guestPhone": "+91-9876543210",
    "guests": 3,
    "checkIn": "2026-05-20",
    "checkOut": "2026-05-23",
    "source": "ONLINE",
    "paymentMethod": "CARD"
  }'
```

**Expected:**
- ✓ Booking created with rooms = ceil(3/2) = 2
- ✓ totalAmount = 2 × ₹5,000 × 3 = ₹30,000
- ✓ platformFee = ₹3,000
- ✓ hostEarnings = ₹27,000

### Test Scenario 2: Check Availability

**Action:**
```bash
curl "http://localhost:5000/api/inventory/calendar?roomId=room-a-uuid&startDate=2026-05-20&endDate=2026-05-23"
```

**Expected:**
```json
[
  { "date": "2026-05-20", "available": 3 },  // 5 - 2 = 3
  { "date": "2026-05-21", "available": 3 },
  { "date": "2026-05-22", "available": 3 }
]
```

### Test Scenario 3: Overbooking Prevention

**Action:** Try to book 4 rooms (more than available 3)
```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "room-a-uuid",
    "guestName": "Test User 2",
    "guestEmail": "test2@example.com",
    "guestPhone": "+91-9876543211",
    "guests": 9,  // ceil(9/2) = 5 rooms required
    "checkIn": "2026-05-20",
    "checkOut": "2026-05-23",
    "source": "ONLINE"
  }'
```

**Expected:**
- ✗ Error: "Only 3 room(s) available for selected dates"
- ✓ Booking NOT created

### Test Scenario 4: Walk-in Booking from Reception

**Setup:** Host logged in with token

**Action:**
```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <host-token>" \
  -d '{
    "roomId": "room-a-uuid",
    "guestName": "Walk-in Guest",
    "guestEmail": "walkin@example.com",
    "guestPhone": "+91-9876543212",
    "guests": 2,
    "checkIn": "2026-05-25",
    "checkOut": "2026-05-26",
    "source": "WALKIN",
    "paymentMethod": "CASH"
  }'
```

**Expected:**
- ✓ Booking created with source = "WALKIN"
- ✓ Instant inventory update
- ✓ Other online bookings for same dates not affected

### Test Scenario 5: Concurrent Booking (Race Condition)

**Action:** Submit same booking twice rapidly

**Expected:**
- ✓ First booking succeeds
- ✗ Second booking fails: "Only X room(s) available"
- ✓ Database remains consistent (no overbooking)

**Why it works:**
- Backend uses `Prisma.TransactionIsolationLevel.Serializable`
- Two transactions checking/updating same room conflict
- Retry logic handles brief conflicts (max 3 attempts)
- If both fail, booking operations are completely rolled back

---

## 👨‍💼 ADMIN WALK-IN BOOKINGS

### Host Portal Access

1. **Host logs into Host Portal**
   - URL: `http://localhost:3000/host-portal`
   - Uses host credentials from database

2. **Navigate to "Reception Dashboard"**
   - Create new walk-in booking
   - Fill guest details
   - Select room
   - Set check-in/check-out dates

3. **System Process**
   ```
   POST /api/bookings with source: "WALKIN"
   ↓
   Backend validates host ownership of property
   ↓
   Calculate rooms required = ceil(guests / room.capacity)
   ↓
   Check room availability (same logic as online)
   ↓
   Create booking with source = "WALKIN"
   ↓
   Inventory updated immediately
   ↓
   Notification sent to host
   ```

4. **Real-time Inventory Sync**
   - Walk-in bookings use **SAME Booking table** as online
   - Walk-in bookings use **SAME availability calculation**
   - Walk-in bookings **included in calendar API** for other guests
   - No separate "walk-in inventory" - single source of truth

---

## 🏗️ ARCHITECTURE BENEFITS

### Why This Design is Production-Ready

1. **Single Source of Truth**
   - No "available_rooms" column in DB
   - All availability calculated dynamically from bookings
   - No sync issues between multiple inventory sources

2. **Room Capacity Automation**
   - No manual room selection by guests
   - Prevents under-utilization (wrong room size)
   - Auto-calculates: ceil(guests / capacity)

3. **Serializable Transactions**
   - Prevents race conditions
   - Multiple concurrent bookings safe
   - Retry logic handles transient conflicts

4. **Unified Booking System**
   - Online and Walk-in use same API
   - Same database tables
   - Same availability logic
   - Same pricing logic

5. **Dynamic Calendar**
   - Each date independently calculated
   - Accurate day-by-day availability
   - Handles multi-night bookings correctly

6. **Pricing Transparency**
   - Platform fee always calculated (10%)
   - Host earnings clearly shown
   - Per-room, per-night pricing

---

## 📊 DATA FLOW DIAGRAM

```
User Interface
    ↓
[Select Guests] → [Pick Dates] → [Fetch Calendar]
    ↓                                  ↓
    ├──→ Frontend calculates:    Backend queries:
    │    roomsRequired =          Bookings for room
    │    ceil(guests/capacity)     where dates overlap
    │                              ↓
    │                         For each date:
    │                         available = totalCount
    │                                   - sum(booked rooms)
    │                              ↓
    │                         Return day-by-day
    │    ← Show availability ←─────────────────────
    │
    └──→ [Validate] roomsRequired ≤ available
         [Submit Booking] ─→ Backend Booking API
                               ↓
                          [Transaction Start]
                          Fetch room data
                          Calculate rooms required
                          Verify availability
                          [Create Booking Record]
                          [Create Notification]
                          [Commit Transaction]
                               ↓
                          [Success Response]
                               ↓
                          Inventory auto-updated
                          for next guests
```

---

## ⚠️ IMPORTANT NOTES

### DO's ✓
- ✓ Trust the backend validation
- ✓ Display roomsRequired to guests
- ✓ Show "Only X rooms left" messaging
- ✓ Use calendar API to update UI
- ✓ Handle concurrent booking attempts gracefully

### DON'Ts ✗
- ✗ Don't manually modify `totalRooms` (use `totalCount`)
- ✗ Don't create separate "available_inventory" tracking
- ✗ Don't store room availability in frontend state
- ✗ Don't allow guests to specify exact room numbers
- ✗ Don't bypass roomsRequired validation

---

## 🚀 NEXT STEPS (OPTIONAL ENHANCEMENTS)

1. **Pricing Tiers**
   - Off-peak pricing (20% discount)
   - Peak season pricing (30% premium)
   - Early bird discounts

2. **Length of Stay Discounts**
   - 7+ nights: 10% discount
   - 30+ nights: 20% discount

3. **Guest Preferences**
   - Favorite room types
   - Floor preferences
   - Special requests

4. **Cancellation Policies**
   - Free cancellation up to 7 days
   - 50% refund up to 3 days
   - No refund within 48 hours

5. **Bulk Bookings**
   - Group bookings (10+ rooms)
   - Corporate rates
   - Monthly contracts

---

## 📞 SUPPORT

For issues or questions:
1. Check backend logs: `npm run dev`
2. Test API endpoints directly
3. Review transaction logs in database
4. Check notification queue for errors

---

**System Version:** 1.0.0 (Production-Ready)  
**Last Updated:** May 6, 2026  
**Status:** ✅ LIVE
