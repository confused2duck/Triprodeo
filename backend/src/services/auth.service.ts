import prisma from '../config/database';
import { env } from '../config/env';
import { hashPassword, comparePassword } from '../utils/hash.util';
import { signAccessToken, signRefreshToken, verifyRefreshToken, TokenPayload } from '../utils/jwt.util';
import { getDefaultPermissionsForRole, normalizePermissions } from '../constants/permissions';

// ── Admin ──────────────────────────────────────────────────────────────────────

export const adminLogin = async (email: string, password: string) => {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  const valid = await comparePassword(password, admin.password);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  const payload: TokenPayload = { id: admin.id, email: admin.email, role: 'admin', userType: 'admin' };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    admin: { id: admin.id, email: admin.email, name: admin.name },
  };
};

export const ensureBootstrapAdmin = async () => {
  const existing = await prisma.admin.findUnique({ where: { email: env.ADMIN_DEFAULT_EMAIL } });
  if (existing) return existing;

  const totalAdmins = await prisma.admin.count();
  if (totalAdmins > 0) return existing;

  const password = await hashPassword(env.ADMIN_DEFAULT_PASSWORD);
  return prisma.admin.create({
    data: {
      email: env.ADMIN_DEFAULT_EMAIL,
      password,
      name: 'Triprodeo Admin',
    },
  });
};

// ── Host ───────────────────────────────────────────────────────────────────────

export const ensureBootstrapHost = async () => {
  const email = 'ananya@triprodeo.com';
  const password = await hashPassword('host1234');

  return prisma.host.upsert({
    where: { email },
    update: {
      password,
      name: 'Ananya Krishnan',
      phone: '+91 98765 43210',
      status: 'ACTIVE',
      package: 'BASIC',
    },
    create: {
      email,
      password,
      name: 'Ananya Krishnan',
      phone: '+91 98765 43210',
      status: 'ACTIVE',
      package: 'BASIC',
    },
  });
};

export const hostLogin = async (email: string, password: string) => {
  const host = await prisma.host.findUnique({ where: { email } });
  if (!host) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  if (host.status === 'SUSPENDED')
    throw Object.assign(new Error('Account suspended. Contact support.'), { statusCode: 403 });

  const valid = await comparePassword(password, host.password);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  const payload: TokenPayload = {
    id: host.id,
    email: host.email,
    role: 'host',
    userType: 'owner',
    permissions: normalizePermissions(Object.values(getAllPortalPermissions())),
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.host.update({ where: { id: host.id }, data: { refreshToken } });

  return {
    accessToken,
    refreshToken,
    host: {
      id: host.id,
      email: host.email,
      name: host.name,
      package: host.package,
      status: host.status,
      avatar: host.avatar,
      phone: host.phone,
    },
  };
};

const getAllPortalPermissions = () => ({
  booking_view: 'booking_view',
  booking_create: 'booking_create',
  booking_edit: 'booking_edit',
  inventory_view: 'inventory_view',
  inventory_manage: 'inventory_manage',
  reports_view: 'reports_view',
  staff_manage: 'staff_manage',
  property_settings: 'property_settings',
  guest_messages: 'guest_messages',
  room_manage: 'room_manage',
  payments_view: 'payments_view',
  dashboard_view: 'dashboard_view',
});

const isHashedPassword = (value?: string | null) =>
  typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);

const normalizeStaffPermissions = (staff: {
  permissions: string[];
  role: string;
}) => {
  // If staff has no permissions, use defaults based on their role
  const permissionsToUse = staff.permissions && staff.permissions.length > 0
    ? staff.permissions
    : getDefaultPermissionsForRole(staff.role);
  
  return normalizePermissions(permissionsToUse);
};

const buildStaffPayload = (staff: {
  id: string;
  loginEmail?: string | null;
  email?: string | null;
  permissions: string[];
  propertyId: string;
  property: { hostId: string };
}) => {
  const permissions = normalizePermissions(staff.permissions);
  return {
    id: staff.id,
    email: staff.loginEmail || staff.email || '',
    role: 'staff' as const,
    userType: 'staff' as const,
    permissions,
    propertyId: staff.propertyId,
    hostId: staff.property.hostId,
    staffId: staff.id,
  };
};

export const staffLogin = async (email: string, password: string) => portalLogin(email, password);

export const portalLogin = async (email: string, password: string) => {
  const normalizedEmail = email.trim();

  const host = await prisma.host.findUnique({ where: { email: normalizedEmail } });
  if (host && host.status !== 'SUSPENDED') {
    const valid = await comparePassword(password, host.password);
    if (valid) {
      const permissions = normalizePermissions(Object.values(getAllPortalPermissions()));
      const payload: TokenPayload = {
        id: host.id,
        email: host.email,
        role: 'host',
        userType: 'owner',
        permissions,
        hostId: host.id,
      };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      await prisma.host.update({ where: { id: host.id }, data: { refreshToken } });

      return {
        accessToken,
        refreshToken,
        session: {
          id: host.id,
          hostId: host.id,
          email: host.email,
          name: host.name,
          role: 'host',
          userType: 'owner',
          permissions,
          propertyId: undefined,
          token: accessToken,
          refreshToken,
        },
        host: {
          id: host.id,
          email: host.email,
          name: host.name,
          package: host.package,
          status: host.status,
          avatar: host.avatar,
          phone: host.phone,
          permissions,
        },
      };
    }
  }

  const staff = await prisma.staffMember.findFirst({
    where: {
      OR: [
        { loginEmail: normalizedEmail },
        { email: normalizedEmail },
      ],
      hasPortalAccess: true,
      status: 'ACTIVE',
    },
    include: {
      property: {
        select: {
          id: true,
          hostId: true,
          status: true,
        },
      },
    },
  });

  if (!staff) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  const passwordMatches = isHashedPassword(staff.loginPassword)
    ? await comparePassword(password, staff.loginPassword ?? '')
    : staff.loginPassword === password;
  if (!passwordMatches) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const permissions = normalizeStaffPermissions(staff);

  const payload: TokenPayload = {
    id: staff.id,
    email: staff.loginEmail || staff.email || '',
    role: 'staff',
    userType: 'staff',
    permissions,
    propertyId: staff.propertyId,
    hostId: staff.property.hostId,
    staffId: staff.id,
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    session: {
      id: staff.id,
      hostId: staff.property.hostId,
      propertyId: staff.propertyId,
      email: staff.loginEmail || staff.email || '',
      name: staff.name,
      role: 'staff',
      userType: 'staff',
      permissions,
      token: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      staffId: staff.id,
    },
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.loginEmail || staff.email || '',
      propertyId: staff.propertyId,
      role: staff.role,
      permissions,
      hasPortalAccess: staff.hasPortalAccess,
      hostId: staff.property.hostId,
    },
  };
};

export const hostSignup = async (data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) => {
  const existing = await prisma.host.findUnique({ where: { email: data.email } });
  if (existing) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });

  const hashed = await hashPassword(data.password);
  const host = await prisma.host.create({
    data: { name: data.name, email: data.email, password: hashed, phone: data.phone },
  });

  const payload: TokenPayload = { id: host.id, email: host.email, role: 'host', userType: 'owner' };
  const permissions = normalizePermissions(Object.values(getAllPortalPermissions()));
  const payloadWithPermissions: TokenPayload = {
    ...payload,
    permissions,
    hostId: host.id,
  };
  return {
    accessToken: signAccessToken(payloadWithPermissions),
    refreshToken: signRefreshToken(payloadWithPermissions),
    host: { id: host.id, email: host.email, name: host.name, package: host.package },
  };
};

// ── Guest / User ───────────────────────────────────────────────────────────────

export const userLogin = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  const valid = await comparePassword(password, user.password);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  const payload: TokenPayload = { id: user.id, email: user.email, role: 'user' };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
  };
};

export const userSignup = async (data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) => {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });

  const hashed = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, password: hashed, phone: data.phone },
  });

  const payload: TokenPayload = { id: user.id, email: user.email, role: 'user' };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user: { id: user.id, email: user.email, name: user.name },
  };
};

// ── Refresh ────────────────────────────────────────────────────────────────────

export const refreshTokens = async (token: string) => {
  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }

  const newAccess = signAccessToken(payload);
  const newRefresh = signRefreshToken(payload);

  if (payload.userType === 'owner' || payload.role === 'host') {
    await prisma.host.update({ where: { id: payload.id }, data: { refreshToken: newRefresh } });
  } else if (payload.userType === 'user' || payload.role === 'user') {
    await prisma.user.update({ where: { id: payload.id }, data: { refreshToken: newRefresh } });
  } else if (payload.userType === 'staff' || payload.role === 'staff') {
    // Staff sessions are bound to the login record rather than a refresh token store.
    // The signed payload already carries the effective permissions.
  }

  return { accessToken: newAccess, refreshToken: newRefresh };
};
