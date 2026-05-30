import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { fetchProperties } from '@/services/propertiesApi';
import { fetchCMSData } from '@/pages/admin/cmsStore';
import { CMSTrendingDestination } from '@/pages/admin/types';
import { Property } from '@/types/property';

type DestinationCard = {
  id: string;
  name: string;
  count: number;
  price: number;
  image: string;
  tagline?: string;
  badge?: string;
  badgeColor?: string;
  tags?: string[];
};

export default function DestinationsPage() {
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState<DestinationCard[]>([]);

  useEffect(() => {
    Promise.all([
      fetchCMSData().catch(() => null),
      fetchProperties({ limit: 100 }).catch(() => ({ properties: [] as Property[] })),
    ])
      .then(([cmsData, { properties }]) => {
        const grouped = properties.reduce<Record<string, typeof properties>>((acc, property) => {
          const key = (property.city || property.state || property.location || '').trim();
          if (!key) return acc;
          acc[key] = [...(acc[key] ?? []), property];
          return acc;
        }, {});

        const liveDestinations: DestinationCard[] = Object.entries(grouped).map(([name, items]) => ({
          id: name,
          name,
          count: items.length,
          price: Math.min(...items.map((p) => p.pricePerNight)),
          image: items[0]?.images[0] ?? 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800',
          tagline: `Explore ${name} stays`,
          tags: Array.from(new Set(items.flatMap((p) => p.tags))).slice(0, 3),
        }));

        const cmsDestinations: CMSTrendingDestination[] = (cmsData?.trendingDestinations ?? []).filter((destination) => destination.name.trim());
        const cmsByName = new Map<string, CMSTrendingDestination>(
          cmsDestinations.map((destination) => [destination.name.trim().toLowerCase(), destination])
        );
        const merged = new Map<string, DestinationCard>();

        liveDestinations.forEach((live) => {
          const cms = cmsByName.get(live.name.trim().toLowerCase());
          merged.set(live.name.trim().toLowerCase(), {
            ...live,
            ...(cms
              ? {
                  id: cms.id || live.id,
                  image: cms.image || live.image,
                  tagline: cms.tagline || live.tagline,
                  badge: cms.badge,
                  badgeColor: cms.badgeColor,
                  tags: cms.tags?.length ? cms.tags : live.tags,
                }
              : {}),
          });
        });

        cmsDestinations.forEach((destination: CMSTrendingDestination) => {
          const key = destination.name.trim().toLowerCase();
          if (merged.has(key)) return;
          merged.set(key, {
            id: destination.id,
            name: destination.name,
            count: destination.properties,
            price: destination.startingPrice,
            image: destination.image,
            tagline: destination.tagline,
            badge: destination.badge,
            badgeColor: destination.badgeColor,
            tags: destination.tags,
          });
        });

        setDestinations(Array.from(merged.values()));
      })
      .catch(() => setDestinations([]));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-28 pb-16 max-w-[1200px] mx-auto px-4 md:px-8">
        <p className="text-stone-400 text-xs uppercase tracking-widest font-semibold mb-2">Explore</p>
        <h1 className="text-3xl md:text-5xl font-bold text-stone-900 mb-8" style={{ fontFamily: "'Playfair Display', serif" }}>
          View All Destinations
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {destinations.map((dest) => (
            <button key={dest.id} onClick={() => navigate(`/search?destination=${encodeURIComponent(dest.name)}`)} className="relative overflow-hidden rounded-2xl text-left aspect-[4/3] group">
              <img src={dest.image} alt={dest.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              {dest.badge && (
                <span className={`absolute left-5 top-5 rounded-full px-3 py-1 text-xs font-bold ${dest.badgeColor ?? 'bg-white/20 text-white'}`}>
                  {dest.badge}
                </span>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h2 className="text-white text-2xl font-bold">{dest.name}</h2>
                {dest.tagline && <p className="text-white/80 text-sm mt-1">{dest.tagline}</p>}
                {dest.tags && dest.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {dest.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-white/15 px-2 py-0.5 text-xs text-white/85">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-white/70 text-sm mt-1">{dest.count} stays from &#x20B9;{dest.price.toLocaleString('en-IN')}</p>
              </div>
            </button>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
