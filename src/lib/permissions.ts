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

const LEGACY_PERMISSION_ALIASES: Record<string, PermissionKey[]> = {
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
    for (const alias of LEGACY_PERMISSION_ALIASES[key] ?? []) {
      normalized.add(alias);
    }
  }
  return [...normalized];
};

export const hasPermission = (
  permissions: readonly string[] | undefined | null,
  required: PermissionKey | string
): boolean => normalizePermissions(permissions).includes(required);

export const permissionLabel: Record<PermissionKey, string> = {
  [PERMISSIONS.BOOKING_VIEW]: 'Bookings',
  [PERMISSIONS.BOOKING_CREATE]: 'Create Bookings',
  [PERMISSIONS.BOOKING_EDIT]: 'Edit Bookings',
  [PERMISSIONS.INVENTORY_VIEW]: 'Inventory',
  [PERMISSIONS.INVENTORY_MANAGE]: 'Manage Inventory',
  [PERMISSIONS.REPORTS_VIEW]: 'Reports',
  [PERMISSIONS.STAFF_MANAGE]: 'Staff',
  [PERMISSIONS.PROPERTY_SETTINGS]: 'Property Settings',
  [PERMISSIONS.GUEST_MESSAGES]: 'Guest Messages',
  [PERMISSIONS.ROOM_MANAGE]: 'Rooms',
  [PERMISSIONS.PAYMENTS_VIEW]: 'Payments',
  [PERMISSIONS.DASHBOARD_VIEW]: 'Dashboard',
};

