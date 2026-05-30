export const PERMISSIONS = {
  BOOKING_VIEW: 'booking_view',
  BOOKING_CREATE: 'booking_create',
  BOOKING_EDIT: 'booking_edit',
  INVENTORY_VIEW: 'inventory_view',
  INVENTORY_MANAGE: 'inventory_manage',
  REPORTS_VIEW: 'reports_view',
  STAFF_MANAGE: 'staff_manage',
  PROPERTY_SETTINGS: 'property_settings',
  GUEST_MESSAGES: 'guest_messages',
  ROOM_MANAGE: 'room_manage',
  PAYMENTS_VIEW: 'payments_view',
  DASHBOARD_VIEW: 'dashboard_view',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_DEFAULT_PERMISSIONS_MAP: Record<string, PermissionKey[]> = {
  reception: [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_EDIT,
    PERMISSIONS.GUEST_MESSAGES,
  ],
  housekeeping: [
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.ROOM_MANAGE,
  ],
  service: [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.GUEST_MESSAGES,
  ],
  kitchen: [
    PERMISSIONS.INVENTORY_VIEW,
  ],
  security: [
    PERMISSIONS.BOOKING_VIEW,
  ],
  maintenance: [
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.ROOM_MANAGE,
  ],
  management: [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_EDIT,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.PROPERTY_SETTINGS,
    PERMISSIONS.GUEST_MESSAGES,
    PERMISSIONS.ROOM_MANAGE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  driver: [
    PERMISSIONS.BOOKING_VIEW,
  ],
};

const ROLE_ALIASES: Record<string, string> = {
  manager: 'management',
  receptionist: 'reception',
  housekeeper: 'housekeeping',
  chef: 'kitchen',
  concierge: 'service',
  maintenance: 'maintenance',
  driver: 'driver',
  security: 'security',
};

export const getDefaultPermissionsForRole = (role: string | null | undefined): PermissionKey[] => {
  const key = ROLE_ALIASES[String(role || '').trim().toLowerCase()] ?? String(role || '').trim().toLowerCase();
  return ROLE_DEFAULT_PERMISSIONS_MAP[key] ?? [];
};

export const ROLE_DEFAULT_PERMISSIONS = ROLE_DEFAULT_PERMISSIONS_MAP;

const PERMISSION_ALIASES: Record<string, PermissionKey[]> = {
  view_bookings: [PERMISSIONS.BOOKING_VIEW],
  manage_checkin: [PERMISSIONS.BOOKING_EDIT, PERMISSIONS.BOOKING_CREATE],
  view_guests: [PERMISSIONS.BOOKING_VIEW],
  view_rooms: [PERMISSIONS.ROOM_MANAGE],
  manage_rooms: [PERMISSIONS.ROOM_MANAGE],
  view_restaurant: [PERMISSIONS.DASHBOARD_VIEW],
  take_orders: [PERMISSIONS.BOOKING_CREATE],
  manage_orders: [PERMISSIONS.BOOKING_EDIT],
  view_inventory: [PERMISSIONS.INVENTORY_VIEW],
  manage_inventory: [PERMISSIONS.INVENTORY_MANAGE],
  view_staff: [PERMISSIONS.STAFF_MANAGE],
  view_messages: [PERMISSIONS.GUEST_MESSAGES],
  send_messages: [PERMISSIONS.GUEST_MESSAGES],
  view_reports: [PERMISSIONS.REPORTS_VIEW],
  manage_housekeeping: [PERMISSIONS.ROOM_MANAGE],
  view_payments: [PERMISSIONS.PAYMENTS_VIEW],
  manage_maintenance: [PERMISSIONS.ROOM_MANAGE],
};

export const normalizePermissions = (permissions: readonly string[] | undefined | null): string[] => {
  if (!permissions || permissions.length === 0) return [];

  const normalized = new Set<string>();
  for (const permission of permissions) {
    const key = String(permission || '').trim();
    if (!key) continue;
    normalized.add(key);
    for (const alias of PERMISSION_ALIASES[key] ?? []) {
      normalized.add(alias);
    }
  }
  return [...normalized];
};

export const hasPermission = (
  permissions: readonly string[] | undefined | null,
  required: string
): boolean => normalizePermissions(permissions).includes(required);
