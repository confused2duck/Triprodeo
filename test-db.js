// Direct database test
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('\n=== DATABASE VERIFICATION ===\n');
    
    // Check properties
    const properties = await prisma.property.findMany({ take: 1, include: { roomTypes: true } });
    console.log('Properties:', properties.length);
    if (properties.length > 0) {
      const prop = properties[0];
      console.log('✓ Property:', prop.name);
      console.log('✓ Rooms:', prop.roomTypes.length);
      if (prop.roomTypes.length > 0) {
        const room = prop.roomTypes[0];
        console.log('\nRoom Details:');
        console.log('  ID:', room.id);
        console.log('  Name:', room.name);
        console.log('  Capacity:', room.capacity);
        console.log('  Total Count:', room.totalCount);
        console.log('  Price Per Night:', room.pricePerNight);
      }
    }
    
    // Check bookings
    const bookings = await prisma.booking.count();
    console.log('\nBookings in DB:', bookings);
    
    // Check admins
    const admins = await prisma.admin.findMany({ select: { email: true } });
    console.log('Admins:', admins.map(a => a.email).join(', '));
    
    console.log('\n✓ DATABASE CONNECTION SUCCESSFUL');
  } catch (error) {
    console.error('✗ ERROR:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
