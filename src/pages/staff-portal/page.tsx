import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, setStaffSession, getStaffToken } from '@/lib/apiClient';
import { PERMISSIONS, hasPermission, normalizePermissions, permissionLabel } from '@/lib/permissions';

type StaffSession = {
  id: string;
  email: string;
  name: string;
  role?: string;
  permissions?: string[];
  propertyId?: string;
  token?: string;
  refreshToken?: string;
};

type StaffLoginResponse = {
  accessToken: string;
  refreshToken: string;
  staff: {
    id: string;
    email: string;
    name: string;
    role?: string;
    permissions?: string[];
    propertyId?: string;
    hasPortalAccess?: boolean;
  };
};

const MODULES = [
  { id: 'dashboard', label: 'Dashboard', permission: PERMISSIONS.DASHBOARD_VIEW, description: 'Overview, occupancy and daily tasks.' },
  { id: 'bookings', label: 'Bookings', permission: PERMISSIONS.BOOKING_VIEW, description: 'View reservations and guest details.' },
  { id: 'walkin', label: 'Walk-in Booking', permission: PERMISSIONS.BOOKING_CREATE, description: 'Create offline and reception bookings.' },
  { id: 'inventory', label: 'Inventory', permission: PERMISSIONS.INVENTORY_VIEW, description: 'Monitor room supply and stock levels.' },
  { id: 'reports', label: 'Reports', permission: PERMISSIONS.REPORTS_VIEW, description: 'Track operations and performance.' },
  { id: 'staff', label: 'Staff', permission: PERMISSIONS.STAFF_MANAGE, description: 'Manage team access and permissions.' },
  { id: 'property', label: 'Property Settings', permission: PERMISSIONS.PROPERTY_SETTINGS, description: 'Update property-level controls.' },
];

export default function StaffPortalPage() {
  const [staff, setStaff] = useState<StaffSession | null>(() => {
    try {
      const raw = sessionStorage.getItem('triprodeo_staff_auth');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StaffSession;
      return parsed.id && parsed.email ? parsed : null;
    } catch {
      return null;
    }
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const permissions = useMemo(() => normalizePermissions(staff?.permissions ?? []), [staff?.permissions]);
  const visibleModules = MODULES.filter((module) => hasPermission(permissions, module.permission));

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Enter your staff email and password.');
      return;
    }

    setLoading(true);
    setError('');
    apiFetch<StaffLoginResponse>('/auth/portal/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password: password.trim() }),
    })
      .then((result) => {
        setStaffSession({
          id: result.staff.id,
          email: result.staff.email,
          name: result.staff.name,
          token: result.accessToken,
          refreshToken: result.refreshToken,
          permissions: result.staff.permissions,
          propertyId: result.staff.propertyId,
          role: result.staff.role,
        });
        setStaff({
          id: result.staff.id,
          email: result.staff.email,
          name: result.staff.name,
          permissions: result.staff.permissions,
          propertyId: result.staff.propertyId,
          role: result.staff.role,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Login failed'))
      .finally(() => setLoading(false));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('triprodeo_staff_auth');
    sessionStorage.removeItem('triprodeo_staff_token');
    setStaff(null);
    setEmail('');
    setPassword('');
  };

  if (!staff || !getStaffToken()) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4">
        <Link to="/" className="mb-8 text-sm text-stone-500 hover:text-stone-900">
          <i className="ri-arrow-left-line mr-1" /> Back to Triprodeo
        </Link>
        <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-stone-900 flex items-center justify-center mb-4">
              <i className="ri-shield-user-line text-amber-400 text-2xl" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900">Staff Portal</h1>
            <p className="text-sm text-stone-500 mt-1">Sign in with your assigned permissions</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-400"
                placeholder="staff@property.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-400"
                placeholder="Password"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-stone-900 text-white font-semibold disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Enter Portal'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-20 bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-stone-900">{staff.name}</h1>
            <p className="text-xs text-stone-500">{staff.email}</p>
          </div>
          <button onClick={handleLogout} className="text-sm font-medium text-stone-600 hover:text-stone-900">
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleModules.map((module) => (
            <section key={module.id} className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">{module.label}</p>
              <h2 className="text-lg font-bold text-stone-900 mb-2">{module.description}</h2>
              <p className="text-sm text-stone-500">
                Permission: <span className="font-medium text-stone-700">{permissionLabel[module.permission]}</span>
              </p>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white p-6">
          <h3 className="text-base font-semibold text-stone-900 mb-2">Effective Permissions</h3>
          <div className="flex flex-wrap gap-2">
            {permissions.map((permission) => (
              <span key={permission} className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-700 text-xs font-medium">
                {permission}
              </span>
            ))}
          </div>
          {visibleModules.length === 0 && (
            <p className="text-sm text-stone-500 mt-3">No modules are enabled for this account yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
