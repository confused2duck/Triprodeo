CREATE TABLE "day_outing_enquiries" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestPhone" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "timeRange" TEXT,
    "packageTitle" TEXT,
    "guests" INTEGER NOT NULL,
    "pricePerPerson" DOUBLE PRECISION NOT NULL,
    "estimatedTotal" DOUBLE PRECISION NOT NULL,
    "occasion" TEXT,
    "specialRequests" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "day_outing_enquiries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "day_outing_enquiries"
ADD CONSTRAINT "day_outing_enquiries_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
