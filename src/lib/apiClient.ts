// Shared API client for talking to the backend.
// VITE_API_URL can override this (e.g. for local dev pointing at a remote backend).
// Default: in the browser, use same-origin "/api" in production (any non-localhost host),
// and the local backend on :5000 during `vite dev`.

const defaultBase =
  typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? '/api'
    : 'http://localhost:5000/api';

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || defaultBase;

export const ADMIN_TOKEN_KEY = 'triprodeo_admin_token';
export const HOST_TOKEN_KEY = 'triprodeo_host_token';
export const STAFF_TOKEN_KEY = 'triprodeo_staff_token';
export const USER_TOKEN_KEY = 'triprodeo_user_token';
const USER_AUTH_KEY = 'triprodeo_user_auth';
const HOST_AUTH_KEY = 'triprodeo_host_auth';
const STAFF_AUTH_KEY = 'triprodeo_staff_auth';
const ADMIN_AUTH_KEY = 'triprodeo_admin_auth_session';

type StoredHostAuth = {
  id?: string;
  hostId?: string;
  email?: string;
  name?: string;
  role?: string;
  userType?: string;
  permissions?: string[];
  propertyId?: string;
  staffId?: string;
  token?: string;
  refreshToken?: string;
};

type StoredStaffAuth = {
  id?: string;
  email?: string;
  name?: string;
  token?: string;
  refreshToken?: string;
  permissions?: string[];
  propertyId?: string;
  role?: string;
};

export type StoredUserAuth = {
  id?: string;
  email?: string;
  name?: string;
  phone?: string;
  avatar?: string | null;
  token?: string;
  refreshToken?: string;
};

function isJwtLike(token: string | null | undefined): boolean {
  return typeof token === 'string' && token.split('.').length === 3;
}

export function clearUserSession(): void {
  sessionStorage.removeItem(USER_AUTH_KEY);
  sessionStorage.removeItem(USER_TOKEN_KEY);
}

function readStoredHostToken(): string | null {
  try {
    const raw = sessionStorage.getItem(HOST_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredHostAuth;
    return typeof parsed.token === 'string' && parsed.token.trim() ? parsed.token : null;
  } catch {
    return null;
  }
}

function readStoredHostRefreshToken(): string | null {
  try {
    const raw = sessionStorage.getItem(HOST_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredHostAuth;
    return typeof parsed.refreshToken === 'string' && parsed.refreshToken.trim() ? parsed.refreshToken : null;
  } catch {
    return null;
  }
}

function writeStoredHostAuth(patch: StoredHostAuth): void {
  try {
    const raw = sessionStorage.getItem(HOST_AUTH_KEY);
    const current = raw ? (JSON.parse(raw) as StoredHostAuth) : {};
    sessionStorage.setItem(HOST_AUTH_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Ignore storage errors.
  }
}

function readStoredStaffToken(): string | null {
  try {
    const raw = sessionStorage.getItem(STAFF_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredStaffAuth;
    return typeof parsed.token === 'string' && parsed.token.trim() ? parsed.token : null;
  } catch {
    return null;
  }
}

function readStoredStaffRefreshToken(): string | null {
  try {
    const raw = sessionStorage.getItem(STAFF_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredStaffAuth;
    return typeof parsed.refreshToken === 'string' && parsed.refreshToken.trim() ? parsed.refreshToken : null;
  } catch {
    return null;
  }
}

function readStoredUserRefreshToken(): string | null {
  try {
    const raw = sessionStorage.getItem(USER_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUserAuth;
    return typeof parsed.refreshToken === 'string' && parsed.refreshToken.trim() ? parsed.refreshToken : null;
  } catch {
    return null;
  }
}

function writeStoredStaffAuth(patch: StoredStaffAuth): void {
  try {
    const raw = sessionStorage.getItem(STAFF_AUTH_KEY);
    const current = raw ? (JSON.parse(raw) as StoredStaffAuth) : {};
    sessionStorage.setItem(STAFF_AUTH_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Ignore storage errors.
  }
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getHostToken(): string | null {
  return sessionStorage.getItem(HOST_TOKEN_KEY) ?? readStoredHostToken();
}

export function getStaffToken(): string | null {
  return sessionStorage.getItem(STAFF_TOKEN_KEY) ?? readStoredStaffToken();
}

export function getUserToken(): string | null {
  try {
    const raw = sessionStorage.getItem(USER_AUTH_KEY);
    const stored = raw ? (JSON.parse(raw) as StoredUserAuth) : {};
    const token = sessionStorage.getItem(USER_TOKEN_KEY) ?? stored.token ?? null;
    if (token && !isJwtLike(token)) {
      clearUserSession();
      return null;
    }
    return token;
  } catch {
    const token = sessionStorage.getItem(USER_TOKEN_KEY);
    if (token && !isJwtLike(token)) {
      clearUserSession();
      return null;
    }
    return token;
  }
}

export function getHostRefreshToken(): string | null {
  return readStoredHostRefreshToken();
}

export function getStaffRefreshToken(): string | null {
  return readStoredStaffRefreshToken();
}

export function getUserRefreshToken(): string | null {
  return readStoredUserRefreshToken();
}

export function setAdminToken(token: string | null): void {
  if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function setAdminSession(data: { token?: string | null; refreshToken?: string | null }): void {
  if (data.token !== undefined) setAdminToken(data.token);
  try {
    const raw = sessionStorage.getItem(ADMIN_AUTH_KEY);
    const current = raw ? (JSON.parse(raw) as { token?: string; refreshToken?: string }) : {};
    sessionStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify({
      ...current,
      ...(data.token !== undefined ? { token: data.token ?? undefined } : {}),
      ...(data.refreshToken !== undefined ? { refreshToken: data.refreshToken ?? undefined } : {}),
    }));
  } catch {
    // Ignore storage errors.
  }
}

export function getAdminRefreshToken(): string | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { refreshToken?: string };
    return typeof parsed.refreshToken === 'string' && parsed.refreshToken.trim() ? parsed.refreshToken : null;
  } catch {
    return null;
  }
}

export function clearAdminSession(): void {
  setAdminToken(null);
  sessionStorage.removeItem(ADMIN_AUTH_KEY);
  sessionStorage.removeItem('triprodeo_admin_auth');
}

export function setHostToken(token: string | null): void {
  if (token) sessionStorage.setItem(HOST_TOKEN_KEY, token);
  else sessionStorage.removeItem(HOST_TOKEN_KEY);
}

export function setStaffToken(token: string | null): void {
  if (token) sessionStorage.setItem(STAFF_TOKEN_KEY, token);
  else sessionStorage.removeItem(STAFF_TOKEN_KEY);
}

export function setUserToken(token: string | null): void {
  if (token) sessionStorage.setItem(USER_TOKEN_KEY, token);
  else sessionStorage.removeItem(USER_TOKEN_KEY);
}

export function setHostSession(data: StoredHostAuth): void {
  writeStoredHostAuth(data);
  if (data.token) setHostToken(data.token);
}

export function setStaffSession(data: StoredStaffAuth): void {
  writeStoredStaffAuth(data);
  if (data.token) setStaffToken(data.token);
}

export function setUserSession(data: StoredUserAuth | null): void {
  if (!data) {
    clearUserSession();
    return;
  }
  sessionStorage.setItem(USER_AUTH_KEY, JSON.stringify(data));
  if (data.token) setUserToken(data.token);
}

export function getUserSession(): StoredUserAuth | null {
  try {
    const raw = sessionStorage.getItem(USER_AUTH_KEY);
    const session = raw ? (JSON.parse(raw) as StoredUserAuth) : null;
    if (session?.token && !isJwtLike(session.token)) {
      clearUserSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function authHeader(): Record<string, string> {
  const t = getAdminToken() ?? getStaffToken() ?? getHostToken() ?? getUserToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function hostAuthHeader(): Record<string, string> {
  const t = getHostToken();
  if (t && !sessionStorage.getItem(HOST_TOKEN_KEY)) {
    sessionStorage.setItem(HOST_TOKEN_KEY, t);
  }
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function userAuthHeader(): Record<string, string> {
  const t = getUserToken();
  if (t && !sessionStorage.getItem(USER_TOKEN_KEY)) {
    sessionStorage.setItem(USER_TOKEN_KEY, t);
  }
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function refreshHostAccessToken(): Promise<string | null> {
  const refreshToken = getHostRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const raw = await res.json().catch(() => ({}));
  const data = (raw as { data?: { accessToken?: string; refreshToken?: string }; accessToken?: string; refreshToken?: string; message?: string });
  const accessToken = data.data?.accessToken ?? data.accessToken ?? null;
  const nextRefreshToken = data.data?.refreshToken ?? data.refreshToken ?? refreshToken;

  if (!res.ok || !accessToken) return null;

  setHostSession({ token: accessToken, refreshToken: nextRefreshToken });
  return accessToken;
}

async function refreshStaffAccessToken(): Promise<string | null> {
  const refreshToken = getStaffRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const raw = await res.json().catch(() => ({}));
  const data = (raw as { data?: { accessToken?: string; refreshToken?: string }; accessToken?: string; refreshToken?: string; message?: string });
  const accessToken = data.data?.accessToken ?? data.accessToken ?? null;
  const nextRefreshToken = data.data?.refreshToken ?? data.refreshToken ?? refreshToken;

  if (!res.ok || !accessToken) return null;

  setStaffSession({ token: accessToken, refreshToken: nextRefreshToken });
  return accessToken;
}

async function refreshUserAccessToken(): Promise<string | null> {
  const refreshToken = getUserRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const raw = await res.json().catch(() => ({}));
  const data = (raw as { data?: { accessToken?: string; refreshToken?: string }; accessToken?: string; refreshToken?: string });
  const accessToken = data.data?.accessToken ?? data.accessToken ?? null;
  const nextRefreshToken = data.data?.refreshToken ?? data.refreshToken ?? refreshToken;

  if (!res.ok || !accessToken) return null;

  const current = getUserSession() ?? {};
  setUserSession({ ...current, token: accessToken, refreshToken: nextRefreshToken });
  return accessToken;
}

async function refreshAdminAccessToken(): Promise<string | null> {
  const refreshToken = getAdminRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const raw = await res.json().catch(() => ({}));
  const data = (raw as { data?: { accessToken?: string; refreshToken?: string }; accessToken?: string; refreshToken?: string });
  const accessToken = data.data?.accessToken ?? data.accessToken ?? null;
  const nextRefreshToken = data.data?.refreshToken ?? data.refreshToken ?? refreshToken;

  if (!res.ok || !accessToken) return null;

  setAdminSession({ token: accessToken, refreshToken: nextRefreshToken });
  return accessToken;
}

type BrowserRequestInit = Parameters<typeof fetch>[1];

export async function hostApiFetch<T = unknown>(path: string, opts: BrowserRequestInit = {}): Promise<T> {
  try {
    return await apiFetch<T>(path, {
      ...opts,
      headers: {
        ...((opts.headers as Record<string, string>) || {}),
        ...hostAuthHeader(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    const authFailed = /401|Unauthorized|Token expired or invalid/i.test(message);
    if (!authFailed) throw err;

    const staffRefreshed = getStaffToken() ? await refreshStaffAccessToken() : null;
    const refreshed = staffRefreshed ? null : await refreshHostAccessToken();
    if (!refreshed && !staffRefreshed) throw err;

    return apiFetch<T>(path, {
      ...opts,
      headers: {
        ...((opts.headers as Record<string, string>) || {}),
        ...(getStaffToken() ? { Authorization: `Bearer ${getStaffToken()}` } : hostAuthHeader()),
      },
    });
  }
}

export async function userApiFetch<T = unknown>(path: string, opts: BrowserRequestInit = {}): Promise<T> {
  try {
    return await apiFetch<T>(path, {
      ...opts,
      headers: {
        ...((opts.headers as Record<string, string>) || {}),
        ...userAuthHeader(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    const authFailed = /401|Unauthorized|Token expired or invalid/i.test(message);
    if (!authFailed) throw err;

    const refreshed = await refreshUserAccessToken();
    if (!refreshed) {
      clearUserSession();
      throw err;
    }

    return apiFetch<T>(path, {
      ...opts,
      headers: {
        ...((opts.headers as Record<string, string>) || {}),
        ...userAuthHeader(),
      },
    });
  }
}

type ApiEnvelope<T> = { success?: boolean; data?: T; message?: string } | T;

export async function apiFetch<T = unknown>(path: string, opts: BrowserRequestInit = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const raw = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  const envelope = raw as { success?: boolean; data?: T; message?: string };
  if (!res.ok || envelope.success === false) {
    if (res.status === 401) {
      // Silently refresh an expired admin session before logging out, so the
      // admin stays signed in (up to the refresh-token lifetime) instead of
      // being kicked out the moment the short-lived access token expires.
      const adminToken = getAdminToken();
      const sentAdminToken = adminToken && headers.Authorization === `Bearer ${adminToken}`;
      if (!retried && sentAdminToken && getAdminRefreshToken()) {
        const refreshed = await refreshAdminAccessToken();
        if (refreshed) {
          return apiFetch<T>(path, { ...opts, headers: { ...headers, Authorization: `Bearer ${refreshed}` } }, true);
        }
        clearAdminSession();
      }
      setAdminToken(null);
      setHostToken(null);
      setStaffToken(null);
    }
    throw new Error(envelope.message || `Request failed: ${res.status}`);
  }
  // If backend returned the sendSuccess envelope, unwrap; otherwise return raw.
  return (envelope.data !== undefined ? envelope.data : (raw as T));
}
