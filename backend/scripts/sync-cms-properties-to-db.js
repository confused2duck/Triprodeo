const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const toPropertyType = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized || 'villa';
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const compactStrings = (items) =>
  Array.isArray(items) ? items.map((item) => String(item || '').trim()).filter(Boolean) : [];

async function main() {
  const setting = await prisma.siteSettings.findUnique({ where: { key: 'cms_content' } });
  const cms = setting && typeof setting.value === 'object' ? setting.value : null;
  const cmsProperties = Array.isArray(cms?.properties) ? cms.properties : [];

  if (cmsProperties.length === 0) {
    throw new Error('No CMS properties found in site_settings.cms_content. Open /admin, save Properties once, then rerun this script.');
  }

  const host = await prisma.host.findFirst({ orderBy: { joinedAt: 'asc' } });
  if (!host) {
    throw new Error('No host account found. Create at least one Resort Owner Account before syncing CMS properties.');
  }

  let synced = 0;
  for (const property of cmsProperties) {
    const id = String(property.id || '').trim();
    const name = String(property.name || '').trim();
    const location = String(property.location || property.city || '').trim();
    const pricePerNight = toNumber(property.pricePerNight, 0);

    if (!id || !name || !location || pricePerNight <= 0) {
      console.warn(`Skipping incomplete property: ${name || id || '(missing id/name)'}`);
      continue;
    }

    await prisma.property.upsert({
      where: { id },
      create: {
        id,
        hostId: property.hostId || host.id,
        name,
        description: String(property.description || ''),
        location,
        fullAddress: String(property.fullAddress || ''),
        city: String(property.city || location),
        state: String(property.state || ''),
        country: 'India',
        pricePerNight,
        originalPrice: property.originalPrice == null ? null : toNumber(property.originalPrice),
        type: toPropertyType(property.type),
        status: 'ACTIVE',
        verified: property.verified !== false,
        superhost: property.superhost === true,
        bedrooms: Math.max(1, Math.trunc(toNumber(property.bedrooms, 1))),
        bathrooms: Math.max(1, Math.trunc(toNumber(property.bathrooms, 1))),
        maxGuests: Math.max(1, Math.trunc(toNumber(property.maxGuests, 2))),
        images: compactStrings(property.images),
        tags: compactStrings(property.tags),
        isExclusive: property.isExclusive === true,
        amenities: compactStrings(property.amenities),
        rating: toNumber(property.rating, 0),
        reviewCount: Math.max(0, Math.trunc(toNumber(property.reviewCount, 0))),
        scarcity: property.scarcity ? String(property.scarcity) : null,
        housePolicies: compactStrings(property.housePolicies),
        dayPackage: property.dayPackage || undefined,
      },
      update: {
        hostId: property.hostId || host.id,
        name,
        description: String(property.description || ''),
        location,
        fullAddress: String(property.fullAddress || ''),
        city: String(property.city || location),
        state: String(property.state || ''),
        country: 'India',
        pricePerNight,
        originalPrice: property.originalPrice == null ? null : toNumber(property.originalPrice),
        type: toPropertyType(property.type),
        status: 'ACTIVE',
        verified: property.verified !== false,
        superhost: property.superhost === true,
        bedrooms: Math.max(1, Math.trunc(toNumber(property.bedrooms, 1))),
        bathrooms: Math.max(1, Math.trunc(toNumber(property.bathrooms, 1))),
        maxGuests: Math.max(1, Math.trunc(toNumber(property.maxGuests, 2))),
        images: compactStrings(property.images),
        tags: compactStrings(property.tags),
        isExclusive: property.isExclusive === true,
        amenities: compactStrings(property.amenities),
        rating: toNumber(property.rating, 0),
        reviewCount: Math.max(0, Math.trunc(toNumber(property.reviewCount, 0))),
        scarcity: property.scarcity ? String(property.scarcity) : null,
        housePolicies: compactStrings(property.housePolicies),
        dayPackage: property.dayPackage || undefined,
      },
    });

    await prisma.roomType.deleteMany({ where: { propertyId: id } });
    const rooms = Array.isArray(property.roomTypes) ? property.roomTypes : [];
    for (const room of rooms) {
      if (!String(room.name || '').trim()) continue;
      await prisma.roomType.create({
        data: {
          propertyId: id,
          name: String(room.name),
          totalRooms: Math.max(1, Math.trunc(toNumber(room.totalRooms, 1))),
          totalCount: Math.max(1, Math.trunc(toNumber(room.totalRooms, 1))),
          pricePerNight: toNumber(room.pricePerNight, pricePerNight),
          price: toNumber(room.pricePerNight, pricePerNight),
          capacity: Math.max(1, Math.trunc(toNumber(room.capacity, 2))),
          bedType: String(room.bedType || 'King Bed'),
          size: room.size ? String(room.size) : null,
          amenities: compactStrings(room.amenities),
          images: compactStrings(room.photos || room.images),
          description: room.description ? String(room.description) : null,
          status: 'available',
        },
      });
    }

    await prisma.addOn.deleteMany({ where: { propertyId: id } });
    const addOns = Array.isArray(property.addOns) ? property.addOns : [];
    for (const addOn of addOns) {
      if (!String(addOn.name || '').trim()) continue;
      await prisma.addOn.create({
        data: {
          propertyId: id,
          name: String(addOn.name),
          price: toNumber(addOn.price, 0),
          image: addOn.image ? String(addOn.image) : null,
          description: addOn.description ? String(addOn.description) : null,
        },
      });
    }

    synced += 1;
  }

  console.log(`Synced ${synced} CMS properties into the live properties table.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
