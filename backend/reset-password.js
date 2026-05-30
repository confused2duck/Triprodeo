const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting admin password to: triprodeo2025');
  
  const password = await bcrypt.hash('triprodeo2025', 12);
  
  const updated = await prisma.admin.update({
    where: { email: 'admin@triprodeo.com' },
    data: { password }
  });
  
  console.log('Admin password updated:', updated.email);
  console.log('New hash:', password);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
