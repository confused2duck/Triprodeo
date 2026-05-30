const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for admin...');
  
  const admin = await prisma.admin.findUnique({
    where: { email: 'admin@triprodeo.com' }
  });
  
  if (admin) {
    console.log('Admin exists:', admin);
  } else {
    console.log('No admin found. Creating default admin...');
    const password = await bcrypt.hash('triprodeo2025', 10);
    const created = await prisma.admin.create({
      data: {
        email: 'admin@triprodeo.com',
        password,
        name: 'Triprodeo Admin'
      }
    });
    console.log('Admin created:', created);
  }
  
  // Also check bookings
  console.log('\nChecking for bookings...');
  const bookings = await prisma.booking.findMany({
    take: 5,
    include: {
      property: { select: { name: true } }
    }
  });
  console.log(`Found ${bookings.length} bookings`);
  if (bookings.length > 0) {
    console.log('Sample bookings:', JSON.stringify(bookings, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
