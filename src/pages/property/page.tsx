import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { properties as mockProperties } from '@/mocks/properties';
import PropertyCard from '@/components/base/PropertyCard';
import { loadCMSData } from '@/pages/admin/cmsStore';
import { fetchProperties, fetchPropertyById } from '@/services/propertiesApi';
import { Property } from '@/types/property';
import RoomTypesSection from './components/RoomTypesSection';
import PropertyAvailabilityCalendar from './components/PropertyAvailabilityCalendar';
import PropertyPolicies from './components/PropertyPolicies';
import DayPackageSection from './components/DayPackageSection';
import DayPackageEnquiryModal from './components/DayPackageEnquiryModal';
import { apiFetch } from '@/lib/apiClient';

export default function PropertyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const cmsData = useMemo(() => loadCMSData(), []);
  const fallbackProperty = useMemo(
    () => cmsData.properties.find((p) => p.id === id) ?? cmsData.properties[0],
    [cmsData, id]
  );
  const [propertyData, setPropertyData] = useState<Property | typeof fallbackProperty>(fallbackProperty);
  const [similarProperties, setSimilarProperties] = useState<Array<Property | typeof fallbackProperty>>(
    cmsData.properties.filter((p) => p.id !== fallbackProperty.id).slice(0, 3)
  );

  useEffect(() => {
    if (!id) return;
    fetchPropertyById(id)
      .then(setPropertyData)
      .catch(() => setPropertyData(fallbackProperty));
    fetchProperties({ status: 'approved', limit: 4 })
      .then(({ properties }) => setSimilarProperties(properties.filter((p) => p.id !== id).slice(0, 3)))
      .catch(() => undefined);
  }, [fallbackProperty, id]);

  const {
    name, location, city, images, tags, type: propertyType,
    verified, superhost, bedrooms, bathrooms, maxGuests,
    description, amenities, roomTypes, housePolicies, addOns,
    categoryRatings, host, reviews: propertyReviews, rating,
    reviewCount, pricePerNight, originalPrice, scarcity, dayPackage,
  } = propertyData;

  const typedDayPackage = dayPackage
    ? {
        enabled: dayPackage.enabled === true,
        description: dayPackage.description ?? '',
        timing: dayPackage.timing ?? '',
        pricePerPerson: dayPackage.pricePerPerson ?? 0,
        meals: dayPackage.meals ?? [],
        activities: dayPackage.activities ?? [],
        facilities: dayPackage.facilities ?? [],
        image: dayPackage.image ?? '',
        packages: dayPackage.packages ?? [],
      }
    : undefined;
  const hasDayPackage = typedDayPackage?.enabled === true;
  const normalizedRoomTypes = (roomTypes ?? []).map((room) => ({
    ...room,
    photos: room.photos ?? [],
    amenities: room.amenities ?? [],
  }));

  const similarMock = similarProperties.map((s) => {
    const mock = mockProperties.find((m) => m.id === s.id);
    return mock ?? { ...mockProperties[0], id: s.id, name: s.name, location: s.location, pricePerNight: s.pricePerNight, rating: s.rating, reviewCount: s.reviewCount, images: s.images, tags: s.tags, amenities: s.amenities, type: s.type as typeof mockProperties[0]['type'], verified: s.verified, superhost: s.superhost, bedrooms: s.bedrooms, bathrooms: s.bathrooms, maxGuests: s.maxGuests, description: s.description, categoryRatings: s.categoryRatings, host: { name: s.host.name, avatar: s.host.avatar, joinedYear: s.host.joinedYear, superhost: s.host.superhost }, addOns: [], distanceKm: 10 };
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'staypackage'>(
    searchParams.get('tab') === 'staypackage' ? 'staypackage' : 'overview'
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'staypackage') {
      setActiveTab('staypackage');
      setTimeout(() => {
        const el = document.getElementById('property-tabs');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } else if (tab === 'daypackage' && hasDayPackage) {
      setActiveTab('overview');
      setTimeout(() => {
        const el = document.getElementById('day-package-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [searchParams, hasDayPackage]);

  // Keep URL query string in sync with the active tab so reloads + back button
  // preserve the selection consistently across properties.
  useEffect(() => {
    const current = searchParams.get('tab');
    if (activeTab === 'staypackage' && current !== 'staypackage') {
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'staypackage');
      setSearchParams(next, { replace: true });
    } else if (activeTab === 'overview' && current === 'staypackage') {
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  const [showDayModal, setShowDayModal] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [liked, setLiked] = useState(false);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const minCheckOut = checkIn || today;
  const [guests, setGuests] = useState(2);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [availableRooms, setAvailableRooms] = useState<number | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const toggleAddOn = (addOnId: string) =>
    setSelectedAddOns((prev) => prev.includes(addOnId) ? prev.filter((x) => x !== addOnId) : [...prev, addOnId]);

  const selectedRoom = normalizedRoomTypes.find((r) => r.id === selectedRoomId) ?? null;
  const fallbackRoom = normalizedRoomTypes[0] ?? null;
  const activeRoom = selectedRoom ?? fallbackRoom;
  const effectivePrice = activeRoom ? activeRoom.pricePerNight : pricePerNight;
  const roomCapacity = activeRoom?.capacity ?? maxGuests;
  const guestLimit = maxGuests;
  const roomsRequired = Math.max(1, Math.ceil(guests / Math.max(1, roomCapacity)));

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId((prev) => {
      const next = prev === roomId ? null : roomId;
      // On mobile/tablet the booking widget stacks far below the room list, so
      // auto-scroll the guest down to the Reserve Now widget once they pick a room.
      if (next && typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
        setTimeout(() => {
          document.getElementById('reserve-widget')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
      return next;
    });
  };

  const addOnTotal = addOns.filter((a) => selectedAddOns.includes(a.id)).reduce((s, a) => s + a.price, 0);
  const nights = checkIn && checkOut ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 1;
  const subtotal = effectivePrice * roomsRequired * nights;
  const total = subtotal + addOnTotal;

  useEffect(() => {
    const roomIdForAvailability = activeRoom?.id;
    if (!roomIdForAvailability || !checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
      setAvailableRooms(null);
      return;
    }

    let cancelled = false;
    setAvailabilityLoading(true);
    apiFetch<{ availableRooms: number; bookedRooms: number; totalRooms: number; isAvailable: boolean }>(
      `/inventory/availability?roomId=${encodeURIComponent(roomIdForAvailability)}&propertyId=${encodeURIComponent(propertyData.id)}&startDate=${encodeURIComponent(checkIn)}&endDate=${encodeURIComponent(checkOut)}`
    )
      .then((summary) => {
        if (!cancelled) setAvailableRooms(typeof summary.availableRooms === 'number' ? summary.availableRooms : null);
      })
      .catch(() => {
        if (!cancelled) setAvailableRooms(null);
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRoom?.id, checkIn, checkOut, propertyData.id]);

  const amenityIcons: Record<string, string> = {
    'Pool': 'ri-water-percent-line', 'WiFi': 'ri-wifi-line', 'AC': 'ri-temp-cold-line',
    'Parking': 'ri-car-line', 'Spa': 'ri-leaf-line', 'Chef on Request': 'ri-restaurant-line',
    'Fireplace': 'ri-fire-line', 'Gym': 'ri-run-line', 'Jacuzzi': 'ri-drop-line',
    'Beach Access': 'ri-anchor-line', 'Mountain View': 'ri-landscape-line', 'BBQ': 'ri-fire-line',
    'Yoga Deck': 'ri-mental-health-line', 'Bonfire': 'ri-fire-line', 'Kayaks': 'ri-sailboat-line',
    'Private Beach': 'ri-anchor-line', 'Infinity Pool': 'ri-water-percent-line', 'Ocean View': 'ri-landscape-line',
    'Bar': 'ri-goblet-line', 'Restaurant': 'ri-restaurant-line', 'Rooftop': 'ri-building-line',
    'Concierge': 'ri-service-line', 'Butler Service': 'ri-service-line', 'Daily Housekeeping': 'ri-brush-line',
    'Heating': 'ri-temp-hot-line', 'Trekking Guide': 'ri-walk-line', 'Safari Tours': 'ri-compass-3-line',
    'Chef On Board': 'ri-restaurant-line', 'Fishing Kit': 'ri-seedling-line', 'Canoe Tour': 'ri-sailboat-line',
    'Private Deck': 'ri-home-8-line', 'Lake View': 'ri-landscape-line', 'Fine Dining': 'ri-restaurant-2-line',
    'Sauna': 'ri-fire-line', 'Smart TV': 'ri-tv-2-line', 'Organic Breakfast': 'ri-cup-line',
    'Coffee Tour': 'ri-cup-line', 'Nature Trail': 'ri-walk-line', 'Birdwatching': 'ri-eye-line',
  };

  const displayedAmenities = showAllAmenities ? amenities : amenities.slice(0, 9);
  const ratingBars = [
    { label: 'Cleanliness', value: categoryRatings.cleanliness },
    { label: 'Communication', value: categoryRatings.communication },
    { label: 'Check-in', value: categoryRatings.checkIn },
    { label: 'Accuracy', value: categoryRatings.accuracy },
    { label: 'Location', value: categoryRatings.location },
    { label: 'Value', value: categoryRatings.value },
  ];
  const isStayPackageTab = (tab: typeof activeTab) => tab === 'staypackage';

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Gallery */}
      <div className="pt-20">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-6">
          {/* Back to Day Outing banner */}
          {searchParams.get('tab') === 'daypackage' && (
            <div className="flex items-center justify-between mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 text-amber-800 text-sm">
                <i className="ri-sun-line text-amber-500" />
                <span className="font-medium">You came here from Day Outing</span>
                <span className="text-amber-600 text-xs hidden sm:inline">— viewing the day package for this property</span>
              </div>
              <button
                onClick={() => navigate('/day-outing')}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-full hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-arrow-left-s-line" /> Back to Day Outing
              </button>
            </div>
          )}
          <nav className="flex items-center gap-2 text-xs text-stone-500 mb-4 flex-wrap">
            <button onClick={() => navigate('/')} className="hover:text-stone-900 cursor-pointer">Home</button>
            <i className="ri-arrow-right-s-line" />
            <button onClick={() => navigate('/search')} className="hover:text-stone-900 cursor-pointer">{city}</button>
            <i className="ri-arrow-right-s-line" />
            <span className="text-stone-900 font-medium truncate">{name}</span>
          </nav>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-2xl overflow-hidden h-[300px] md:h-[480px] relative">
            <div className="md:col-span-2 md:row-span-2 relative cursor-pointer" onClick={() => { setGalleryIdx(0); setGalleryOpen(true); }}>
              <img src={images[0]} alt={name} className="w-full h-full object-cover object-top hover:brightness-90 transition-all" />
            </div>
            {images.slice(1, 5).map((img, i) => (
              <div key={i} className="hidden md:block relative cursor-pointer" onClick={() => { setGalleryIdx(i + 1); setGalleryOpen(true); }}>
                <img src={img} alt="" className="w-full h-full object-cover object-top hover:brightness-90 transition-all" />
                {i === 3 && images.length > 5 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">+{images.length - 5} photos</span>
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setGalleryOpen(true)} className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm text-stone-900 text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-1.5 hover:bg-white transition-colors whitespace-nowrap cursor-pointer">
              <i className="ri-image-2-line" /> View all {images.length} photos
            </button>
            <button onClick={() => setLiked(!liked)} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full cursor-pointer hover:scale-110 transition-transform">
              <i className={`${liked ? 'ri-heart-fill text-red-500' : 'ri-heart-line text-stone-700'}`} />
            </button>
            {/* Share Button */}
            <div className="absolute top-4 right-16">
              <button
                onClick={() => setShowSharePanel((v) => !v)}
                className="w-10 h-10 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full cursor-pointer hover:scale-110 transition-transform"
              >
                <i className="ri-share-line text-stone-700" />
              </button>
              {showSharePanel && (
                <div className="absolute top-12 right-0 bg-white rounded-2xl border border-stone-200 p-4 w-60 z-20">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Share This Property</p>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        const url = window.location.href;
                        const text = `Check out ${name} on Triprodeo! ${url}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                        setShowSharePanel(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer text-left"
                    >
                      <div className="w-8 h-8 flex items-center justify-center bg-emerald-500 rounded-full shrink-0">
                        <i className="ri-whatsapp-line text-white text-sm" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-900">Share on WhatsApp</p>
                        <p className="text-xs text-stone-400">Send to friends & groups</p>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        const url = window.location.href;
                        navigator.clipboard.writeText(url).then(() => {
                          setShareCopied(true);
                          setTimeout(() => { setShareCopied(false); setShowSharePanel(false); }, 2000);
                        });
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer text-left"
                    >
                      <div className="w-8 h-8 flex items-center justify-center bg-stone-900 rounded-full shrink-0">
                        <i className={`${shareCopied ? 'ri-check-line' : 'ri-file-copy-line'} text-white text-sm`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{shareCopied ? 'Link Copied!' : 'Copy Link'}</p>
                        <p className="text-xs text-stone-400">Share anywhere</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {galleryOpen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between p-4">
            <span className="text-white/70 text-sm">{galleryIdx + 1} / {images.length}</span>
            <button onClick={() => setGalleryOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full cursor-pointer">
              <i className="ri-close-line text-white text-xl" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center relative px-12">
            <button onClick={() => setGalleryIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-4 w-10 h-10 flex items-center justify-center bg-white/10 rounded-full cursor-pointer hover:bg-white/20">
              <i className="ri-arrow-left-s-line text-white text-xl" />
            </button>
            <img src={images[galleryIdx]} alt="" className="max-h-full max-w-full object-contain rounded-xl" />
            <button onClick={() => setGalleryIdx((i) => (i + 1) % images.length)} className="absolute right-4 w-10 h-10 flex items-center justify-center bg-white/10 rounded-full cursor-pointer hover:bg-white/20">
              <i className="ri-arrow-right-s-line text-white text-xl" />
            </button>
          </div>
          <div className="flex gap-2 p-4 flex-wrap justify-center">
            {images.map((img, i) => (
              <img key={i} src={img} alt="" onClick={() => setGalleryIdx(i)} className={`w-16 h-12 object-cover rounded-lg cursor-pointer transition-all ${galleryIdx === i ? 'ring-2 ring-white' : 'opacity-50'}`} />
            ))}
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          <div className={`${activeTab === 'staypackage' ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-10`}>

            {/* Tab Nav */}
            <div id="property-tabs" className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
              {([
                { id: 'overview' as const, label: 'Overview', icon: 'ri-home-3-line' },
                { id: 'staypackage' as const, label: 'Stay Package', icon: 'ri-hotel-bed-line' },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${activeTab === t.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  <i className={t.icon} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Day Package Content */}
            {activeTab === 'overview' && hasDayPackage && typedDayPackage && (
              <div id="day-package-section">
                <DayPackageSection dayPackage={typedDayPackage} propertyId={propertyData.id} propertyName={name} />
              </div>
            )}

            {/* Overview Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-10">
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h1 className="text-2xl md:text-3xl font-bold text-stone-900" style={{ fontFamily: "'Playfair Display', serif" }}>{name}</h1>
                    {verified && (
                      <div className="flex items-center gap-1 shrink-0 bg-sky-50 text-sky-600 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap">
                        <i className="ri-verified-badge-fill" />Verified
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
                    <span className="flex items-center gap-1"><i className="ri-map-pin-line text-stone-400" />{location}</span>
                    <span className="flex items-center gap-1"><i className="ri-star-fill text-amber-400" /><strong>{rating}</strong><span className="text-stone-400">({reviewCount} reviews)</span></span>
                    <span className="text-stone-400">·</span>
                    <span>{bedrooms} beds · {bathrooms} baths · up to {guestLimit} guests</span>
                  </div>
                  {superhost && (
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                      <i className="ri-award-line" />Top Owner
                    </div>
                  )}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {tags.map((tag) => (
                        <span key={tag} className="px-3 py-1 bg-stone-100 text-stone-600 text-xs rounded-full font-medium">{tag}</span>
                      ))}
                    </div>
                  )}
                  {hasDayPackage && (
                    <button onClick={() => document.getElementById('day-package-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mt-3 flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-full hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-sun-line" /> Day Package Available — &#x20B9;{typedDayPackage!.pricePerPerson.toLocaleString('en-IN')}/person · View Details
                    </button>
                  )}
                </div>

                {/* Description */}
                <div className="border-t border-stone-100 pt-8">
                  <h2 className="text-xl font-bold text-stone-900 mb-4">About This Property</h2>
                  <p className={`text-stone-600 text-sm leading-relaxed ${!expandedDesc ? 'line-clamp-4' : ''}`}>{description}</p>
                  <button onClick={() => setExpandedDesc(!expandedDesc)} className="mt-2 text-stone-900 text-sm font-semibold underline cursor-pointer">
                    {expandedDesc ? 'Show less' : 'Read more'}
                  </button>
                  <div className="mt-6 flex items-center gap-4 p-4 bg-stone-50 rounded-2xl">
                    <img src={host.avatar} alt={host.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-stone-900">{host.name}</p>
                      <p className="text-stone-500 text-xs">Owner since {host.joinedYear}{host.superhost ? ' · Top Owner' : ''}</p>
                    </div>
                    <button className="px-4 py-2 border border-stone-300 rounded-full text-xs font-medium hover:bg-stone-100 transition-colors cursor-pointer whitespace-nowrap">Contact Travel Planner</button>
                  </div>
                </div>

                {/* Amenities */}
                <div className="border-t border-stone-100 pt-8">
                  <h2 className="text-xl font-bold text-stone-900 mb-5">What This Place Offers</h2>
                  {amenities.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {displayedAmenities.map((amenity) => (
                          <div key={amenity} className="flex items-center gap-2.5 text-sm text-stone-700">
                            <div className="w-7 h-7 flex items-center justify-center bg-stone-100 rounded-lg shrink-0">
                              <i className={`${amenityIcons[amenity] || 'ri-checkbox-circle-line'} text-stone-600 text-sm`} />
                            </div>
                            {amenity}
                          </div>
                        ))}
                      </div>
                      {amenities.length > 9 && (
                        <button onClick={() => setShowAllAmenities(!showAllAmenities)} className="mt-5 px-5 py-2 border border-stone-300 rounded-full text-sm font-medium hover:bg-stone-50 cursor-pointer transition-colors whitespace-nowrap">
                          {showAllAmenities ? 'Show less' : `Show all ${amenities.length} amenities`}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-stone-400 text-sm">No amenities listed for this property.</p>
                  )}
                </div>

                {isStayPackageTab(activeTab) && (
                  <>
                {/* Add-ons */}
                {addOns.length > 0 && (
                  <div className="border-t border-stone-100 pt-8">
                    <h2 className="text-xl font-bold text-stone-900 mb-2">Enhance Your Stay</h2>
                    <p className="text-stone-500 text-sm mb-5">Optional extras to make your trip unforgettable</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {addOns.map((addon) => {
                        const selected = selectedAddOns.includes(addon.id);
                        return (
                          <div key={addon.id} className={`rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${selected ? 'border-stone-900' : 'border-stone-100 hover:border-stone-300'}`} onClick={() => toggleAddOn(addon.id)}>
                            <div className="relative h-28 overflow-hidden">
                              <img src={addon.image} alt={addon.name} className="w-full h-full object-cover object-top" />
                              {selected && <div className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-stone-900 rounded-full"><i className="ri-check-line text-white text-sm" /></div>}
                            </div>
                            <div className="p-3">
                              <p className="font-semibold text-stone-900 text-sm">{addon.name}</p>
                              <p className="text-stone-500 text-xs mt-0.5 line-clamp-2">{addon.description}</p>
                              <p className="text-stone-900 font-bold text-sm mt-2">+&#x20B9;{addon.price.toLocaleString('en-IN')}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pricing Breakdown */}
                <div className="border-t border-stone-100 pt-8">
                  <h2 className="text-xl font-bold text-stone-900 mb-5">Pricing Details</h2>
                  <div className="bg-stone-50 rounded-2xl p-5 space-y-3">
                    {selectedRoom && (
                      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-xl mb-2">
                        <i className="ri-hotel-bed-line" /><span>Showing price for: <strong>{selectedRoom.name}</strong></span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-stone-700">
                      <span>&#x20B9;{effectivePrice.toLocaleString('en-IN')} &times; {roomsRequired} room{roomsRequired > 1 ? 's' : ''} &times; {nights} night{nights > 1 ? 's' : ''}</span>
                      <span>&#x20B9;{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    {addOnTotal > 0 && (
                      <div className="flex justify-between text-sm text-stone-700"><span>Add-ons</span><span>&#x20B9;{addOnTotal.toLocaleString('en-IN')}</span></div>
                    )}
                    <div className="border-t border-stone-200 pt-3 flex justify-between font-bold text-stone-900"><span>Total</span><span>&#x20B9;{total.toLocaleString('en-IN')}</span></div>
                    <p className="text-xs text-emerald-600 flex items-center gap-1.5 pt-1"><i className="ri-shield-check-line" />No hidden charges — price is final</p>
                  </div>
                </div>

                {/* House Policies */}
                <PropertyPolicies propertyType={propertyType} housePolicies={housePolicies} />

                {/* Availability Calendar */}
                <PropertyAvailabilityCalendar propertyId={propertyData.id} roomId={activeRoom?.id ?? undefined} checkIn={checkIn} checkOut={checkOut} onCheckInChange={setCheckIn} onCheckOutChange={setCheckOut} />
                  </>
                )}

                {/* Reviews */}
                <div className="border-t border-stone-100 pt-8">
                  <h2 className="text-xl font-bold text-stone-900 mb-5 flex items-center gap-2">
                    <i className="ri-star-fill text-amber-400" />{rating} · {reviewCount} reviews
                  </h2>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8">
                    {ratingBars.map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-sm text-stone-600 w-32 shrink-0">{label}</span>
                        <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                          <div className="h-full bg-stone-900 rounded-full" style={{ width: `${(value / 5) * 100}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-stone-900 w-8 text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                  {propertyReviews.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {propertyReviews.map((review) => (
                        <div key={review.id} className="bg-stone-50 rounded-2xl p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <img src={review.avatar} alt={review.user} className="w-10 h-10 rounded-full object-cover shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-stone-900 text-sm">{review.user}</p>
                              <p className="text-stone-400 text-xs">{review.location} · {review.date}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {Array.from({ length: review.rating }).map((_, i) => (
                                <i key={i} className="ri-star-fill text-amber-400 text-xs" />
                              ))}
                            </div>
                          </div>
                          <p className="text-stone-600 text-sm leading-relaxed line-clamp-4">{review.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Map */}
                <div className="border-t border-stone-100 pt-8">
                  <h2 className="text-xl font-bold text-stone-900 mb-2">Location</h2>
                  <p className="text-stone-500 text-sm mb-4 flex items-center gap-1.5"><i className="ri-map-pin-line text-stone-400" />{location}</p>
                  <div className="rounded-2xl overflow-hidden h-64 bg-stone-100">
                    <iframe
                      title={`${name} location`}
                      src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15000!2d${city === 'Goa' ? '73.9' : city === 'Manali' ? '77.1' : city === 'Udaipur' ? '73.6' : '78.9'}!3d${city === 'Goa' ? '15.5' : city === 'Manali' ? '32.2' : city === 'Udaipur' ? '24.5' : '22.5'}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sin!4v1`}
                      className="w-full h-full border-0" allowFullScreen loading="lazy"
                    />
                  </div>
                </div>

                {/* Similar */}
                <div className="border-t border-stone-100 pt-8">
                  <h2 className="text-xl font-bold text-stone-900 mb-5">You Might Also Like</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {similarMock.map((p) => <PropertyCard key={p.id} property={p} />)}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'staypackage' && (
              <div className="space-y-10">
                <RoomTypesSection roomTypes={normalizedRoomTypes} selectedRoomId={selectedRoomId} onSelect={handleRoomSelect} />

                {addOns.length > 0 && (
                  <div className="border-t border-stone-100 pt-8">
                    <h2 className="text-xl font-bold text-stone-900 mb-2">Enhance Your Stay</h2>
                    <p className="text-stone-500 text-sm mb-5">Optional extras to make your trip unforgettable</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {addOns.map((addon) => {
                        const selected = selectedAddOns.includes(addon.id);
                        return (
                          <div key={addon.id} className={`rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${selected ? 'border-stone-900' : 'border-stone-100 hover:border-stone-300'}`} onClick={() => toggleAddOn(addon.id)}>
                            <div className="relative h-28 overflow-hidden">
                              <img src={addon.image} alt={addon.name} className="w-full h-full object-cover object-top" />
                              {selected && <div className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-stone-900 rounded-full"><i className="ri-check-line text-white text-sm" /></div>}
                            </div>
                            <div className="p-3">
                              <p className="font-semibold text-stone-900 text-sm">{addon.name}</p>
                              <p className="text-stone-500 text-xs mt-0.5 line-clamp-2">{addon.description}</p>
                              <p className="text-stone-900 font-bold text-sm mt-2">+&#x20B9;{addon.price.toLocaleString('en-IN')}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="border-t border-stone-100 pt-8">
                  <h2 className="text-xl font-bold text-stone-900 mb-5">Pricing Details</h2>
                  <div className="bg-stone-50 rounded-2xl p-5 space-y-3">
                    {selectedRoom && (
                      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-xl mb-2">
                        <i className="ri-hotel-bed-line" /><span>Showing price for: <strong>{selectedRoom.name}</strong></span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-stone-700">
                      <span>&#x20B9;{effectivePrice.toLocaleString('en-IN')} &times; {roomsRequired} room{roomsRequired > 1 ? 's' : ''} &times; {nights} night{nights > 1 ? 's' : ''}</span>
                      <span>&#x20B9;{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    {addOnTotal > 0 && (
                      <div className="flex justify-between text-sm text-stone-700"><span>Add-ons</span><span>&#x20B9;{addOnTotal.toLocaleString('en-IN')}</span></div>
                    )}
                    <div className="border-t border-stone-200 pt-3 flex justify-between font-bold text-stone-900"><span>Total</span><span>&#x20B9;{total.toLocaleString('en-IN')}</span></div>
                    <p className="text-xs text-emerald-600 flex items-center gap-1.5 pt-1"><i className="ri-shield-check-line" />No hidden charges - price is final</p>
                  </div>
                </div>

                <PropertyPolicies propertyType={propertyType} housePolicies={housePolicies} />
                <PropertyAvailabilityCalendar propertyId={propertyData.id} roomId={activeRoom?.id ?? undefined} checkIn={checkIn} checkOut={checkOut} onCheckInChange={setCheckIn} onCheckOutChange={setCheckOut} />
              </div>
            )}
          </div>

          {/* Booking Widget */}
          {activeTab === 'staypackage' && (
          <div className="lg:col-span-1" id="reserve-widget">
            <div className="sticky top-28">
              <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-stone-900">&#x20B9;{effectivePrice.toLocaleString('en-IN')}</span>
                    <span className="text-stone-500 text-sm">/ night</span>
                    {originalPrice && !activeRoom && <span className="text-stone-400 text-sm line-through ml-1">&#x20B9;{originalPrice.toLocaleString('en-IN')}</span>}
                  </div>
                  {activeRoom && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><i className="ri-hotel-bed-line" /> {activeRoom.name}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <i className="ri-star-fill text-amber-400 text-sm" />
                  <span className="text-sm font-semibold text-stone-900">{rating}</span>
                  <span className="text-stone-400 text-xs">({reviewCount} reviews)</span>
                </div>
                {normalizedRoomTypes.length > 0 && !selectedRoomId && (
                  <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-center gap-2">
                    <i className="ri-hotel-bed-line flex-shrink-0" />Select a room type below for exact pricing
                  </div>
                )}
                <div className="grid grid-cols-2 border border-stone-200 rounded-xl overflow-hidden">
                  <div className="p-3 border-r border-stone-200">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Check-in</p>
                    <input
                      type="date"
                      min={today}
                      value={checkIn}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCheckIn(val);
                        // Auto-bump check-out if it's now on/before the new check-in
                        if (val && checkOut && new Date(checkOut) <= new Date(val)) {
                          const next = new Date(val);
                          next.setDate(next.getDate() + 1);
                          setCheckOut(next.toISOString().split('T')[0]);
                        }
                      }}
                      className="w-full text-sm text-stone-900 outline-none bg-transparent"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Check-out</p>
                    <input type="date" min={minCheckOut} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full text-sm text-stone-900 outline-none bg-transparent" />
                  </div>
                </div>
                <div className="border border-stone-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Guests</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setGuests((g) => Math.max(1, g - 1))} className="w-8 h-8 flex items-center justify-center border border-stone-300 rounded-full cursor-pointer hover:bg-stone-50">
                      <i className="ri-subtract-line text-sm" />
                    </button>
                    <span className="text-stone-900 font-semibold text-sm flex-1 text-center">{guests} {guests === 1 ? 'Guest' : 'Guests'}</span>
                    <button onClick={() => setGuests((g) => Math.min(guestLimit, g + 1))} className="w-8 h-8 flex items-center justify-center border border-stone-300 rounded-full cursor-pointer hover:bg-stone-50">
                      <i className="ri-add-line text-sm" />
                    </button>
                  </div>
                  <p className="text-xs text-stone-500 mt-2">{roomsRequired} room{roomsRequired > 1 ? 's' : ''} required for {guests} guest{guests > 1 ? 's' : ''} · room count updates automatically</p>
                </div>
                {activeRoom && (
                  <div className={`px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    availableRooms === null
                      ? 'bg-amber-50 border border-amber-200 text-amber-700'
                      : availableRooms === 0
                      ? 'bg-red-50 border border-red-200 text-red-700'
                      : roomsRequired > availableRooms
                      ? 'bg-red-50 border border-red-200 text-red-600'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  }`}>
                    <i className={availabilityLoading ? 'ri-loader-4-line animate-spin' : 'ri-hotel-bed-line'} />
                    {availabilityLoading
                      ? 'Checking room inventory'
                      : availableRooms === null
                      ? 'Unable to verify room inventory'
                      : availableRooms === 0
                      ? 'SOLD OUT'
                      : `Only ${availableRooms} room${availableRooms === 1 ? '' : 's'} left`}
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-stone-700"><span>&#x20B9;{effectivePrice.toLocaleString('en-IN')} &times; {roomsRequired} room{roomsRequired > 1 ? 's' : ''} &times; {nights} nights</span><span>&#x20B9;{subtotal.toLocaleString('en-IN')}</span></div>
                  {addOnTotal > 0 && <div className="flex justify-between text-stone-700"><span>Add-ons</span><span>&#x20B9;{addOnTotal.toLocaleString('en-IN')}</span></div>}
                  <div className="border-t border-stone-200 pt-2 flex justify-between font-bold text-stone-900"><span>Total</span><span>&#x20B9;{total.toLocaleString('en-IN')}</span></div>
                </div>
                {(() => {
                  const datesValid = !!checkIn && !!checkOut && new Date(checkOut) > new Date(checkIn);
                  const inventoryOk = !activeRoom ? true : availableRooms !== null && roomsRequired <= availableRooms;
                  const canReserve = datesValid && inventoryOk && !availabilityLoading;
                  const missingMsg = !checkIn || !checkOut
                    ? 'Pick check-in and check-out dates'
                    : !datesValid
                    ? 'Check-out must be after check-in'
                    : !inventoryOk && availableRooms === null
                    ? 'Unable to verify room inventory right now'
                    : availableRooms === 0
                    ? 'SOLD OUT'
                    : !inventoryOk
                    ? `Only ${availableRooms} room${availableRooms === 1 ? '' : 's'} left for these dates`
                    : '';
                  return (
                    <>
                      <button
                        disabled={!canReserve}
                        onClick={() => navigate(`/booking/${propertyData.id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}&addOns=${selectedAddOns.join(',')}&room=${encodeURIComponent(activeRoom?.id ?? '')}`)}
                        className="w-full py-3.5 bg-stone-900 text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-stone-900"
                      >
                        {availableRooms === 0 ? 'SOLD OUT' : 'Reserve Now'}
                      </button>
                      {!canReserve && missingMsg && (
                        <p className="text-center text-amber-600 text-xs font-medium">{missingMsg}</p>
                      )}
                    </>
                  );
                })()}
                <p className="text-center text-stone-400 text-xs">You won&apos;t be charged yet</p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[{ icon: 'ri-refund-2-line', label: 'Free cancel' }, { icon: 'ri-flashlight-line', label: 'Instant confirm' }, { icon: 'ri-shield-keyhole-line', label: 'Secure pay' }].map(({ icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1 text-center">
                      <div className="w-8 h-8 flex items-center justify-center bg-emerald-50 rounded-full"><i className={`${icon} text-emerald-600 text-sm`} /></div>
                      <span className="text-xs text-stone-500">{label}</span>
                    </div>
                  ))}
                </div>
                {scarcity && (
                  <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs font-semibold px-3 py-2 rounded-full justify-center">
                    <i className="ri-time-line" />{scarcity} · Book before it&apos;s gone!
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
      <Footer />
      {showDayModal && hasDayPackage && typedDayPackage && (
        <DayPackageEnquiryModal
          propertyId={propertyData.id}
          propertyName={name}
          pricePerPerson={typedDayPackage.pricePerPerson}
          timing={typedDayPackage.timing}
          onClose={() => setShowDayModal(false)}
        />
      )}
    </div>
  );
}
