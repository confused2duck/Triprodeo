import prisma from '../config/database';
import { Prisma, StaffRole, ShiftType, StaffStatus } from '@prisma/client';
import { normalizePermissions, ROLE_DEFAULT_PERMISSIONS } from '../constants/permissions';
import { hashPassword } from '../utils/hash.util';

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

type UiStaffRole =
  | 'reception'
  | 'housekeeping'
  | 'service'
  | 'kitchen'
  | 'security'
  | 'maintenance'
  | 'management'
  | 'driver';

type UiShiftType = 'morning' | 'afternoon' | 'night' | 'full-day';
type UiStaffStatus = 'active' | 'on-leave' | 'inactive';

const roleToDb: Record<UiStaffRole, StaffRole> = {
  reception: 'RECEPTIONIST',
  housekeeping: 'HOUSEKEEPER',
  service: 'CONCIERGE',
  kitchen: 'CHEF',
  security: 'SECURITY',
  maintenance: 'MAINTENANCE',
  management: 'MANAGER',
  driver: 'DRIVER',
};

const roleFromDb: Record<StaffRole, UiStaffRole> = {
  MANAGER: 'management',
  RECEPTIONIST: 'reception',
  HOUSEKEEPER: 'housekeeping',
  CHEF: 'kitchen',
  SECURITY: 'security',
  MAINTENANCE: 'maintenance',
  DRIVER: 'driver',
  CONCIERGE: 'service',
};

const shiftToDb: Record<UiShiftType, ShiftType> = {
  morning: 'MORNING',
  afternoon: 'AFTERNOON',
  night: 'NIGHT',
  'full-day': 'FULL_DAY',
};

const shiftFromDb: Record<ShiftType, UiShiftType> = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  NIGHT: 'night',
  FULL_DAY: 'full-day',
};

const statusToDb: Record<UiStaffStatus, StaffStatus> = {
  active: 'ACTIVE',
  'on-leave': 'ON_LEAVE',
  inactive: 'INACTIVE',
};

const statusFromDb: Record<StaffStatus, UiStaffStatus> = {
  ACTIVE: 'active',
  ON_LEAVE: 'on-leave',
  INACTIVE: 'inactive',
};

const toStaffMember = <T extends { role: StaffRole; shift: ShiftType; status: StaffStatus }>(staff: T) => ({
  ...staff,
  role: roleFromDb[staff.role],
  shift: shiftFromDb[staff.shift],
  status: statusFromDb[staff.status],
});

export const listStaff = async (hostId: string, propertyId?: string) => {
  const ownedProperties = await prisma.property.findMany({
    where: { hostId },
    select: { id: true },
  });

  const ownedIds = ownedProperties.map((property) => property.id);
  const where: Prisma.StaffMemberWhereInput = {
    propertyId: propertyId ? { in: ownedIds.includes(propertyId) ? [propertyId] : [] } : { in: ownedIds },
  };

  const staff = await prisma.staffMember.findMany({
    where,
    orderBy: { joinedDate: 'desc' },
  });

  return staff.map(toStaffMember);
};

export const createStaff = async (hostId: string, data: {
  propertyId: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  shift?: string;
  salary?: number;
  notes?: string;
  loginEmail?: string;
  loginPassword?: string;
  hasPortalAccess?: boolean;
  permissions?: string[];
}) => {
  const property = await prisma.property.findFirst({
    where: { id: data.propertyId, hostId },
    select: { id: true },
  });
  if (!property) throw Object.assign(new Error('Property not found'), { statusCode: 404 });

  const uiRole = normalizeString(data.role).toLowerCase() as UiStaffRole;
  const uiShift = normalizeString(data.shift).toLowerCase() as UiShiftType;
  const dbRole = roleToDb[uiRole] ?? roleToDb.reception;
  const defaultPermissionsRole = uiRole in roleToDb ? uiRole : 'reception';

  const staff = await prisma.staffMember.create({
    data: {
      propertyId: property.id,
      name: normalizeString(data.name),
      role: dbRole,
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      shift: shiftToDb[uiShift] ?? shiftToDb['full-day'],
      salary: typeof data.salary === 'number' ? data.salary : undefined,
      notes: data.notes?.trim() || undefined,
      loginEmail: data.loginEmail?.trim() || undefined,
      loginPassword: data.loginPassword ? await hashPassword(data.loginPassword.trim()) : undefined,
      hasPortalAccess: data.hasPortalAccess ?? false,
      permissions: normalizePermissions(
        data.permissions ?? ROLE_DEFAULT_PERMISSIONS[defaultPermissionsRole] ?? []
      ),
      status: statusToDb.active,
    },
  });

  return toStaffMember(staff);
};

export const updateStaff = async (hostId: string, staffId: string, data: {
  propertyId?: string;
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
  shift?: string;
  salary?: number;
  notes?: string;
  loginEmail?: string;
  loginPassword?: string;
  hasPortalAccess?: boolean;
  permissions?: string[];
  status?: string;
}) => {
  const existing = await prisma.staffMember.findFirst({
    where: {
      id: staffId,
      property: { hostId },
    },
    select: { id: true },
  });
  if (!existing) throw Object.assign(new Error('Staff member not found'), { statusCode: 404 });

  if (data.propertyId) {
    const property = await prisma.property.findFirst({
      where: { id: data.propertyId, hostId },
      select: { id: true },
    });
    if (!property) throw Object.assign(new Error('Property not found'), { statusCode: 404 });
  }

  const uiRole = data.role ? (data.role.toLowerCase() as UiStaffRole) : undefined;
  const uiShift = data.shift ? (data.shift.toLowerCase() as UiShiftType) : undefined;
  const uiStatus = data.status ? (data.status.toLowerCase() as UiStaffStatus) : undefined;
  
  const newDbRole = uiRole ? (roleToDb[uiRole] ?? roleToDb.reception) : undefined;
  const defaultPermissionsRole = uiRole ? (uiRole in roleToDb ? uiRole : 'reception') : undefined;

  const staff = await prisma.staffMember.update({
    where: { id: staffId },
    data: {
      ...(data.propertyId ? { property: { connect: { id: data.propertyId } } } : {}),
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(newDbRole ? { role: newDbRole } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
      ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
      ...(uiShift ? { shift: shiftToDb[uiShift] ?? shiftToDb['full-day'] } : {}),
      ...(typeof data.salary === 'number' ? { salary: data.salary } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      ...(data.loginEmail !== undefined ? { loginEmail: data.loginEmail?.trim() || null } : {}),
      ...(data.loginPassword !== undefined
        ? {
            loginPassword: data.loginPassword?.trim()
              ? await hashPassword(data.loginPassword.trim())
              : null,
          }
        : {}),
      ...(data.hasPortalAccess !== undefined ? { hasPortalAccess: data.hasPortalAccess } : {}),
      ...(data.permissions !== undefined
        ? { permissions: normalizePermissions(data.permissions) }
        : defaultPermissionsRole
          ? { permissions: normalizePermissions(ROLE_DEFAULT_PERMISSIONS[defaultPermissionsRole] ?? []) }
          : {}),
      ...(uiStatus ? { status: statusToDb[uiStatus] ?? statusToDb.active } : {}),
    },
  });

  return toStaffMember(staff);
};

export const deleteStaff = async (hostId: string, staffId: string) => {
  const existing = await prisma.staffMember.findFirst({
    where: {
      id: staffId,
      property: { hostId },
    },
    select: { id: true },
  });
  if (!existing) throw Object.assign(new Error('Staff member not found'), { statusCode: 404 });

  await prisma.staffMember.delete({ where: { id: staffId } });
};
