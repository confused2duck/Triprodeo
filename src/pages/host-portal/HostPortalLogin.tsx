import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HostAccount } from '@/pages/admin/types';
import { apiFetch, setHostSession } from '@/lib/apiClient';
import { normalizePermissions } from '@/lib/permissions';

interface HostPortalLoginProps {
  onLogin: (session: PortalSession) => void;
}

export interface PortalSession {
  id: string;
  hostId: string;
  email: string;
  name: string;
  role: string;
  userType: 'owner' | 'staff';
  permissions: string[];
  propertyId?: string;
  token: string;
  refreshToken: string;
  package?: HostAccount['package'];
  status?: HostAccount['status'];
  avatar?: string | null;
  phone?: string | null;
}

interface HostLoginResponse {
  accessToken: string;
  refreshToken: string;
  session?: PortalSession;
  staff?: {
    id: string;
    hostId?: string;
    email: string;
    name: string;
    role?: string;
    permissions?: string[];
    propertyId?: string;
    hasPortalAccess?: boolean;
  };
  host: {
    id: string;
    email: string;
    name: string;
    package: HostAccount['package'];
    status: HostAccount['status'];
    avatar?: string | null;
    phone?: string | null;
    permissions?: string[];
  };
}

export default function HostPortalLogin({ onLogin }: HostPortalLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    apiFetch<HostLoginResponse>('/auth/portal/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password: password.trim() }),
    })
      .then((result) => {
        const session = result.session ?? (result.staff
          ? {
              id: result.staff.id,
              hostId: result.staff.hostId || result.staff.id,
              email: result.staff.email,
              name: result.staff.name,
              role: result.staff.role || 'staff',
              userType: 'staff' as const,
              permissions: normalizePermissions(result.staff.permissions ?? []),
              propertyId: result.staff.propertyId,
              token: result.accessToken,
              refreshToken: result.refreshToken,
            }
          : {
              id: result.host.id,
              hostId: result.host.id,
              email: result.host.email,
              name: result.host.name,
              role: 'host',
              userType: 'owner' as const,
              permissions: normalizePermissions(result.host.permissions ?? []),
              token: result.accessToken,
              refreshToken: result.refreshToken,
              package: result.host.package,
              status: result.host.status,
              avatar: result.host.avatar,
              phone: result.host.phone,
            });

        setHostSession(session);
        onLogin(session);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Incorrect email or password. Contact admin if you need access.');
        setLoading(false);
      });
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4">
      {/* Back to main site */}
      <Link to="/" className="flex items-center gap-2 text-stone-500 text-sm hover:text-stone-900 mb-8 transition-colors">
        <i className="ri-arrow-left-line" /> Back to Triprodeo
      </Link>

      <div className="w-full max-w-md">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 flex items-center justify-center bg-stone-900 rounded-2xl mx-auto mb-4">
            <i className="ri-home-smile-line text-amber-400 text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900" style={{ fontFamily: "'Playfair Display', serif" }}>
            Resort Owner Portal
          </h1>
            <p className="text-stone-500 text-sm mt-1">Sign in as owner or staff with portal access</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-800 outline-none focus:border-stone-400 transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-12 border border-stone-200 rounded-xl text-sm text-stone-800 outline-none focus:border-stone-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                <i className="ri-error-warning-line text-red-500 mt-0.5 shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-stone-100 text-center">
            <p className="text-stone-500 text-sm">
              Don&apos;t have owner access?{' '}
              <Link to="/resort-owner" className="text-stone-900 font-semibold hover:underline">
                Apply to become a Resort Owner
              </Link>
            </p>
          </div>
        </div>

        {/* Demo hint */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
          <p className="text-amber-700 text-xs">
            <i className="ri-information-line mr-1" />
            Demo: <strong>ananya@triprodeo.com</strong> / <strong>host1234</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
