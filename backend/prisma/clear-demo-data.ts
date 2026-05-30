import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing all seeded data...');

  await prisma.$transaction([
    prisma.propertySeo.deleteMany(),
    prisma.staffMember.deleteMany(),
    prisma.menuItem.deleteMany(),
    prisma.inventoryItem.deleteMany(),
    prisma.addOn.deleteMany(),
    prisma.roomType.deleteMany(),
    prisma.review.deleteMany(),
    prisma.message.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.payout.deleteMany(),
    prisma.promotion.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.property.deleteMany(),
    prisma.experience.deleteMany(),
    prisma.trendingDestination.deleteMany(),
    prisma.cmsPage.deleteMany(),
    prisma.siteSettings.deleteMany(),
    prisma.host.deleteMany(),
    prisma.user.deleteMany(),
    prisma.admin.deleteMany(),
  ]);

  console.log('All seeded data cleared.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
