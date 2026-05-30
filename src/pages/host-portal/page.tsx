import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HostAccount, HostBooking, HostProperty, HostMessage, HostNotification, HostReview, Promotion, PACKAGE_ACCESS } from '@/pages/admin/types';
import { getHostMessages, getUnreadMessageCount, getHostNotifications, getUnreadNotificationCount, getHostReviews, getUnrepliedReviewCount, getHostPromotions } from '@/pages/admin/hostStore';
import HostPortalLogin from './HostPortalLogin';
import HostDashboardOverview from './components/HostDashboardOverview';
import HostPropertiesManager from './components/HostPropertiesManager';
import HostBookingsView from './components/HostBookingsView';
import HostPayoutsView from './components/HostPayoutsView';
import HostMessagesView from './components/HostMessagesView';
import HostNotificationsView from './components/HostNotificationsView';
import HostCalendarView from './components/HostCalendarView';
import HostReviewsView from './components/HostReviewsView';
import HostAnalyticsView from './components/HostAnalyticsView';
import HostSettingsView from './components/HostSettingsView';
import HostPromotionsView from './components/HostPromotionsView';
import HostGuestManagementView from './components/HostGuestManagementView';
import HostReportsView from './components/HostReportsView';
import HostPoliciesView from './components/HostPoliciesView';
import HostDayPackageView from './components/HostDayPackageView';
import HostAddOnsView from './components/HostAddOnsView';
import PropertyManagementView from './components/PropertyManagementView';
import type { PortalSession } from './HostPortalLogin';
import { getOwnerProperties, getHostBookings as fetchHostBookings } from '@/services/api';
import { setHostToken } from '@/lib/apiClient';
import { PERMISSIONS, hasPermission, normalizePermissions } from '@/lib/permissions';

type Section = 'dashboard' | 'properties' | 'add-property' | 'bookings' | 'payouts' | 'messages' | 'notifications' | 'calendar' | 'reviews' | 'analytics' | 'settings' | 'promotions' | 'guests' | 'reports' | 'policies' | 'day-package' | 'addons' | 'property-management';

type StoredPortalUser = {
  id: string;
  hostId: string;
  email: string;
  name: string;
  password?: string;
  phone?: string;
  createdAt?: string;
  status?: HostAccount['status'];
  avatar?: string;
  package?: HostAccount['package'];
  role: string;
  userType: 'owner' | 'staff';
  permissions: string[];
  propertyId?: string;
  token: string;
  refreshToken: string;
};

const normalizeHostProperty = (property: any): HostProperty => ({
  ...property,
  status: String(property.status ?? 'pending').toLowerCase(),
  images: Array.isArray(property.images) ? property.images : [],
  tags: Array.isArray(property.tags) ? property.tags : [],
  addOns: Array.isArray(property.addOns)
    ? property.addOns.map((addOn: any) => ({
        ...addOn,
        image: addOn.image ?? '',
        description: addOn.description ?? '',
      }))
    : [],
  roomTypes: Array.isArray(property.roomTypes)
    ? property.roomTypes.map((room: any) => ({
        ...room,
        photos: Array.isArray(room.photos) ? room.photos : Array.isArray(room.images) ? room.images : [],
        amenities: Array.isArray(room.amenities) ? room.amenities : [],
      }))
    : [],
});

const normalizeHostPropertiesResponse = (data: any): HostProperty[] => {
  const list = Array.isArray(data?.properties) ? data.properties : Array.isArray(data) ? data : [];
  return list.map(normalizeHostProperty);
};

const SECTION_PERMISSIONS: Partial<Record<Section, string>> = {
  dashboard: PERMISSIONS.DASHBOARD_VIEW,
  bookings: PERMISSIONS.BOOKING_VIEW,
  'property-management': PERMISSIONS.PROPERTY_SETTINGS,
  properties: PERMISSIONS.PROPERTY_SETTINGS,
  'add-property': PERMISSIONS.PROPERTY_SETTINGS,
  payouts: PERMISSIONS.PAYMENTS_VIEW,
  calendar: PERMISSIONS.BOOKING_VIEW,
  reviews: PERMISSIONS.REPORTS_VIEW,
  analytics: PERMISSIONS.REPORTS_VIEW,
  guests: PERMISSIONS.BOOKING_VIEW,
  promotions: PERMISSIONS.PROPERTY_SETTINGS,
  addons: PERMISSIONS.PROPERTY_SETTINGS,
  policies: PERMISSIONS.PROPERTY_SETTINGS,
  'day-package': PERMISSIONS.PROPERTY_SETTINGS,
  reports: PERMISSIONS.REPORTS_VIEW,
  messages: PERMISSIONS.GUEST_MESSAGES,
  notifications: PERMISSIONS.GUEST_MESSAGES,
  settings: PERMISSIONS.PROPERTY_SETTINGS,
};

export default function HostPortalPage() {
  const [host, setHost] = useState<StoredPortalUser | null>(() => {
    try {
      const stored = sessionStorage.getItem('triprodeo_host_auth');
      if (stored) {
        const { email, id, hostId, name, token, refreshToken, userType, permissions, role, propertyId, package: pkg, status, avatar, phone } = JSON.parse(stored);
        if (id && email && token) {
          if (refreshToken) {
            sessionStorage.setItem('triprodeo_host_auth', JSON.stringify({
              id,
              hostId: hostId || id,
              email,
              name: name || '',
              token,
              refreshToken,
              userType: userType || 'owner',
              permissions: Array.isArray(permissions) ? permissions : [],
              role: role || 'host',
              propertyId,
              package: pkg,
              status,
              avatar,
              phone,
            }));
          }
          return {
            id,
            hostId: hostId || id,
            email,
            name: name || '',
            password: '',
            phone: phone || '',
            createdAt: new Date().toISOString(),
            status: (status || 'active') as HostAccount['status'],
            avatar: avatar || '',
            package: (pkg || 'basic') as HostAccount['package'],
            role: (role || 'host') as string,
            userType: userType || 'owner',
            permissions: Array.isArray(permissions) ? permissions : [],
            propertyId,
            token,
            refreshToken,
          };
        }
      }
    } catch { /* ignore */ }
    return null;
  });

  const [section, setSection] = useState<Section>('dashboard');
  const [properties, setProperties] = useState<HostProperty[]>([]);
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [messages, setMessages] = useState<HostMessage[]>([]);
  const [notifications, setNotifications] = useState<HostNotification[]>([]);
  const [reviews, setReviews] = useState<HostReview[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unrepliedReviewCount, setUnrepliedReviewCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const ownerPackage = host?.package ?? 'basic';
  const ownerId = host?.hostId || host?.id || '';
  const permissions = normalizePermissions(host?.permissions ?? []);
  const allowedSections = host?.userType === 'staff'
    ? (Object.keys(SECTION_PERMISSIONS) as Section[]).filter((sectionId) => {
        const required = SECTION_PERMISSIONS[sectionId];
        return !required || hasPermission(permissions, required);
      })
    : PACKAGE_ACCESS[ownerPackage].sections;

  useEffect(() => {
    if (host) {
      getOwnerProperties(ownerId)
        .then((data) => setProperties(normalizeHostPropertiesResponse(data)))
        .catch(() => setProperties([]));
      
      fetchHostBookings(1, 100)
        .then((data: any) => {
          const bookingsList = data?.bookings ?? [];
          // Map backend response to HostBooking format
          const mapped = bookingsList.map((b: any) => ({
            id: b.id,
            propertyId: b.propertyId,
            propertyName: b.property?.name || 'Property',
            hostId: b.hostId,
            guestName: b.guestName,
            guestEmail: b.guestEmail,
            guestPhone: b.guestPhone,
            guestCount: b.guestCount ?? b.guests ?? 1,
            checkIn: typeof b.checkIn === 'string' ? b.checkIn : new Date(b.checkIn).toISOString().split('T')[0],
            checkOut: typeof b.checkOut === 'string' ? b.checkOut : new Date(b.checkOut).toISOString().split('T')[0],
            nights: b.nights ?? 1,
            pricePerNight: b.pricePerNight ?? 0,
            totalAmount: b.totalAmount ?? 0,
            platformFee: b.platformFee ?? 0,
            hostEarnings: b.hostEarnings ?? 0,
            status: String(b.status || 'pending').toLowerCase() as any,
            bookedAt: b.createdAt || new Date().toISOString(),
            paymentMethod: b.paymentMethod || 'CASH',
          }));
          setBookings(mapped);
        })
        .catch(() => setBookings([]));
      
      setMessages(getHostMessages(ownerId));
      setNotifications(getHostNotifications(ownerId));
      setReviews(getHostReviews(ownerId));
      setPromotions(getHostPromotions(ownerId));
      setUnreadCount(getUnreadMessageCount(ownerId));
      setUnreadNotifCount(getUnreadNotificationCount(ownerId));
      setUnrepliedReviewCount(getUnrepliedReviewCount(ownerId));
    }
  }, [host, ownerId]);

  const handleLogin = (loggedIn: PortalSession) => {
    setHost(loggedIn);
    const ownerId = loggedIn.hostId || loggedIn.id;
    getOwnerProperties(ownerId)
      .then((data) => setProperties(normalizeHostPropertiesResponse(data)))
      .catch(() => setProperties([]));
    
    fetchHostBookings(1, 100)
      .then((data: any) => {
        const bookingsList = data?.bookings ?? [];
        // Map backend response to HostBooking format
        const mapped = bookingsList.map((b: any) => ({
          id: b.id,
          propertyId: b.propertyId,
          propertyName: b.property?.name || 'Property',
          hostId: b.hostId,
          guestName: b.guestName,
          guestEmail: b.guestEmail,
          guestPhone: b.guestPhone,
          guestCount: b.guestCount ?? b.guests ?? 1,
          checkIn: typeof b.checkIn === 'string' ? b.checkIn : new Date(b.checkIn).toISOString().split('T')[0],
          checkOut: typeof b.checkOut === 'string' ? b.checkOut : new Date(b.checkOut).toISOString().split('T')[0],
          nights: b.nights ?? 1,
          pricePerNight: b.pricePerNight ?? 0,
          totalAmount: b.totalAmount ?? 0,
          platformFee: b.platformFee ?? 0,
          hostEarnings: b.hostEarnings ?? 0,
          status: String(b.status || 'pending').toLowerCase() as any,
          bookedAt: b.createdAt || new Date().toISOString(),
          paymentMethod: b.paymentMethod || 'CASH',
        }));
        setBookings(mapped);
      })
      .catch(() => setBookings([]));
    
    setMessages(getHostMessages(ownerId));
    setNotifications(getHostNotifications(ownerId));
    setReviews(getHostReviews(ownerId));
    setPromotions(getHostPromotions(ownerId));
    setUnreadCount(getUnreadMessageCount(ownerId));
    setUnreadNotifCount(getUnreadNotificationCount(ownerId));
    setUnrepliedReviewCount(getUnrepliedReviewCount(ownerId));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('triprodeo_host_auth');
    setHostToken(null);
    setHost(null);
  };

  const handleHostUpdate = (updated: HostAccount) => {
    setHost((current) => current ? ({ ...current, ...updated } as StoredPortalUser) : current);
    // refresh session storage with new data
    try {
      const current = sessionStorage.getItem('triprodeo_host_auth');
      const parsed = current ? JSON.parse(current) : {};
      sessionStorage.setItem('triprodeo_host_auth', JSON.stringify({
        hostId: host?.hostId || updated.id,
        email: updated.email,
        id: updated.id,
        name: updated.name,
        token: parsed.token || sessionStorage.getItem('triprodeo_host_token') || '',
        refreshToken: parsed.refreshToken || '',
        userType: host?.userType || 'owner',
        permissions: host?.permissions || [],
        role: host?.role || 'host',
        propertyId: host?.propertyId,
        package: updated.package,
        status: updated.status,
        avatar: updated.avatar,
        phone: updated.phone,
      }));
    } catch { /* ignore */ }
  };

  const handleMessagesUpdate = (updated: HostMessage[]) => {
    setMessages(updated);
    if (host) setUnreadCount(getUnreadMessageCount(ownerId));
  };

  const handleNotificationsUpdate = (updated: HostNotification[]) => {
    setNotifications(updated);
    if (host) setUnreadNotifCount(getUnreadNotificationCount(ownerId));
  };

  const handleReviewsUpdate = (updated: HostReview[]) => {
    setReviews(updated);
    if (host) setUnrepliedReviewCount(getUnrepliedReviewCount(ownerId));
  };

  const allNavItems: { id: Section; label: string; icon: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' },
    { id: 'properties', label: 'My Properties', icon: 'ri-building-line' },
    { id: 'property-management', label: 'Property Mgmt', icon: 'ri-building-4-line' },
    { id: 'bookings', label: 'Bookings & Earnings', icon: 'ri-calendar-check-line' },
    { id: 'payouts', label: 'Payouts', icon: 'ri-money-rupee-circle-line' },
    { id: 'calendar', label: 'Calendar', icon: 'ri-calendar-2-line' },
    { id: 'reviews', label: 'Reviews', icon: 'ri-star-line', badge: unrepliedReviewCount },
    { id: 'analytics', label: 'Analytics', icon: 'ri-bar-chart-box-line' },
    { id: 'guests', label: 'Guests', icon: 'ri-group-line' },
    { id: 'promotions', label: 'Promotions', icon: 'ri-price-tag-3-line' },
    { id: 'addons', label: 'Add-ons', icon: 'ri-gift-line' },
    { id: 'policies', label: 'House Policies', icon: 'ri-shield-check-line' },
    { id: 'day-package', label: 'Day Package', icon: 'ri-sun-line' },
    { id: 'reports', label: 'Reports', icon: 'ri-file-chart-line' },
    { id: 'messages', label: 'Messages', icon: 'ri-chat-3-line', badge: unreadCount },
    { id: 'notifications', label: 'Notifications', icon: 'ri-notification-3-line', badge: unreadNotifCount },
    { id: 'settings', label: 'Settings', icon: 'ri-settings-3-line' },
  ];

  const navItems = allNavItems.filter((item) => allowedSections.includes(item.id));

  if (!host) return <HostPortalLogin onLogin={handleLogin} />;

  const handleNav = (s: string) => {
    setSection(s as Section);
    setMobileMenuOpen(false);
  };

  const renderSection = () => {
    switch (section) {
      case 'dashboard':
        return <HostDashboardOverview host={host as HostAccount} bookings={bookings} properties={properties} onNav={handleNav} />;
      case 'properties':
      case 'add-property':
        return (
          <HostPropertiesManager
            hostId={ownerId}
            properties={properties}
            onUpdate={(updated) => setProperties(updated)}
          />
        );
      case 'calendar':
        return <HostCalendarView hostId={ownerId} properties={properties} bookings={bookings} />;
      case 'reviews':
        return <HostReviewsView hostId={ownerId} reviews={reviews} properties={properties} onUpdate={handleReviewsUpdate} />;
      case 'analytics':
        return <HostAnalyticsView hostId={ownerId} bookings={bookings} properties={properties} reviews={reviews} />;
      case 'bookings':
        return <HostBookingsView bookings={bookings} properties={properties} hostId={ownerId} canCreateBooking={host?.userType !== 'staff' || hasPermission(permissions, PERMISSIONS.BOOKING_CREATE)} onBookingCreated={(booking) => setBookings((current) => [booking, ...current])} />;
      case 'payouts':
        return <HostPayoutsView bookings={bookings} hostName={host.name} />;
      case 'messages':
        return <HostMessagesView hostId={ownerId} hostName={host.name} messages={messages} bookings={bookings} onMessagesUpdate={handleMessagesUpdate} />;
      case 'notifications':
        return <HostNotificationsView hostId={ownerId} notifications={notifications} onUpdate={handleNotificationsUpdate} />;
      case 'settings':
        return <HostSettingsView host={host as HostAccount} onHostUpdate={handleHostUpdate} />;
      case 'promotions':
        return (
          <HostPromotionsView
            hostId={ownerId}
            promotions={promotions}
            properties={properties}
            onUpdate={setPromotions}
          />
        );
      case 'guests':
        return (
          <HostGuestManagementView
            hostId={ownerId}
            bookings={bookings}
            properties={properties}
            reviews={reviews}
            messages={messages}
            onNav={handleNav}
          />
        );
      case 'policies':
        return (
          <HostPoliciesView
            hostId={ownerId}
            properties={properties}
            onUpdate={(updated) => setProperties(updated)}
          />
        );
      case 'addons':
        return (
          <HostAddOnsView
            hostId={ownerId}
            properties={properties}
            onUpdate={setProperties}
          />
        );
      case 'day-package':
        return <HostDayPackageView hostId={ownerId} />;
      case 'reports':
        return (
          <HostReportsView
            host={host as HostAccount}
            bookings={bookings}
            properties={properties}
            reviews={reviews}
          />
        );
      case 'property-management':
        return (
          <PropertyManagementView
            hostId={ownerId}
            properties={properties}
            onUpdate={(updated) => setProperties(updated)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Sidebar Navigation - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-stone-200 sticky top-0 h-screen z-30">
        {/* Logo */}
        <div className="p-4 border-b border-stone-100">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-stone-900 rounded-lg">
              <i className="ri-home-smile-line text-amber-400 text-sm" />
            </div>
            <div>
              <span className="font-bold text-stone-900 text-sm block leading-tight">Triprodeo</span>
              <span className="text-xs text-stone-400">Resort Owner Portal</span>
            </div>
          </Link>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                section === item.id || (section === 'add-property' && item.id === 'properties')
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${
                section === item.id || (section === 'add-property' && item.id === 'properties')
                  ? 'bg-white/10'
                  : 'bg-stone-100'
              }`}>
                <i className={item.icon} />
              </div>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] text-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-stone-100">
          <button
            onClick={() => handleNav('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              section === 'settings' ? 'bg-stone-100 text-stone-900' : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <div className="w-8 h-8 flex items-center justify-center bg-amber-100 rounded-lg">
              <i className="ri-user-line text-amber-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium truncate">{host.name}</p>
              <p className="text-xs text-stone-400 truncate">{host.email}</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl text-sm font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 flex items-center justify-center bg-stone-100 rounded-lg">
              <i className="ri-logout-box-r-line" />
            </div>
            <span>Sign Out</span>
          </button>
          {host && (
            <div className="mt-3 px-3">
              <span className={`inline-block text-xs font-bold px-2 py-1 rounded-full ${
                ownerPackage === 'premium' ? 'bg-emerald-100 text-emerald-700' :
                ownerPackage === 'standard' ? 'bg-amber-100 text-amber-700' :
                'bg-stone-100 text-stone-600'
              } capitalize`}>
                {ownerPackage} Plan
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <button className="text-stone-500 cursor-pointer" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <i className="ri-menu-line text-xl" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center bg-stone-900 rounded-lg">
              <i className="ri-home-smile-line text-amber-400 text-sm" />
            </div>
            <span className="font-bold text-stone-900 text-sm">Resort Owner Portal</span>
          </Link>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2 py-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-sm transition-colors cursor-pointer"
        >
          <i className="ri-logout-box-r-line" />
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMobileMenuOpen(false)}>
          <div className="bg-white w-72 h-full shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center bg-stone-900 rounded-lg">
                  <i className="ri-home-smile-line text-amber-400 text-sm" />
                </div>
                <span className="font-bold text-stone-900 text-sm">Triprodeo</span>
              </Link>
              <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-900 cursor-pointer">
                <i className="ri-close-line text-xl" />
              </button>
            </div>
            <div className="p-4 border-b border-stone-100 bg-stone-50">
              <p className="font-bold text-stone-900">{host.name}</p>
              <p className="text-stone-400 text-xs">{host.email}</p>
              {host && (
                <span className={`inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                  ownerPackage === 'premium' ? 'bg-emerald-100 text-emerald-700' :
                  ownerPackage === 'standard' ? 'bg-amber-100 text-amber-700' :
                  'bg-stone-100 text-stone-600'
                } capitalize`}>
                  {ownerPackage} Plan
                </span>
              )}
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    section === item.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${
                    section === item.id ? 'bg-white/10' : 'bg-stone-100'
                  }`}>
                    <i className={item.icon} />
                  </div>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] text-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-stone-100">
              <button
                onClick={() => { handleNav('settings'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  section === 'settings' ? 'bg-stone-100 text-stone-900' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <div className="w-8 h-8 flex items-center justify-center bg-amber-100 rounded-lg">
                  <i className="ri-user-line text-amber-600" />
                </div>
                <span>Settings</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl text-sm font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 flex items-center justify-center bg-stone-100 rounded-lg">
                  <i className="ri-logout-box-r-line" />
                </div>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-0 pt-16 lg:pt-0">
        <div className="max-w-5xl mx-auto w-full px-4 md:px-8 py-6 lg:py-8">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}
