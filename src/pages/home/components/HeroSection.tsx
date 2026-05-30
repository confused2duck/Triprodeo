import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCMSData, loadCMSData } from '@/pages/admin/cmsStore';
import { fetchPropertyLocations } from '@/services/propertiesApi';

export default function HeroSection() {
  const navigate = useNavigate();
  const [location, setLocation] = useState('');
  const [guests, setGuests] = useState('2 Guests');
  const [budget, setBudget] = useState('Any Budget');
  const [destinations, setDestinations] = useState<string[]>([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [hero, setHero] = useState(() => loadCMSData().hero);
  const today = new Date().toISOString().split('T')[0];
  const minCheckOut = checkIn || today;

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 80) setShowScrollHint(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    fetchPropertyLocations()
      .then(setDestinations)
      .catch(() => setDestinations([]));
  }, []);

  useEffect(() => {
    fetchCMSData()
      .then((data) => setHero(data.hero))
      .catch(() => undefined);
  }, []);

  const handleScrollHintClick = () => {
    setShowScrollHint(false);
    window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
  };

  const headlineLines = hero.headline.split('\n');

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (location) params.set('location', location);
    const guestCount = guests.match(/\d+/)?.[0];
    if (guestCount) params.set('guests', guestCount);
    if (budget) params.set('budget', budget);
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    navigate(`/search?${params}`);
  };

  return (
    <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={hero.backgroundImage}
          alt="Travel background"
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full flex flex-col items-center px-4 pt-20">
        {/* Tag */}
        <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
          <i className="ri-ai-generate text-amber-300 text-sm" />
          <span className="text-white/90 text-xs font-medium">{hero.badgeText}</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white text-center leading-tight mb-4 max-w-4xl" style={{ fontFamily: "'Playfair Display', serif" }}>
          {headlineLines[0]}
          {headlineLines[1] && (
            <>
              <br />
              <span className="text-amber-300">{headlineLines.slice(1).join(' ')}</span>
            </>
          )}
        </h1>
        <p className="text-white/80 text-base md:text-lg text-center mb-10 max-w-xl leading-relaxed">
          {hero.subheadline}
        </p>

        {/* Search Card */}
        <div className="w-full max-w-5xl bg-white rounded-2xl md:rounded-3xl shadow-2xl p-4 md:p-6">
          {/* Mobile: 2-col grid layout */}
          <div className="grid grid-cols-2 gap-3 md:hidden mb-3">
            <div className="col-span-2 border border-stone-200 rounded-xl px-3 py-2.5">
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-0.5">Where</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full text-stone-900 text-sm font-medium border-none outline-none bg-transparent cursor-pointer"
              >
                <option value="">Choose destination</option>
                {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="border border-stone-200 rounded-xl px-3 py-2.5">
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-0.5">Check-in</label>
              <input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full text-stone-900 text-sm font-medium border-none outline-none bg-transparent" />
            </div>
            <div className="border border-stone-200 rounded-xl px-3 py-2.5">
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-0.5">Check-out</label>
              <input type="date" min={minCheckOut} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full text-stone-900 text-sm font-medium border-none outline-none bg-transparent" />
            </div>
            <div className="border border-stone-200 rounded-xl px-3 py-2.5">
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-0.5">Guests</label>
              <select value={guests} onChange={(e) => setGuests(e.target.value)} className="w-full text-stone-900 text-sm font-medium border-none outline-none bg-transparent cursor-pointer">
                {['1 Guest', '2 Guests', '3 Guests', '4 Guests', '5+ Guests'].map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="border border-stone-200 rounded-xl px-3 py-2.5">
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-0.5">Budget</label>
              <select value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full text-stone-900 text-sm font-medium border-none outline-none bg-transparent cursor-pointer">
                {['Any Budget', 'Under ₹5k', '₹5k–₹15k', '₹15k–₹30k', '₹30k+'].map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleSearch} className="md:hidden w-full flex items-center justify-center gap-2 px-7 py-3.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 transition-colors">
            <i className="ri-search-line" /> Search
          </button>

          {/* Desktop: horizontal divider layout */}
          <div className="hidden md:flex gap-0 divide-x divide-stone-200">
            <div className="flex-1 px-5 first:pl-0">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Where</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full text-stone-900 text-sm font-medium border-none outline-none bg-transparent cursor-pointer"
              >
                <option value="">Choose destination</option>
                {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex-1 px-5">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Check-in</label>
              <input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full text-stone-900 text-sm font-medium border-none outline-none bg-transparent" />
            </div>
            <div className="flex-1 px-5">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Check-out</label>
              <input type="date" min={minCheckOut} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full text-stone-900 text-sm font-medium border-none outline-none bg-transparent" />
            </div>
            <div className="flex-1 px-5">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Guests</label>
              <select value={guests} onChange={(e) => setGuests(e.target.value)} className="w-full text-stone-900 text-sm font-medium border-none outline-none bg-transparent cursor-pointer">
                {['1 Guest', '2 Guests', '3 Guests', '4 Guests', '5+ Guests'].map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex-1 px-5">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Budget</label>
              <select value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full text-stone-900 text-sm font-medium border-none outline-none bg-transparent cursor-pointer">
                {['Any Budget', 'Under ₹5k', '₹5k–₹15k', '₹15k–₹30k', '₹30k+'].map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="pl-5 flex items-end">
              <button onClick={handleSearch} className="flex items-center justify-center gap-2 px-7 py-3.5 bg-stone-900 text-white rounded-2xl text-sm font-semibold hover:bg-stone-800 transition-colors whitespace-nowrap">
                <i className="ri-search-line" /> Search
              </button>
            </div>
          </div>
        </div>

        {/* AI Planner teaser */}
        <div className="mt-5 flex items-center gap-2 text-white/70 text-sm">
          <i className="ri-magic-line text-amber-300" />
          <span>Not sure where to go?</span>
          <button
            onClick={() => navigate('/ai-planner')}
            className="text-amber-300 font-semibold hover:text-amber-200 transition-colors cursor-pointer underline-offset-2 hover:underline"
          >
            Try AI Trip Planner →
          </button>
        </div>

        {/* Stats */}
        <div className="mt-12 flex flex-col sm:flex-row gap-6 sm:gap-12 text-center">
          {hero.stats.map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>{stat.value}</div>
              <div className="text-white/60 text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      {showScrollHint && (
        <button
          type="button"
          onClick={handleScrollHintClick}
          aria-label="Scroll to explore"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce cursor-pointer"
        >
          <span className="text-white/50 text-xs">Scroll to explore</span>
          <i className="ri-arrow-down-line text-white/50" />
        </button>
      )}
    </section>
  );
}
